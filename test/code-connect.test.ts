import { describe, it, expect } from "vitest";
import { resolveCodeConnect } from "../src/code-connect.js";
import type { CodeConnectEntry } from "../src/types.js";

const entry: CodeConnectEntry = {
  component: "FormValidated",
  source: "@/forms/form-validated",
  props: { DocType: "docType", PartnerType: "partnerType" },
  valueMap: {
    DocType: { Z100: "z100", Z200: "z200" },
    PartnerType: { Corporate: "corporate", "No Tax": "noTax" },
  },
};

describe("resolveCodeConnect", () => {
  it("renames props and maps values", () => {
    const out = resolveCodeConnect(entry, { DocType: "Z100", PartnerType: "No Tax" });
    expect(out).toEqual({
      component: "FormValidated",
      source: "@/forms/form-validated",
      props: { docType: "z100", partnerType: "noTax" },
    });
  });
  it("passes through values with no valueMap entry", () => {
    const out = resolveCodeConnect(entry, { DocType: "Z999", PartnerType: "Corporate" });
    expect(out.props).toEqual({ docType: "Z999", partnerType: "corporate" });
  });
});
