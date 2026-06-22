import { describe, it, expect, vi, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerTokenTools } from "../src/tools/tokens.js";
import { fakeServer, parseResult } from "./helpers.js";

const dirs: string[] = [];
function tmpDir() {
  const d = mkdtempSync(join(tmpdir(), "fmcp-tok-"));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("token tools", () => {
  it("get_design_tokens returns [] when the file has no styles", async () => {
    // Arrange
    const client = { getFileStyles: vi.fn(async () => ({ meta: { styles: [] } })) };
    const { server, handlers } = fakeServer();
    registerTokenTools(server, client as any);
    // Act
    const res = await handlers.get_design_tokens({ fileKey: "K" });
    // Assert
    expect(parseResult(res)).toEqual([]);
  });

  it("get_design_tokens resolves color tokens from styles + node fills", async () => {
    // Arrange
    const client = {
      getFileStyles: vi.fn(async () => ({ meta: { styles: [{ node_id: "1:1", name: "Brand/Primary", style_type: "FILL" }] } })),
      getNodes: vi.fn(async () => ({ nodes: { "1:1": { document: { fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 1, a: 1 } }] } } } })),
    };
    const { server, handlers } = fakeServer();
    registerTokenTools(server, client as any);
    // Act
    const res = await handlers.get_design_tokens({ fileKey: "K" });
    // Assert
    expect(client.getNodes).toHaveBeenCalledWith("K", ["1:1"], { depth: 1 });
    expect(parseResult(res)).toEqual([{ name: "Brand/Primary", type: "color", value: "#0000ff" }]);
  });

  it("get_variables errors when no file is configured", async () => {
    // Arrange
    const { server, handlers } = fakeServer();
    registerTokenTools(server, {} as any); // no variablesPath, no path arg
    // Act
    const res = await handlers.get_variables({});
    // Assert
    expect(parseResult(res).error).toMatch(/No variables file/);
  });

  it("get_variables errors when the configured file is missing on disk", async () => {
    // Arrange
    const { server, handlers } = fakeServer();
    registerTokenTools(server, {} as any, join(tmpDir(), "nope.json"));
    // Act
    const res = await handlers.get_variables({});
    // Assert
    expect(parseResult(res).error).toMatch(/No variables file/);
  });

  it("get_variables returns a parse error for invalid JSON", async () => {
    // Arrange
    const file = join(tmpDir(), "vars.json");
    writeFileSync(file, "{ not json");
    const { server, handlers } = fakeServer();
    registerTokenTools(server, {} as any);
    // Act
    const res = await handlers.get_variables({ path: file });
    // Assert
    expect(parseResult(res)).toMatchObject({ error: "Could not parse variables JSON.", file });
  });

  it("get_variables normalizes a valid DTCG file (path arg overrides env default)", async () => {
    // Arrange
    const file = join(tmpDir(), "vars.json");
    writeFileSync(file, JSON.stringify({ color: { primary: { $type: "color", $value: "#0000ff" } } }));
    const { server, handlers } = fakeServer();
    registerTokenTools(server, {} as any, "/unused/default.json");
    // Act
    const res = await handlers.get_variables({ path: file });
    // Assert
    expect(parseResult(res)).toMatchObject({ modes: ["default"] });
  });

  it("get_design_tokens returns [] when the styles response has no meta", async () => {
    // Arrange
    const client = { getFileStyles: vi.fn(async () => ({})) };
    const { server, handlers } = fakeServer();
    registerTokenTools(server, client as any);
    // Act
    const res = await handlers.get_design_tokens({ fileKey: "K" });
    // Assert
    expect(parseResult(res)).toEqual([]);
  });

  it("get_design_tokens skips styles whose node is missing from the nodes response", async () => {
    // Arrange
    const client = {
      getFileStyles: vi.fn(async () => ({ meta: { styles: [{ node_id: "1:1", name: "X", style_type: "FILL" }] } })),
      getNodes: vi.fn(async () => ({})), // no nodes map at all
    };
    const { server, handlers } = fakeServer();
    registerTokenTools(server, client as any);
    // Act
    const res = await handlers.get_design_tokens({ fileKey: "K" });
    // Assert
    expect(parseResult(res)).toEqual([]);
  });

  it("get_design_tokens tolerates a null node entry", async () => {
    // Arrange
    const client = {
      getFileStyles: vi.fn(async () => ({ meta: { styles: [{ node_id: "1:1", name: "X", style_type: "FILL" }] } })),
      getNodes: vi.fn(async () => ({ nodes: { "1:1": null } })), // null -> document undefined
    };
    const { server, handlers } = fakeServer();
    registerTokenTools(server, client as any);
    // Act
    const res = await handlers.get_design_tokens({ fileKey: "K" });
    // Assert
    expect(parseResult(res)).toEqual([]);
  });
});
