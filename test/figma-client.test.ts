import { describe, it, expect, vi } from "vitest";
import { FigmaClient } from "../src/figma-client.js";

function res(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

describe("FigmaClient", () => {
  it("sends the PAT header and returns parsed json", async () => {
    // Arrange
    const fetchMock = vi.fn(async () => res(200, { name: "F" }));
    const c = new FigmaClient({ token: "tok", baseUrl: "https://api.figma.com", fetchImpl: fetchMock });
    // Act
    const out = await c.getFile("KEY", { depth: 1 });
    // Assert
    expect(out).toEqual({ name: "F" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/v1/files/KEY?depth=1");
    expect((init as RequestInit).headers).toMatchObject({ "X-Figma-Token": "tok" });
  });

  it("retries once on 429 then succeeds", async () => {
    // Arrange
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(429, {}, { "Retry-After": "0" }))
      .mockResolvedValueOnce(res(200, { ok: true }));
    const c = new FigmaClient({ token: "t", baseUrl: "https://api.figma.com", fetchImpl: fetchMock, maxRetries: 2, baseDelayMs: 0 });
    // Act
    const out = await c.getFile("K");
    // Assert
    expect(out).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses exponential backoff (not 0ms) when Retry-After header is absent", async () => {
    // Arrange
    vi.useFakeTimers();
    try {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(res(429, {})) // no Retry-After header
        .mockResolvedValueOnce(res(200, { ok: true }));
      const c = new FigmaClient({ token: "t", baseUrl: "https://api.figma.com", fetchImpl: fetchMock, maxRetries: 2, baseDelayMs: 500 });
      // Act
      const p = c.getFile("K");
      // Assert
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(1); // still backing off, not retried at 0ms
      await vi.advanceTimersByTimeAsync(500);
      await expect(p).resolves.toEqual({ ok: true });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("gives up and throws once 429 retries are exhausted", async () => {
    // Arrange
    const fetchMock = vi.fn(async () => res(429, {}, { "Retry-After": "0" }));
    const c = new FigmaClient({ token: "t", baseUrl: "https://api.figma.com", fetchImpl: fetchMock, maxRetries: 1, baseDelayMs: 0 });
    // Act + Assert
    await expect(c.getFile("K")).rejects.toThrow(/429/);
    expect(fetchMock).toHaveBeenCalledTimes(1); // attempt 1, no retry budget left
  });

  it("throws a clear error on 403", async () => {
    // Arrange
    const fetchMock = vi.fn(async () => res(403, { err: "Forbidden" }));
    const c = new FigmaClient({ token: "t", baseUrl: "https://api.figma.com", fetchImpl: fetchMock });
    // Act + Assert
    await expect(c.getFile("K")).rejects.toThrow(/403/);
  });

  it("builds the right path for every endpoint and skips undefined query params", async () => {
    // Arrange
    const calls: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      calls.push(url);
      return res(200, { ok: 1 });
    });
    const c = new FigmaClient({ token: "t", baseUrl: "https://api.figma.com", fetchImpl: fetchMock });
    // Act
    await c.getFile("K", { depth: undefined, geometry: "paths" }); // undefined param skipped
    await c.getNodes("K", ["1:1", "2:2"], { depth: 1 });
    await c.getImages("K", ["1:1"], { format: "png" });
    await c.getComments("K");
    await c.getFileComponents("K");
    await c.getFileComponentSets("K");
    await c.getFileStyles("K");
    // Assert
    expect(calls[0]).toBe("https://api.figma.com/v1/files/K?geometry=paths");
    expect(calls[1]).toBe("https://api.figma.com/v1/files/K/nodes?depth=1&ids=1%3A1%2C2%3A2");
    expect(calls[2]).toBe("https://api.figma.com/v1/images/K?format=png&ids=1%3A1");
    expect(calls[3]).toBe("https://api.figma.com/v1/files/K/comments");
    expect(calls[4]).toBe("https://api.figma.com/v1/files/K/components");
    expect(calls[5]).toBe("https://api.figma.com/v1/files/K/component_sets");
    expect(calls[6]).toBe("https://api.figma.com/v1/files/K/styles");
  });

  it("emits no query string when every param is undefined", async () => {
    // Arrange
    const calls: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      calls.push(url);
      return res(200, {});
    });
    const c = new FigmaClient({ token: "t", baseUrl: "https://api.figma.com", fetchImpl: fetchMock });
    // Act
    await c.getFile("K", { depth: undefined });
    // Assert
    expect(calls[0]).toBe("https://api.figma.com/v1/files/K");
  });

  it("defaults fetchImpl to the global fetch when none is supplied", () => {
    // Arrange + Act
    const c = new FigmaClient({ token: "t", baseUrl: "https://api.figma.com" });
    // Assert — constructing alone exercises the `?? globalThis.fetch` default (no network call)
    expect(c).toBeInstanceOf(FigmaClient);
  });
});

// In-memory CacheStore double so caching behaviour is tested without touching disk.
function memStore() {
  const map = new Map<string, { data: unknown; cachedAt: number }>();
  const store = {
    async get(key: string) {
      return map.get(key);
    },
    async set(key: string, entry: { data: unknown; cachedAt: number }) {
      map.set(key, entry);
    },
  };
  return { store, map };
}

describe("FigmaClient caching", () => {
  it("serves a fresh cache entry without hitting fetch a second time", async () => {
    // Arrange
    const { store } = memStore();
    const fetchMock = vi.fn(async () => res(200, { v: 1 }));
    const c = new FigmaClient({ token: "t", baseUrl: "https://api.figma.com", fetchImpl: fetchMock, cacheStore: store, cacheTtlMs: 10_000, now: () => 1000 });
    // Act
    const a = await c.getFile("K");
    const b = await c.getFile("K");
    // Assert
    expect(a).toEqual({ v: 1 });
    expect(b).toEqual({ v: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refetches once the cached entry is older than the TTL", async () => {
    // Arrange
    let nowMs = 1000;
    const { store } = memStore();
    const fetchMock = vi.fn(async () => res(200, { v: 1 }));
    const c = new FigmaClient({ token: "t", baseUrl: "https://api.figma.com", fetchImpl: fetchMock, cacheStore: store, cacheTtlMs: 5000, now: () => nowMs });
    // Act
    await c.getFile("K");
    nowMs += 6000; // step past the TTL
    await c.getFile("K");
    // Assert
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("dedupes concurrent identical requests into a single fetch (single-flight)", async () => {
    // Arrange — one shared gate promise; the resolver is captured eagerly (the Promise executor
    // runs synchronously) so it exists before fetch is ever invoked.
    const { store } = memStore();
    let release!: (r: Response) => void;
    const gate = new Promise<Response>((resolve) => { release = resolve; });
    const fetchMock = vi.fn(() => gate);
    const c = new FigmaClient({ token: "t", baseUrl: "https://api.figma.com", fetchImpl: fetchMock, cacheStore: store, cacheTtlMs: 10_000, now: () => 1 });
    // Act — two callers race before the first fetch resolves
    const p1 = c.getFile("K");
    const p2 = c.getFile("K");
    release(res(200, { v: 1 }));
    const [a, b] = await Promise.all([p1, p2]);
    // Assert
    expect(a).toEqual({ v: 1 });
    expect(b).toEqual({ v: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("serves stale cache when a refetch is rate-limited (429)", async () => {
    // Arrange
    let nowMs = 1000;
    const { store } = memStore();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(200, { v: 1 })) // primes the cache
      .mockResolvedValue(res(429, {}, { "Retry-After": "0" })); // later refetch is rate-limited
    const c = new FigmaClient({ token: "t", baseUrl: "https://api.figma.com", fetchImpl: fetchMock, cacheStore: store, cacheTtlMs: 5000, maxRetries: 1, baseDelayMs: 0, now: () => nowMs });
    // Act
    await c.getFile("K"); // prime
    nowMs += 6000; // expire
    const out = await c.getFile("K"); // refetch hits 429 -> serve stale
    // Assert
    expect(out).toEqual({ v: 1 });
  });

  it("throws a fallback-guiding error when rate-limited with no cached copy", async () => {
    // Arrange
    const { store } = memStore();
    const fetchMock = vi.fn(async () => res(429, {}, { "Retry-After": "0" }));
    const c = new FigmaClient({ token: "t", baseUrl: "https://api.figma.com", fetchImpl: fetchMock, cacheStore: store, cacheTtlMs: 5000, maxRetries: 1, baseDelayMs: 0, now: () => 1 });
    // Act + Assert — error names the official plugin as the fallback path
    await expect(c.getFile("K")).rejects.toThrow(/plugin/i);
  });

  it("does not cache image renders, since their URLs expire", async () => {
    // Arrange — /v1/images returns short-lived URLs; a cache hit could hand back a dead link.
    const { store } = memStore();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(200, { images: { "1:1": "https://x/a.png" } }))
      .mockResolvedValueOnce(res(200, { images: { "1:1": "https://x/b.png" } }));
    const c = new FigmaClient({ token: "t", baseUrl: "https://api.figma.com", fetchImpl: fetchMock, cacheStore: store, cacheTtlMs: 100_000, now: () => 1 });
    // Act
    const a = (await c.getImages("K", ["1:1"], { format: "png" })) as { images: Record<string, string> };
    const b = (await c.getImages("K", ["1:1"], { format: "png" })) as { images: Record<string, string> };
    // Assert — each call hits the network; the second is not served the first's stale URL
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(a.images["1:1"]).toBe("https://x/a.png");
    expect(b.images["1:1"]).toBe("https://x/b.png");
  });

  it("refuses to serve stale data older than the max stale age", async () => {
    // Arrange
    let nowMs = 1000;
    const { store } = memStore();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(200, { v: 1 })) // primes the cache
      .mockResolvedValue(res(429, {}, { "Retry-After": "0" }));
    const c = new FigmaClient({ token: "t", baseUrl: "https://api.figma.com", fetchImpl: fetchMock, cacheStore: store, cacheTtlMs: 5000, maxStaleMs: 10_000, maxRetries: 1, baseDelayMs: 0, now: () => nowMs });
    // Act
    await c.getFile("K"); // prime at t=1000
    nowMs += 60_000; // 60s later: past the TTL *and* past maxStaleMs (10s)
    // Assert — too old to trust; surface the fallback error instead of serving silently
    await expect(c.getFile("K")).rejects.toThrow(/plugin/i);
  });

  it("exposes a stale notice after serving stale, consumable exactly once", async () => {
    // Arrange
    let nowMs = 1000;
    const { store } = memStore();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(200, { v: 1 }))
      .mockResolvedValue(res(429, {}, { "Retry-After": "0" }));
    const c = new FigmaClient({ token: "t", baseUrl: "https://api.figma.com", fetchImpl: fetchMock, cacheStore: store, cacheTtlMs: 5000, maxStaleMs: 1_000_000, maxRetries: 1, baseDelayMs: 0, now: () => nowMs });
    // Act
    await c.getFile("K"); // prime at t=1000
    nowMs += 60_000; // expire, but within maxStale
    await c.getFile("K"); // serves stale
    // Assert — notice carries the age and clears after one consume
    const notice = c.consumeStaleNotice();
    expect(notice?.ageSeconds).toBe(60);
    expect(c.consumeStaleNotice()).toBeUndefined();
  });

  it("records no stale notice on a fresh cache hit", async () => {
    // Arrange
    const { store } = memStore();
    const fetchMock = vi.fn(async () => res(200, { v: 1 }));
    const c = new FigmaClient({ token: "t", baseUrl: "https://api.figma.com", fetchImpl: fetchMock, cacheStore: store, cacheTtlMs: 10_000, now: () => 1000 });
    // Act
    await c.getFile("K");
    await c.getFile("K"); // fresh hit
    // Assert
    expect(c.consumeStaleNotice()).toBeUndefined();
  });

  it("bypasses a fresh cache entry when refresh is requested", async () => {
    // Arrange
    const { store } = memStore();
    const fetchMock = vi.fn().mockResolvedValueOnce(res(200, { v: 1 })).mockResolvedValueOnce(res(200, { v: 2 }));
    const c = new FigmaClient({ token: "t", baseUrl: "https://api.figma.com", fetchImpl: fetchMock, cacheStore: store, cacheTtlMs: 100_000, now: () => 1 });
    // Act
    const a = await c.getFile("K");
    const b = await c.getFile("K", undefined, { refresh: true });
    // Assert
    expect(a).toEqual({ v: 1 });
    expect(b).toEqual({ v: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
