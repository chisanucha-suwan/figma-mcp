import { describe, it, expect, vi } from "vitest";
import { registerReadTools } from "../src/tools/read.js";
import { fakeServer, parseResult } from "./helpers.js";

describe("read tools", () => {
  it("get_file_metadata returns pages with their top-level children", async () => {
    // Arrange
    const client = {
      getFile: vi.fn(async () => ({
        name: "F",
        lastModified: "t",
        document: {
          children: [
            { id: "0:1", name: "Page 1", type: "CANVAS", children: [{ id: "1:1", name: "Frame", type: "FRAME" }] },
            { id: "0:2", name: "Page 2", type: "CANVAS" }, // no children -> []
          ],
        },
      })),
    };
    const { server, handlers } = fakeServer();
    registerReadTools(server, client as any, {});
    // Act
    const res = await handlers.get_file_metadata({ fileKey: "K" });
    // Assert
    expect(client.getFile).toHaveBeenCalledWith("K", { depth: 2 });
    expect(parseResult(res)).toEqual({
      name: "F",
      lastModified: "t",
      pages: [
        { id: "0:1", name: "Page 1", type: "CANVAS", children: [{ id: "1:1", name: "Frame", type: "FRAME" }] },
        { id: "0:2", name: "Page 2", type: "CANVAS", children: [] },
      ],
    });
  });

  it("get_file_metadata tolerates a file with no document/children", async () => {
    // Arrange
    const client = { getFile: vi.fn(async () => ({ name: "F" })) };
    const { server, handlers } = fakeServer();
    registerReadTools(server, client as any, {});
    // Act
    const res = await handlers.get_file_metadata({ fileKey: "K" });
    // Assert
    expect(parseResult(res)).toEqual({ name: "F", pages: [] });
  });

  it("get_node returns an error payload when the API reports err", async () => {
    // Arrange
    const client = { getNodes: vi.fn(async () => ({ err: "boom" })) };
    const { server, handlers } = fakeServer();
    registerReadTools(server, client as any, {});
    // Act
    const res = await handlers.get_node({ fileKey: "K", ids: ["1:1"] });
    // Assert
    expect(parseResult(res)).toEqual({ error: "boom" });
  });

  it("get_node returns an empty object when the response carries no nodes", async () => {
    // Arrange
    const client = { getNodes: vi.fn(async () => ({})) }; // no err, no nodes
    const { server, handlers } = fakeServer();
    registerReadTools(server, client as any, {});
    // Act
    const res = await handlers.get_node({ fileKey: "K", ids: ["1:1"] });
    // Assert
    expect(parseResult(res)).toEqual({});
  });

  it("get_node collapses a mapped instance, attaches codeConnect, recurses slots, flags missing nodes", async () => {
    // Arrange
    const codeMap = { compKey: { component: "Button", source: "@/button", props: { Size: "size" }, valueMap: { Size: { S: "sm" } } } };
    const client = {
      getNodes: vi.fn(async () => ({
        nodes: {
          "1:1": {
            components: { "9:9": { key: "compKey" } },
            document: {
              id: "1:1",
              type: "INSTANCE",
              name: "Button",
              componentId: "9:9",
              componentProperties: { Size: { type: "VARIANT", value: "S" } },
              overrides: [{ id: "s1", overriddenFields: ["characters"] }],
              children: [{ id: "s1", type: "TEXT", name: "label", characters: "Hi" }],
            },
          },
          "2:2": { document: undefined }, // node-not-found branch
          "3:3": null, // null entry -> exercises optional-chaining guards
        },
      })),
    };
    const { server, handlers } = fakeServer();
    registerReadTools(server, client as any, codeMap as any);
    // Act
    const res = await handlers.get_node({ fileKey: "K", ids: ["1:1", "2:2"], depth: 2, expandSlots: true });
    // Assert
    expect(client.getNodes).toHaveBeenCalledWith("K", ["1:1", "2:2"], { depth: 2 });
    const out = parseResult(res);
    expect(out["1:1"]).toMatchObject({
      type: "INSTANCE",
      collapsed: true,
      codeConnect: { component: "Button", source: "@/button", props: { size: "sm" } },
    });
    expect(out["1:1"].slotContent).toHaveLength(1); // overridden child surfaced + walked
    expect(out["2:2"]).toEqual({ error: "node not found" });
    expect(out["3:3"]).toEqual({ error: "node not found" });
  });

  it("get_node defaults depth/expandSlots and skips codeConnect for unmapped instances inside a container", async () => {
    // Arrange
    const client = {
      getNodes: vi.fn(async () => ({
        nodes: {
          f: {
            document: {
              id: "f",
              type: "FRAME",
              name: "Frame",
              children: [{ id: "i", type: "INSTANCE", name: "X", componentId: "9:9", componentProperties: {}, overrides: [], children: [] }],
            },
          },
        },
      })),
    };
    const { server, handlers } = fakeServer();
    registerReadTools(server, client as any, {});
    // Act
    const res = await handlers.get_node({ fileKey: "K", ids: ["f"] });
    // Assert
    expect(client.getNodes).toHaveBeenCalledWith("K", ["f"], { depth: 3 });
    const out = parseResult(res);
    expect(out.f.children[0]).toMatchObject({ type: "INSTANCE", collapsed: true });
    expect(out.f.children[0].codeConnect).toBeUndefined();
  });
});
