type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

export interface FigmaClientOptions {
  token: string;
  baseUrl: string;
  fetchImpl?: FetchImpl;
  maxRetries?: number;
  baseDelayMs?: number;
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

  constructor(private opts: FigmaClientOptions) {
    this.fetchImpl = opts.fetchImpl ?? (globalThis.fetch as FetchImpl);
    this.maxRetries = opts.maxRetries ?? 3;
    this.baseDelayMs = opts.baseDelayMs ?? 500;
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

  async get<T = unknown>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    const url = `${this.opts.baseUrl}${path}${this.qs(params)}`;
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
        throw new FigmaError(r.status, `Figma API ${r.status} for ${path}: ${text.slice(0, 300)}`);
      }
      return (await r.json()) as T;
    }
  }

  getFile(key: string, params?: Record<string, string | number | boolean | undefined>) {
    return this.get(`/v1/files/${key}`, params);
  }
  getNodes(key: string, ids: string[], params?: Record<string, string | number | boolean | undefined>) {
    return this.get(`/v1/files/${key}/nodes`, { ...params, ids: ids.join(",") });
  }
  getImages(key: string, ids: string[], params?: Record<string, string | number | boolean | undefined>) {
    return this.get<{ images: Record<string, string>; err?: string }>(`/v1/images/${key}`, { ...params, ids: ids.join(",") });
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
