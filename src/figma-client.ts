import type { CacheStore } from "./cache.js";

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

export interface FigmaClientOptions {
  token: string;
  baseUrl: string;
  fetchImpl?: FetchImpl;
  maxRetries?: number;
  baseDelayMs?: number;
  // Optional response cache. When omitted the client behaves exactly as before (always fetch).
  cacheStore?: CacheStore;
  // How long a cached entry is considered fresh. Default 15 min.
  cacheTtlMs?: number;
  // Oldest a cached entry may be and still be served stale on a 429. Beyond this the rate-limit
  // error is surfaced instead of returning data too old to trust. Default 24h.
  maxStaleMs?: number;
  // Injectable clock so TTL behaviour is deterministic in tests.
  now?: () => number;
}

export interface GetOptions {
  refresh?: boolean; // bypass a fresh cache entry and force a network fetch
  noStore?: boolean; // never read or write the cache (for volatile endpoints, e.g. image renders)
}

export class FigmaError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "FigmaError";
  }
}

export class FigmaClient {
  private fetchImpl: FetchImpl;
  private maxRetries: number;
  private baseDelayMs: number;
  private cacheStore?: CacheStore;
  private cacheTtlMs: number;
  private maxStaleMs: number;
  private now: () => number;
  // Single-flight: in-progress fetches keyed by URL so concurrent identical reads share one call.
  private inflight = new Map<string, Promise<unknown>>();
  // Set when a stale entry is served on a 429; cleared only by consumeStaleNotice(). Never cleared
  // on a fresh return, so a stale serve survives alongside a concurrent fresh one in the same tool.
  private staleNotice?: { ageSeconds: number };

  constructor(private opts: FigmaClientOptions) {
    this.fetchImpl = opts.fetchImpl ?? (globalThis.fetch as FetchImpl);
    this.maxRetries = opts.maxRetries ?? 3;
    this.baseDelayMs = opts.baseDelayMs ?? 500;
    this.cacheStore = opts.cacheStore;
    this.cacheTtlMs = opts.cacheTtlMs ?? 15 * 60 * 1000;
    this.maxStaleMs = opts.maxStaleMs ?? 24 * 60 * 60 * 1000;
    this.now = opts.now ?? (() => Date.now());
  }

  private qs(params?: Record<string, string | number | boolean | undefined>): string {
    if (!params) return "";
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) usp.set(k, String(v));
    }
    const s = usp.toString();
    return s ? `?${s}` : "";
  }

  // Network fetch with 429 retry/backoff. No caching — the cache layer lives in `get()`.
  private async fetchWithRetry(url: string, path: string): Promise<unknown> {
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      attempt++;
      const r = await this.fetchImpl(url, { headers: { "X-Figma-Token": this.opts.token } });
      if (r.status === 429 && attempt < this.maxRetries) {
        const retryAfterHeader = r.headers.get("Retry-After");
        const retryAfter = retryAfterHeader !== null ? Number(retryAfterHeader) : NaN;
        const delay = Number.isFinite(retryAfter) ? retryAfter * 1000 : this.baseDelayMs * 2 ** (attempt - 1);
        await new Promise((res) => setTimeout(res, delay));
        continue;
      }
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        if (r.status === 429) {
          // Retries exhausted. Point the caller at the fallback so a rate limit need not be terminal.
          throw new FigmaError(
            429,
            `Figma API 429 (rate limited) for ${path}: ${text.slice(0, 200)}. ` +
              `No cached copy available. Retry later, or fall back to the official Figma MCP plugin ` +
              `(mcp__plugin_figma_figma__*), which reads the open desktop file without consuming REST quota.`
          );
        }
        throw new FigmaError(r.status, `Figma API ${r.status} for ${path}: ${text.slice(0, 300)}`);
      }
      return await r.json();
    }
  }

  async get<T = unknown>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
    opts?: GetOptions
  ): Promise<T> {
    const url = `${this.opts.baseUrl}${path}${this.qs(params)}`;

    // No cache configured, or caller opted out (volatile endpoint) -> always fetch.
    if (!this.cacheStore || opts?.noStore) return (await this.fetchWithRetry(url, path)) as T;

    if (!opts?.refresh) {
      const entry = await this.cacheStore.get(url);
      if (entry && this.now() - entry.cachedAt < this.cacheTtlMs) return entry.data as T;
    }

    // Single-flight: collapse concurrent identical requests onto one in-progress fetch.
    const existing = this.inflight.get(url);
    if (existing) return (await existing) as T;

    const p = (async () => {
      try {
        const data = await this.fetchWithRetry(url, path);
        await this.cacheStore!.set(url, { data, cachedAt: this.now() });
        return data;
      } catch (e) {
        // On rate limit, serve a stale cache entry so reads keep working — but only within
        // maxStaleMs, so we never silently hand back data that is too old to trust.
        if (e instanceof FigmaError && e.status === 429) {
          const stale = await this.cacheStore!.get(url);
          if (stale && this.now() - stale.cachedAt < this.maxStaleMs) {
            const ageS = Math.round((this.now() - stale.cachedAt) / 1000);
            console.error(`[figma-mcp] rate limited; serving stale cache for ${path} (cached ${ageS}s ago)`);
            this.staleNotice = { ageSeconds: ageS };
            return stale.data;
          }
        }
        throw e;
      } finally {
        this.inflight.delete(url);
      }
    })();
    this.inflight.set(url, p);
    return (await p) as T;
  }

  // Returns the pending stale-cache notice (set when a 429 was served from stale cache) and clears
  // it. Tools call this once at their return to surface staleness to the model. See `staleNotice`.
  consumeStaleNotice(): { ageSeconds: number } | undefined {
    const n = this.staleNotice;
    this.staleNotice = undefined;
    return n;
  }

  getFile(key: string, params?: Record<string, string | number | boolean | undefined>, opts?: GetOptions) {
    return this.get(`/v1/files/${key}`, params, opts);
  }
  getNodes(key: string, ids: string[], params?: Record<string, string | number | boolean | undefined>) {
    return this.get(`/v1/files/${key}/nodes`, { ...params, ids: ids.join(",") });
  }
  getImages(key: string, ids: string[], params?: Record<string, string | number | boolean | undefined>) {
    // noStore: rendered-image URLs are time-limited, so a cached copy can resolve to a dead link.
    return this.get<{ images: Record<string, string>; err?: string }>(`/v1/images/${key}`, { ...params, ids: ids.join(",") }, { noStore: true });
  }
  getComments(key: string) {
    return this.get(`/v1/files/${key}/comments`);
  }
  getFileComponents(key: string) {
    return this.get(`/v1/files/${key}/components`);
  }
  getFileComponentSets(key: string) {
    return this.get(`/v1/files/${key}/component_sets`);
  }
  getFileStyles(key: string) {
    return this.get(`/v1/files/${key}/styles`);
  }
}
