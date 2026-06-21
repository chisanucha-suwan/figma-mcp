import { describe, it, expect } from "vitest";
import { parseVariantName } from "../src/tools/components.js";

describe("parseVariantName", () => {
  it("parses multi-axis variant names", () => {
    expect(parseVariantName("DocType=Z100, PartnerType=Corporate")).toEqual({ DocType: "Z100", PartnerType: "Corporate" });
  });
});
