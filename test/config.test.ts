import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("loads a valid ASCII token with defaults", () => {
    // Arrange + Act
    const c = loadConfig({ FIGMA_ACCESS_TOKEN: "figd_aBc123XyZ" } as NodeJS.ProcessEnv);
    // Assert
    expect(c.token).toBe("figd_aBc123XyZ");
    expect(c.baseUrl).toBe("https://api.figma.com");
    expect(c.codeConnectPath).toBe("./figma.code-connect.json");
    expect(c.maxRetries).toBe(5);
    expect(c.baseDelayMs).toBe(1000);
  });

  it("loads cache defaults", () => {
    // Arrange + Act
    const c = loadConfig({ FIGMA_ACCESS_TOKEN: "figd_token" } as NodeJS.ProcessEnv);
    // Assert
    expect(c.cacheEnabled).toBe(true);
    expect(c.cacheTtlMs).toBe(15 * 60 * 1000);
    expect(c.maxStaleMs).toBe(24 * 60 * 60 * 1000);
    expect(c.cacheDir).toBe("./.figma-cache");
  });

  it("reads cache tuning from env and disables caching on FIGMA_CACHE_ENABLED=false", () => {
    // Arrange + Act
    const c = loadConfig({
      FIGMA_ACCESS_TOKEN: "figd_token",
      FIGMA_CACHE_ENABLED: "false",
      FIGMA_CACHE_TTL_MS: "60000",
      FIGMA_MAX_STALE_MS: "120000",
      FIGMA_CACHE_DIR: "/tmp/figc",
    } as NodeJS.ProcessEnv);
    // Assert
    expect(c.cacheEnabled).toBe(false);
    expect(c.cacheTtlMs).toBe(60000);
    expect(c.maxStaleMs).toBe(120000);
    expect(c.cacheDir).toBe("/tmp/figc");
  });

  it("reads retry tuning from env", () => {
    // Arrange + Act
    const c = loadConfig({
      FIGMA_ACCESS_TOKEN: "figd_token",
      FIGMA_MAX_RETRIES: "8",
      FIGMA_BASE_DELAY_MS: "250",
    } as NodeJS.ProcessEnv);
    // Assert
    expect(c.maxRetries).toBe(8);
    expect(c.baseDelayMs).toBe(250);
  });

  it("falls back to defaults when retry tuning is invalid", () => {
    // Arrange + Act
    const c = loadConfig({
      FIGMA_ACCESS_TOKEN: "figd_token",
      FIGMA_MAX_RETRIES: "abc",
      FIGMA_BASE_DELAY_MS: "-5",
    } as NodeJS.ProcessEnv);
    // Assert
    expect(c.maxRetries).toBe(5);
    expect(c.baseDelayMs).toBe(1000);
  });

  it("throws when the token is missing", () => {
    // Act + Assert
    expect(() => loadConfig({} as NodeJS.ProcessEnv)).toThrow(/not set/i);
  });

  it("trims surrounding whitespace from the token", () => {
    // Arrange + Act
    const c = loadConfig({ FIGMA_ACCESS_TOKEN: "  figd_token123\n" } as NodeJS.ProcessEnv);
    // Assert
    expect(c.token).toBe("figd_token123");
  });

  it("rejects a non-ASCII token (e.g. a leftover Thai placeholder)", () => {
    // Act + Assert
    expect(() =>
      loadConfig({ FIGMA_ACCESS_TOKEN: "figd_ของจริง" } as NodeJS.ProcessEnv)
    ).toThrow(/non-ASCII/i);
  });

  it("rejects a token containing internal whitespace", () => {
    // Act + Assert
    expect(() =>
      loadConfig({ FIGMA_ACCESS_TOKEN: "figd_ab cd" } as NodeJS.ProcessEnv)
    ).toThrow(/non-ASCII|whitespace/i);
  });
});
