import { describe, it, expect, vi } from "vitest";
import { registerComponentTools } from "../src/tools/components.js";
import { fakeServer, parseResult } from "./helpers.js";

describe("component tools", () => {
  it("get_components maps published components", async () => {
    // Arrange
    const client = {
      getFileComponents: vi.fn(async () => ({
        meta: { components: [{ key: "k1", name: "Btn", node_id: "1:1", containing_frame: { nodeId: "set1" } }] },
      })),
    };
    const { server, handlers } = fakeServer();
    registerComponentTools(server, client as any);
    // Act
    const res = await handlers.get_components({ fileKey: "K" });
    // Assert
    expect(parseResult(res)).toEqual([{ key: "k1", name: "Btn", nodeId: "1:1", componentSetId: "set1" }]);
  });

  it("get_components tolerates missing meta", async () => {
    // Arrange
    const client = { getFileComponents: vi.fn(async () => ({})) };
    const { server, handlers } = fakeServer();
    registerComponentTools(server, client as any);
    // Act
    const res = await handlers.get_components({ fileKey: "K" });
    // Assert
    expect(parseResult(res)).toEqual([]);
  });

  it("get_component_sets builds variant axes (containing_frame + component_set_id fallback + orphan skip)", async () => {
    // Arrange
    const client = {
      getFileComponentSets: vi.fn(async () => ({
        meta: {
          component_sets: [
            { key: "sk", name: "Button", node_id: "set1" },
            { key: "sk2", name: "Empty", node_id: "set2" }, // no axes -> {}
          ],
        },
      })),
      getFileComponents: vi.fn(async () => ({
        meta: {
          components: [
            { name: "Size=S, Tone=Dark", containing_frame: { nodeId: "set1" } },
            { name: "Size=L, Tone=Dark", component_set_id: "set1" }, // fallback id + existing axis
            { name: "Orphan=X" }, // no setId -> continue
          ],
        },
      })),
    };
    const { server, handlers } = fakeServer();
    registerComponentTools(server, client as any);
    // Act
    const res = await handlers.get_component_sets({ fileKey: "K" });
    // Assert
    expect(parseResult(res)).toEqual([
      { key: "sk", name: "Button", nodeId: "set1", variantAxes: { Size: ["S", "L"], Tone: ["Dark"] } },
      { key: "sk2", name: "Empty", nodeId: "set2", variantAxes: {} },
    ]);
  });

  it("get_components surfaces a stale-cache warning when the client served stale data", async () => {
    // Arrange — client reports a stale serve via consumeStaleNotice
    const client = {
      getFileComponents: vi.fn(async () => ({ meta: { components: [{ key: "k1", name: "Btn", node_id: "1:1" }] } })),
      consumeStaleNotice: () => ({ ageSeconds: 30 }),
    };
    const { server, handlers } = fakeServer();
    registerComponentTools(server, client as any);
    // Act
    const res = await handlers.get_components({ fileKey: "K" });
    // Assert — warning is prepended, JSON body still follows
    expect(res.content[0].text).toMatch(/STALE/i);
    expect(res.content[0].text).toContain('"key": "k1"');
  });

  it("get_component_sets tolerates missing meta on both responses", async () => {
    // Arrange
    const client = {
      getFileComponentSets: vi.fn(async () => ({})),
      getFileComponents: vi.fn(async () => ({})),
    };
    const { server, handlers } = fakeServer();
    registerComponentTools(server, client as any);
    // Act
    const res = await handlers.get_component_sets({ fileKey: "K" });
    // Assert
    expect(parseResult(res)).toEqual([]);
  });
});
