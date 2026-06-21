import { describe, it, expect } from "vitest";
import { normalizeVariables } from "../src/variables.js";

describe("normalizeVariables", () => {
  it("normalizes W3C DTCG single-mode tokens", () => {
    const dtcg = { color: { primary: { $type: "color", $value: "#0000ff" } } };
    const out = normalizeVariables(dtcg);
    expect(out.modes).toEqual(["default"]);
    expect(out.tokens).toContainEqual({ name: "color.primary", type: "color", valuesByMode: { default: "#0000ff" }, alias: undefined });
  });

  it("captures a DTCG alias reference", () => {
    const dtcg = { color: { brand: { $type: "color", $value: "{color.primary}" } } };
    const out = normalizeVariables(dtcg);
    expect(out.tokens[0].alias).toBe("color.primary");
  });
});
