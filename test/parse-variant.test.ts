import { describe, it, expect } from "vitest";
import { parseVariantName } from "../src/tools/components.js";

describe("parseVariantName", () => {
  it("parses multi-axis variant names", () => {
    // Act + Assert
    expect(parseVariantName("DocType=Z100, PartnerType=Corporate")).toEqual({ DocType: "Z100", PartnerType: "Corporate" });
  });

  it("ignores fragments that are not key=value pairs", () => {
    // Act + Assert — "Bad" has no '=', so it is skipped; only the valid pair survives
    expect(parseVariantName("Bad, Size=L")).toEqual({ Size: "L" });
  });
});
