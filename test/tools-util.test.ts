import { describe, it, expect } from "vitest";
import { text, staleNotice } from "../src/tools/util.js";

describe("text", () => {
  it("wraps a value as a pretty-printed MCP text result", () => {
    // Act
    const res = text({ a: 1 });
    // Assert
    expect(res).toEqual({ content: [{ type: "text", text: '{\n  "a": 1\n}' }] });
  });

  it("prepends a notice line above the JSON when one is given", () => {
    // Act
    const res = text({ a: 1 }, "⚠ stale");
    // Assert
    expect(res.content[0].text).toBe('⚠ stale\n\n{\n  "a": 1\n}');
  });

  it("omits the notice block when none is given", () => {
    // Act
    const res = text({ a: 1 }, undefined);
    // Assert
    expect(res.content[0].text).toBe('{\n  "a": 1\n}');
  });
});

describe("staleNotice", () => {
  it("formats and consumes a pending stale notice from the client", () => {
    // Arrange
    const client = { consumeStaleNotice: () => ({ ageSeconds: 42 }) };
    // Act
    const s = staleNotice(client);
    // Assert
    expect(s).toMatch(/stale/i);
    expect(s).toContain("42");
  });

  it("returns undefined when nothing is stale", () => {
    // Arrange
    const client = { consumeStaleNotice: () => undefined };
    // Act + Assert
    expect(staleNotice(client)).toBeUndefined();
  });
});
