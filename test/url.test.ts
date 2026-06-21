import { describe, it, expect } from "vitest";
import { parseFigmaUrl } from "../src/url.js";

describe("parseFigmaUrl", () => {
  it("extracts fileKey and converts node-id dash to colon", () => {
    const r = parseFigmaUrl("https://www.figma.com/design/abc123/My-File?node-id=12-345");
    expect(r).toEqual({ fileKey: "abc123", nodeId: "12:345" });
  });
  it("handles legacy /file/ urls", () => {
    const r = parseFigmaUrl("https://figma.com/file/KEY9/Name");
    expect(r).toEqual({ fileKey: "KEY9", nodeId: undefined });
  });
  it("throws on a non-figma url", () => {
    expect(() => parseFigmaUrl("https://example.com/x")).toThrow(/figma/i);
  });
});
