import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("loads a valid ASCII token with defaults", () => {
    const c = loadConfig({ FIGMA_ACCESS_TOKEN: "figd_aBc123XyZ" } as NodeJS.ProcessEnv);
    expect(c.token).toBe("figd_aBc123XyZ");
    expect(c.baseUrl).toBe("https://api.figma.com");
    expect(c.codeConnectPath).toBe("./figma.code-connect.json");
  });

  it("throws when the token is missing", () => {
    expect(() => loadConfig({} as NodeJS.ProcessEnv)).toThrow(/not set/i);
  });

  it("trims surrounding whitespace from the token", () => {
    const c = loadConfig({ FIGMA_ACCESS_TOKEN: "  figd_token123\n" } as NodeJS.ProcessEnv);
    expect(c.token).toBe("figd_token123");
  });

  it("rejects a non-ASCII token (e.g. a leftover Thai placeholder)", () => {
    expect(() =>
      loadConfig({ FIGMA_ACCESS_TOKEN: "figd_ของจริง" } as NodeJS.ProcessEnv)
    ).toThrow(/non-ASCII/i);
  });

  it("rejects a token containing internal whitespace", () => {
    expect(() =>
      loadConfig({ FIGMA_ACCESS_TOKEN: "figd_ab cd" } as NodeJS.ProcessEnv)
    ).toThrow(/non-ASCII|whitespace/i);
  });
});
