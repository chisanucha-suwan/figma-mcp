import { describe, it, expect } from "vitest";
import { stylesToTokens, rgbaToHex } from "../src/tokens.js";

describe("rgbaToHex", () => {
  it("converts 0..1 rgba to hex", () => {
    // Act + Assert
    expect(rgbaToHex({ r: 1, g: 0, b: 0, a: 1 })).toBe("#ff0000");
  });
});

describe("stylesToTokens", () => {
  it("builds a color token from a fill style", () => {
    // Arrange
    const styles = [{ node_id: "1:1", name: "Brand/Primary", style_type: "FILL" }];
    const nodes = { "1:1": { fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 1, a: 1 } }] } };
    // Act
    const tokens = stylesToTokens(styles as any, nodes as any);
    // Assert
    expect(tokens).toContainEqual({ name: "Brand/Primary", type: "color", value: "#0000ff" });
  });

  it("builds typography and effect tokens, skipping missing nodes and color-less fills", () => {
    // Arrange
    const styles = [
      { node_id: "t1", name: "Body", style_type: "TEXT" },
      { node_id: "e1", name: "Shadow", style_type: "EFFECT" },
      { node_id: "missing", name: "Ghost", style_type: "FILL" }, // node absent -> skipped
      { node_id: "f0", name: "NoColor", style_type: "FILL" }, // fill without color -> skipped
    ];
    const nodes = {
      t1: { style: { fontFamily: "Inter", fontSize: 14, fontWeight: 400, lineHeightPx: 20 } },
      e1: { effects: [{ type: "DROP_SHADOW" }] },
      f0: { fills: [{ type: "SOLID" }] },
    };
    // Act
    const tokens = stylesToTokens(styles as any, nodes as any);
    // Assert
    expect(tokens).toEqual([
      { name: "Body", type: "typography", value: { fontFamily: "Inter", fontSize: 14, fontWeight: 400, lineHeight: 20 } },
      { name: "Shadow", type: "effect", value: [{ type: "DROP_SHADOW" }] },
    ]);
  });
});
