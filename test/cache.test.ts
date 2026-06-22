import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DiskCacheStore } from "../src/cache.js";

function withTempDir(fn: (dir: string) => Promise<void>) {
  return async () => {
    const dir = mkdtempSync(join(tmpdir(), "figc-"));
    try {
      await fn(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

describe("DiskCacheStore", () => {
  it(
    "returns undefined for a key that was never set",
    withTempDir(async (dir) => {
      // Arrange
      const store = new DiskCacheStore(dir);
      // Act + Assert
      expect(await store.get("https://api.figma.com/v1/files/MISSING")).toBeUndefined();
    })
  );

  it(
    "round-trips data and cachedAt through disk",
    withTempDir(async (dir) => {
      // Arrange
      const store = new DiskCacheStore(dir);
      const key = "https://api.figma.com/v1/files/K?depth=1";
      // Act
      await store.set(key, { data: { name: "F", children: [1, 2] }, cachedAt: 1234 });
      const entry = await store.get(key);
      // Assert
      expect(entry).toEqual({ data: { name: "F", children: [1, 2] }, cachedAt: 1234 });
    })
  );

  it(
    "isolates distinct keys so an unknown key is a clean miss",
    withTempDir(async (dir) => {
      // Arrange
      const store = new DiskCacheStore(dir);
      await store.set("https://api.figma.com/v1/files/A", { data: { a: 1 }, cachedAt: 1 });
      // Act + Assert — a different key does not collide with the one we set
      expect(await store.get("https://api.figma.com/v1/files/B")).toBeUndefined();
    })
  );
});
