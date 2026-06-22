import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadMap, saveMap, resolveCodeConnect } from "../src/code-connect.js";
import type { CodeConnectEntry } from "../src/types.js";

// Arrange (shared fixture)
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
    // Act
    const out = resolveCodeConnect(entry, { DocType: "Z100", PartnerType: "No Tax" });
    // Assert
    expect(out).toEqual({
      component: "FormValidated",
      source: "@/forms/form-validated",
      props: { docType: "z100", partnerType: "noTax" },
    });
  });
  it("passes through values with no valueMap entry", () => {
    // Act
    const out = resolveCodeConnect(entry, { DocType: "Z999", PartnerType: "Corporate" });
    // Assert
    expect(out.props).toEqual({ docType: "Z999", partnerType: "corporate" });
  });
  it("passes prop names through unchanged when the entry has no props/valueMap", () => {
    // Arrange
    const bare: CodeConnectEntry = { component: "Bare", source: "@/bare" };
    // Act
    const out = resolveCodeConnect(bare, { Foo: "Bar" });
    // Assert
    expect(out).toEqual({ component: "Bare", source: "@/bare", props: { Foo: "Bar" } });
  });
});

describe("loadMap / saveMap", () => {
  const dirs: string[] = [];
  function tmpFile() {
    const d = mkdtempSync(join(tmpdir(), "fmcp-map-"));
    dirs.push(d);
    return join(d, "map.json");
  }
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it("loadMap returns {} when the file does not exist", () => {
    // Act + Assert
    expect(loadMap(join(tmpdir(), "definitely-missing-figma-map.json"))).toEqual({});
  });

  it("saveMap writes JSON that loadMap reads back", () => {
    // Arrange
    const path = tmpFile();
    const map = { k1: entry };
    // Act
    saveMap(path, map);
    // Assert
    expect(readFileSync(path, "utf8").endsWith("\n")).toBe(true);
    expect(loadMap(path)).toEqual(map);
  });
});
