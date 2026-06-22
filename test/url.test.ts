import { describe, it, expect } from "vitest";
import { parseFigmaUrl } from "../src/url.js";

describe("parseFigmaUrl", () => {
  it("extracts fileKey and converts node-id dash to colon", () => {
    // Act
    const r = parseFigmaUrl("https://www.figma.com/design/abc123/My-File?node-id=12-345");
    // Assert
    expect(r).toEqual({ fileKey: "abc123", nodeId: "12:345" });
  });
  it("handles legacy /file/ urls", () => {
    // Act
    const r = parseFigmaUrl("https://figma.com/file/KEY9/Name");
    // Assert
    expect(r).toEqual({ fileKey: "KEY9", nodeId: undefined });
  });
  it("throws on a non-figma url", () => {
    // Act + Assert
    expect(() => parseFigmaUrl("https://example.com/x")).toThrow(/figma/i);
  });
  it("throws on a malformed URL", () => {
    // Act + Assert
    expect(() => parseFigmaUrl("not a url")).toThrow(/valid URL/i);
  });
  it("throws when a figma URL has no fileKey", () => {
    // Act + Assert
    expect(() => parseFigmaUrl("https://www.figma.com/community/files")).toThrow(/No fileKey/i);
  });
});
