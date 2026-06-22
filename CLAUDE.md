# figma-mcp — working notes for Claude

Read-only Figma MCP server (custom). Talks to the **Figma REST API** via `src/figma-client.ts`.

## Rate limits (Figma Starter plan)

The REST rate limit is **cost-based per access token**. Full-file reads (`/v1/files/:key`)
are the most expensive and the main driver of 429s. Three layers defend against this:

1. **Disk cache** (`src/cache.ts`, `DiskCacheStore`) — repeated reads of the same URL are served
   from `./.figma-cache` without hitting the API. Fresh for `FIGMA_CACHE_TTL_MS` (default 15 min).
2. **Retry + backoff** (`FigmaClient.fetchWithRetry`) — transient 429s are retried automatically.
3. **Serve-stale on 429** — if a refetch is rate-limited but a (stale) cached copy exists and is
   within `FIGMA_MAX_STALE_MS` (default 24h), the stale copy is served. A `⚠ STALE DATA …` line is
   **prepended to the tool result** (so the model sees it inline) and a warning is logged to
   stderr. Beyond that age the rate-limit error surfaces instead.

   Image renders (`/v1/images`) are never cached, since their URLs expire.

## Fallback when the REST API is rate-limited with no cache

If a tool throws a `FigmaError` whose message says **"rate limited"** and **"fall back to the
official Figma MCP plugin"**, that means layers 1–3 could not satisfy the read. In that case:

- **Switch to the official Figma MCP plugin** tools (`mcp__plugin_figma_figma__*`) for that read.
  Those run through the Figma **desktop app** and do **not** consume REST quota.
- Caveat: the official plugin reads the **file currently open in Figma desktop / the current
  selection** — it cannot answer an arbitrary `fileKey`. Make sure the right file is open.
- For design **variables/tokens**, prefer the official plugin or a local export
  (`FIGMA_VARIABLES_PATH`): the Variables REST endpoint is **Enterprise-only**.

## Forcing fresh data

Cache is on by default. To bypass it: pass `{ refresh: true }` to `client.getFile(...)`, set a
short `FIGMA_CACHE_TTL_MS`, or set `FIGMA_CACHE_ENABLED=false`.

## Tests

`npm test` (vitest). New behaviour is covered in `test/figma-client.test.ts` (caching) and
`test/cache.test.ts` (disk store). TDD: write the failing test first.
