import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerCodeConnectTools } from "../src/tools/code-connect.js";
import { fakeServer, parseResult } from "./helpers.js";

const dirs: string[] = [];
function mapPath() {
  const d = mkdtempSync(join(tmpdir(), "fmcp-cc-"));
  dirs.push(d);
  return join(d, "map.json");
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("code connect tools", () => {
  it("get_code_connect_map returns the in-memory map", async () => {
    // Arrange
    const map = { k: { component: "C", source: "@/c" } };
    const { server, handlers } = fakeServer();
    registerCodeConnectTools(server, mapPath(), map as any);
    // Act
    const res = await handlers.get_code_connect_map({});
    // Assert
    expect(parseResult(res)).toEqual(map);
  });

  it("set_code_connect_map adds an entry and persists it to disk", async () => {
    // Arrange
    const path = mapPath();
    const map: any = {};
    const { server, handlers } = fakeServer();
    registerCodeConnectTools(server, path, map);
    // Act
    const res = await handlers.set_code_connect_map({ componentKey: "k1", component: "Button", source: "@/button", props: { Size: "size" } });
    // Assert
    expect(parseResult(res)).toMatchObject({ ok: true, componentKey: "k1" });
    expect(map.k1).toMatchObject({ component: "Button", source: "@/button" });
    expect(JSON.parse(readFileSync(path, "utf8")).k1.component).toBe("Button");
  });

  it("delete_code_connect_map reports whether the key existed", async () => {
    // Arrange
    const path = mapPath();
    const map: any = { k1: { component: "B", source: "@/b" } };
    const { server, handlers } = fakeServer();
    registerCodeConnectTools(server, path, map);
    // Act
    const hit = await handlers.delete_code_connect_map({ componentKey: "k1" });
    const miss = await handlers.delete_code_connect_map({ componentKey: "nope" });
    // Assert
    expect(parseResult(hit)).toEqual({ ok: true, deleted: true });
    expect(parseResult(miss)).toEqual({ ok: true, deleted: false });
    expect(map.k1).toBeUndefined();
  });
});
