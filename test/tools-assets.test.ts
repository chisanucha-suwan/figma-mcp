import { describe, it, expect, vi, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerAssetTools } from "../src/tools/assets.js";
import { fakeServer, parseResult } from "./helpers.js";

const dirs: string[] = [];
function outDir() {
  const d = mkdtempSync(join(tmpdir(), "fmcp-img-"));
  dirs.push(d);
  return d;
}
afterEach(() => {
  vi.unstubAllGlobals();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("export_image", () => {
  it("returns an error when Figma reports a render error", async () => {
    // Arrange
    const client = { getImages: vi.fn(async () => ({ err: "bad ids" })) };
    const { server, handlers } = fakeServer();
    registerAssetTools(server, client as any, outDir());
    // Act
    const res = await handlers.export_image({ fileKey: "K", ids: ["1:1"] });
    // Assert
    expect(parseResult(res)).toEqual({ error: "bad ids" });
  });

  it("downloads each render url and writes files (defaults to png / scale 2)", async () => {
    // Arrange
    const dir = outDir();
    const client = { getImages: vi.fn(async () => ({ images: { "1:1": "http://x/a.png" } })) };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })));
    const { server, handlers } = fakeServer();
    registerAssetTools(server, client as any, dir);
    // Act
    const res = await handlers.export_image({ fileKey: "K", ids: ["1:1"] });
    // Assert
    expect(client.getImages).toHaveBeenCalledWith("K", ["1:1"], { format: "png", scale: 2 });
    const out = parseResult(res);
    expect(out.saved["1:1"]).toBe(join(dir, "1-1.png"));
    expect(existsSync(out.saved["1:1"])).toBe(true);
    expect(out.errors).toBeUndefined();
  });

  it("collects per-id errors: empty url, failed download, and a thrown fetch", async () => {
    // Arrange
    const dir = outDir();
    const client = {
      getImages: vi.fn(async () => ({ images: { empty: "", bad: "http://x/bad", boom: "http://x/boom", ok: "http://x/ok.svg" } })),
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "http://x/bad") return new Response("", { status: 500 });
      if (url === "http://x/boom") throw new Error("network down");
      return new Response(new Uint8Array([9]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { server, handlers } = fakeServer();
    registerAssetTools(server, client as any, dir);
    // Act
    const res = await handlers.export_image({ fileKey: "K", ids: ["a"], format: "svg", scale: 1 });
    // Assert
    const out = parseResult(res);
    expect(out.errors.empty).toMatch(/no render url/);
    expect(out.errors.bad).toMatch(/HTTP 500/);
    expect(out.errors.boom).toMatch(/network down/);
    expect(out.saved.ok).toBe(join(dir, "ok.svg"));
  });
});
