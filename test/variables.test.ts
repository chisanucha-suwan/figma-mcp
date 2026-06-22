import { describe, it, expect } from "vitest";
import { normalizeVariables } from "../src/variables.js";

describe("normalizeVariables (DTCG)", () => {
  it("normalizes W3C DTCG single-mode tokens", () => {
    // Arrange
    const dtcg = { color: { primary: { $type: "color", $value: "#0000ff" } } };
    // Act
    const out = normalizeVariables(dtcg);
    // Assert
    expect(out.modes).toEqual(["default"]);
    expect(out.tokens).toContainEqual({ name: "color.primary", type: "color", valuesByMode: { default: "#0000ff" }, alias: undefined });
  });

  it("captures a DTCG alias reference", () => {
    // Arrange
    const dtcg = { color: { brand: { $type: "color", $value: "{color.primary}" } } };
    // Act
    const out = normalizeVariables(dtcg);
    // Assert
    expect(out.tokens[0].alias).toBe("color.primary");
  });

  it("falls back to 'string' type and skips $-prefixed group metadata", () => {
    // Arrange
    const dtcg = { $description: "a group", space: { sm: { $value: "4px" } } };
    // Act
    const out = normalizeVariables(dtcg);
    // Assert
    expect(out.tokens).toEqual([{ name: "space.sm", type: "string", valuesByMode: { default: "4px" }, alias: undefined }]);
  });
});

describe("normalizeVariables (raw Figma export)", () => {
  it("flattens collections, maps mode names, and captures variable aliases", () => {
    // Arrange
    const raw = {
      collections: [
        {
          modes: [{ modeId: "m1", name: "Light" }, { modeId: "m2", name: "Dark" }],
          variables: [
            { name: "color/bg", resolvedType: "COLOR", valuesByMode: { m1: "#fff", m2: { type: "VARIABLE_ALIAS", id: "VariableID:1" } } },
            { name: "radius/sm", valuesByMode: { m1: 4 } }, // no resolvedType/type -> "string"
          ],
        },
      ],
    };
    // Act
    const out = normalizeVariables(raw);
    // Assert
    expect(out.modes).toEqual(["Light", "Dark"]);
    expect(out.tokens).toEqual([
      { name: "color/bg", type: "COLOR", valuesByMode: { Light: "#fff", Dark: { type: "VARIABLE_ALIAS", id: "VariableID:1" } }, alias: "VariableID:1" },
      { name: "radius/sm", type: "string", valuesByMode: { Light: 4 }, alias: undefined },
    ]);
  });

  it("resolves mode names via modeId/id/name fallbacks and keeps unmapped mode ids", () => {
    // Arrange
    const raw = {
      collections: [
        {
          modes: [{ id: "m3", name: "HC" }, { name: "Only" }], // no modeId -> id, then name
          variables: [{ name: "x", valuesByMode: { m3: 1, Only: 3, unknown: 2 } }],
        },
      ],
    };
    // Act
    const out = normalizeVariables(raw);
    // Assert
    expect(out.modes).toEqual(["HC", "Only"]);
    expect(out.tokens[0].valuesByMode).toEqual({ HC: 1, Only: 3, unknown: 2 });
  });

  it("returns empty modes/tokens for empty or partial raw exports", () => {
    // Act + Assert
    expect(normalizeVariables({})).toEqual({ modes: [], tokens: [] }); // no collections
    expect(normalizeVariables({ collections: [{}] })).toEqual({ modes: [], tokens: [] }); // no modes/variables
  });

  it("tolerates a variable with no valuesByMode", () => {
    // Arrange
    const raw = { collections: [{ modes: [{ modeId: "m1", name: "Light" }], variables: [{ name: "x", resolvedType: "FLOAT" }] }] };
    // Act
    const out = normalizeVariables(raw);
    // Assert
    expect(out.tokens).toEqual([{ name: "x", type: "FLOAT", valuesByMode: {}, alias: undefined }]);
  });
});
