import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface CacheEntry {
  data: unknown;
  cachedAt: number; // epoch ms when the response was stored
}

// A response cache keyed by full request URL. Implementations decide where the bytes live;
// freshness (TTL) is the FigmaClient's concern, so the store never expires entries itself —
// that lets the client serve a stale entry on a rate-limit (429).
export interface CacheStore {
  get(key: string): Promise<CacheEntry | undefined>;
  set(key: string, entry: CacheEntry): Promise<void>;
}

// Persists each entry as one JSON file named by the sha256 of the key, so arbitrary URLs
// (with `/`, `?`, `&`) map to safe, fixed-length, collision-resistant filenames. Surviving a
// process restart is the whole point: an MCP server is restarted per Claude Code session, so a
// memory-only cache would refetch (and risk the rate limit) every session.
export class DiskCacheStore implements CacheStore {
  constructor(private dir: string) {}

  private fileFor(key: string): string {
    const name = createHash("sha256").update(key).digest("hex");
    return join(this.dir, `${name}.json`);
  }

  async get(key: string): Promise<CacheEntry | undefined> {
    try {
      const raw = await readFile(this.fileFor(key), "utf8");
      const parsed = JSON.parse(raw) as CacheEntry;
      // A truncated/corrupt file should read as a miss, not poison every read.
      if (parsed && typeof parsed.cachedAt === "number") return parsed;
      return undefined;
    } catch {
      return undefined; // missing file or unparseable contents -> cache miss
    }
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const file = this.fileFor(key);
    // Write-then-rename so a reader never observes a half-written file (atomic on the same fs).
    const tmp = `${file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(entry), "utf8");
    await rename(tmp, file);
  }
}
