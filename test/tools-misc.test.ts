import { describe, it, expect, vi } from "vitest";
import { registerMiscTools } from "../src/tools/misc.js";
import { fakeServer, parseResult } from "./helpers.js";

describe("misc tools", () => {
  it("parse_figma_url returns fileKey and nodeId", async () => {
    // Arrange
    const { server, handlers } = fakeServer();
    registerMiscTools(server, {} as any);
    // Act
    const res = await handlers.parse_figma_url({ url: "https://www.figma.com/design/abc123/X?node-id=1-2" });
    // Assert
    expect(parseResult(res)).toEqual({ fileKey: "abc123", nodeId: "1:2" });
  });

  it("get_comments maps comments and tolerates a missing author", async () => {
    // Arrange
    const client = {
      getComments: vi.fn(async () => ({
        comments: [
          { id: "c1", message: "hi", user: { handle: "ann" }, created_at: "t0", resolved_at: null },
          { id: "c2", message: "yo" }, // no user -> handle undefined
        ],
      })),
    };
    const { server, handlers } = fakeServer();
    registerMiscTools(server, client as any);
    // Act
    const res = await handlers.get_comments({ fileKey: "K" });
    // Assert
    expect(client.getComments).toHaveBeenCalledWith("K");
    const out = parseResult(res);
    expect(out.comments[0]).toEqual({ id: "c1", message: "hi", user: "ann", created_at: "t0", resolved_at: null });
    expect(out.comments[1]).toEqual({ id: "c2", message: "yo" }); // undefined fields dropped by JSON
  });

  it("get_comments tolerates a response with no comments array", async () => {
    // Arrange
    const client = { getComments: vi.fn(async () => ({})) };
    const { server, handlers } = fakeServer();
    registerMiscTools(server, client as any);
    // Act
    const res = await handlers.get_comments({ fileKey: "K" });
    // Assert
    expect(parseResult(res)).toEqual({ comments: [] });
  });
});
