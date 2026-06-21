import { describe, it, expect, vi } from "vitest";
import { FigmaClient } from "../src/figma-client.js";

function res(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

describe("FigmaClient", () => {
  it("sends the PAT header and returns parsed json", async () => {
    const fetchMock = vi.fn(async () => res(200, { name: "F" }));
    const c = new FigmaClient({ token: "tok", baseUrl: "https://api.figma.com", fetchImpl: fetchMock });
    const out = await c.getFile("KEY", { depth: 1 });
    expect(out).toEqual({ name: "F" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/v1/files/KEY?depth=1");
    expect((init as RequestInit).headers).toMatchObject({ "X-Figma-Token": "tok" });
  });

  it("retries once on 429 then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(429, {}, { "Retry-After": "0" }))
      .mockResolvedValueOnce(res(200, { ok: true }));
    const c = new FigmaClient({ token: "t", baseUrl: "https://api.figma.com", fetchImpl: fetchMock, maxRetries: 2, baseDelayMs: 0 });
    const out = await c.getFile("K");
    expect(out).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses exponential backoff (not 0ms) when Retry-After header is absent", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(res(429, {})) // no Retry-After header
        .mockResolvedValueOnce(res(200, { ok: true }));
      const c = new FigmaClient({ token: "t", baseUrl: "https://api.figma.com", fetchImpl: fetchMock, maxRetries: 2, baseDelayMs: 500 });
      const p = c.getFile("K");
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(1); // still backing off, not retried at 0ms
      await vi.advanceTimersByTimeAsync(500);
      await expect(p).resolves.toEqual({ ok: true });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("throws a clear error on 403", async () => {
    const fetchMock = vi.fn(async () => res(403, { err: "Forbidden" }));
    const c = new FigmaClient({ token: "t", baseUrl: "https://api.figma.com", fetchImpl: fetchMock });
    await expect(c.getFile("K")).rejects.toThrow(/403/);
  });
});
