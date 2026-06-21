import { describe, it, expect } from "vitest";
import { stylesToTokens, rgbaToHex } from "../src/tokens.js";

describe("rgbaToHex", () => {
  it("converts 0..1 rgba to hex", () => {
    expect(rgbaToHex({ r: 1, g: 0, b: 0, a: 1 })).toBe("#ff0000");
  });
});

describe("stylesToTokens", () => {
  it("builds a color token from a fill style", () => {
    const styles = [{ node_id: "1:1", name: "Brand/Primary", style_type: "FILL" }];
    const nodes = { "1:1": { fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 1, a: 1 } }] } };
    const tokens = stylesToTokens(styles as any, nodes as any);
    expect(tokens).toContainEqual({ name: "Brand/Primary", type: "color", value: "#0000ff" });
  });
});
