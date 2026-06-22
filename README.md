# figma-mcp

Read-only Figma MCP server for design→code. Talks to the Figma REST API with a personal access token (PAT) over stdio, for use with Claude Code and GitHub Copilot.

> **Unofficial.** This is a community project and is **not affiliated with, endorsed by, or sponsored by Figma, Inc.** "Figma" is a trademark of Figma, Inc., used here only to describe what this tool talks to. You provide your own Figma personal access token; none is bundled. Use is subject to Figma's [Developer / API Terms](https://www.figma.com/developers/api#terms).

## Tools

- `get_file_metadata` — pages + top-level child nodes (navigate first)
- `get_node` — node(s) by id; component instances are collapsed with variant props, slots, and a `codeConnect` block when mapped
- `get_components` / `get_component_sets` — components and variant-axis catalog
- `get_design_tokens` — color/typography/effect tokens from styles (all plans)
- `get_variables` — variables from an imported plugin JSON (DTCG or raw Figma)
- `get_code_connect_map` / `set_code_connect_map` / `delete_code_connect_map` — Figma↔code component mappings
- `export_image` — render node(s) to PNG/SVG/PDF, saved to disk
- `get_comments`, `parse_figma_url`

## Setup

1. `npm install && npm run build` — compiles `src/` → `build/index.js` (the server entrypoint).
2. Create a Figma personal access token (Figma → Settings → Security → Personal access tokens) with at least **File content: read** and **Comments: read** scopes. It looks like `figd_…`.
3. Connect it to your MCP client (below).

> The token goes in the `X-Figma-Token` HTTP header, so it must be plain ASCII. Pasting a placeholder (e.g. Thai text) fails fast with a clear error instead of an opaque `ByteString` crash.

## Connecting

### Claude Code — CLI (recommended)

Register once. Point the path at this repo's **`build/index.js`** (the entry file, not the repo folder):

```bash
claude mcp add figma -s user --env FIGMA_ACCESS_TOKEN=figd_your_token_here -- node "/absolute/path/to/figma-mcp/build/index.js"
```

One line, so it pastes cleanly into any shell (bash, zsh, PowerShell, cmd). Swap the path for this repo's `build/index.js` — on Windows use forward slashes, e.g. `D:/Personal Projects/figma-mcp/build/index.js`.

- `-s user` → available in every project. Use `-s local` to scope it to the current project only.
- Everything after `--` is the command Claude Code runs to launch the server.
- Add more env vars with extra `--env KEY=value` flags — `-e` is the short alias (see the table below).
- **Restart Claude Code** afterward so the tool registry reloads.

Verify:

```bash
claude mcp list
```

Expected: `figma · ✔ connected · 12 tools`.

### Claude Code / Copilot / Cursor — manual JSON

Edit the client's MCP config — Claude Code `.mcp.json`, GitHub Copilot `.vscode/mcp.json`, Cursor `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "figma": {
      "command": "node",
      "args": ["<abs-path>/build/index.js"],
      "env": {
        "FIGMA_ACCESS_TOKEN": "figd_...",
        "FIGMA_CODE_CONNECT_PATH": "./figma.code-connect.json",
        "FIGMA_VARIABLES_PATH": "./figma.variables.json"
      }
    }
  }
}
```

On Windows, use forward slashes (`D:/...`) or escaped backslashes (`D:\\...`) in JSON. Restart the client to pick it up.

### Environment variables

| Variable                  | Required | Default                     | Purpose                                          |
| ------------------------- | -------- | --------------------------- | ------------------------------------------------ |
| `FIGMA_ACCESS_TOKEN`      | **yes**  | —                           | Figma personal access token (`figd_…`, ASCII)    |
| `FIGMA_BASE_URL`          | no       | `https://api.figma.com`     | Override the API base URL                        |
| `FIGMA_CODE_CONNECT_PATH` | no       | `./figma.code-connect.json` | Where the local Code Connect map lives           |
| `FIGMA_VARIABLES_PATH`    | no       | —                           | Local variables JSON (DTCG or raw Figma export)  |
| `FIGMA_OUTPUT_DIR`        | no       | `./figma-exports`           | Output directory for `export_image`              |
| `FIGMA_MAX_RETRIES`       | no       | `5`                         | Retries after a `429` before giving up           |
| `FIGMA_BASE_DELAY_MS`     | no       | `1000`                      | Base backoff delay (ms); doubles each retry      |
| `FIGMA_CACHE_ENABLED`     | no       | `true`                      | Cache API responses on disk to avoid repeat `429`s |
| `FIGMA_CACHE_TTL_MS`      | no       | `900000`                    | How long a cached response stays fresh (15 min)  |
| `FIGMA_MAX_STALE_MS`      | no       | `86400000`                  | Max age a cached copy may be served on a `429` (24h) |
| `FIGMA_CACHE_DIR`         | no       | `./.figma-cache`            | On-disk cache dir (CWD-relative; git-ignored)    |

Provide these in your MCP client's `env` block (preferred — the token stays out
of the repo). For local standalone runs or integration tests you can instead copy
`.env.example` to `.env` and fill it in; it's loaded on startup via `dotenv` and
is git-ignored. `dotenv` never overrides a variable already set by the MCP client,
so an MCP-supplied token always wins.

### Rate limits & retries

This server has its **own** rate-limit quota (tied to your token), separate from
Figma's official Dev Mode MCP plugin — so it keeps working when the plugin is
throttled. Figma doesn't publish hard limits; it returns `429` with an optional
`Retry-After` header, which the client handles automatically:

- If `Retry-After` is present, it waits exactly that long.
- Otherwise it backs off exponentially: `FIGMA_BASE_DELAY_MS * 2^attempt`.
- It gives up after `FIGMA_MAX_RETRIES` and throws.

With the defaults (`5` / `1000`), a sustained `429` is retried after roughly
1s, 2s, 4s, 8s (~15s total) before failing. Raise `FIGMA_MAX_RETRIES` if you hit
limits often.

### Response cache

Repeated reads of the same file are the main `429` driver, so responses are cached
on disk (enabled by default). Three layers keep reads working under a rate limit:

1. **Fresh cache** — a request seen within `FIGMA_CACHE_TTL_MS` is served from
   `FIGMA_CACHE_DIR` with no API call. The cache survives restarts (the MCP server is
   restarted per client session), so a frozen file is fetched once and reused.
2. **Retry + backoff** — transient `429`s are retried as above.
3. **Serve-stale on `429`** — if a refetch is rate-limited but a cached copy exists and is
   within `FIGMA_MAX_STALE_MS` (24h), the stale copy is served, with a `⚠ STALE DATA …` warning
   prepended to the tool result (and logged to stderr). Beyond that age, a `FigmaError` is thrown
   whose message points to the official Figma MCP plugin as a fallback (it reads the open desktop
   file without consuming REST quota).

Notes:
- **Image renders (`export_image`) are never cached** — their URLs expire, so a cached copy
  could be a dead link.
- The cache dir is **CWD-relative**; the MCP client sets CWD, which is often not the project
  dir. The resolved absolute path is logged on startup — set `FIGMA_CACHE_DIR` to pin it.
- Force fresh data by setting a short `FIGMA_CACHE_TTL_MS`, or `FIGMA_CACHE_ENABLED=false`.

### Quick check

Give the client a Figma URL and ask it to parse, e.g.:

> Parse this Figma URL: `https://www.figma.com/design/<fileKey>/<name>?node-id=1-2`

It should call `parse_figma_url` and return `{ fileKey, nodeId }`.

### Troubleshooting

- **`FIGMA_ACCESS_TOKEN is not set`** — the env var didn't reach the server. Re-check the `-e` flag / `env` block, then restart the client.
- **`...contains non-ASCII or whitespace`** — you pasted a placeholder, not a real token. Replace with a `figd_…` value.
- **`0 tools` / not connected** — confirm `npm run build` succeeded and `args` points at `build/index.js`.
- **401 / 403 from Figma** — token expired or missing scope; regenerate it.

## Code Connect mapping

`figma.code-connect.json`, keyed by Figma component `key`:

```json
{
  "<figmaComponentKey>": {
    "component": "FormValidated",
    "source": "@/forms/form-validated",
    "props": { "DocType": "docType", "PartnerType": "partnerType" },
    "valueMap": { "DocType": { "Z100": "z100", "Z200": "z200" } },
    "slots": { "Icon": "icon", "Content": "children" }
  }
}
```

## Variables (non-Enterprise)

Figma's Variables REST API is Enterprise-only. On Free/Pro/Org, export variables with a community plugin to JSON (W3C DTCG or raw Figma) and point `FIGMA_VARIABLES_PATH` at it; `get_variables` normalizes it (modes + alias refs). Styles always work via `get_design_tokens`.

## Tests

- `npm test` — unit tests (no network).
- Integration tests run only when `FIGMA_ACCESS_TOKEN` and `FIGMA_TEST_FILE` are set:
  `FIGMA_ACCESS_TOKEN=figd_... FIGMA_TEST_FILE=<fileKey> npm test`

## Known v1 limitations

- `get_design_tokens` color tokens are RGB hex; the alpha channel is dropped.
- Component variant axes are derived by parsing variant names (`Axis=Value`); confirmed against real files via the integration test.
- Code Connect `slots` are stored but not yet applied by `get_node`'s `codeConnect` block — content slots are surfaced separately as `slotContent`, and INSTANCE_SWAP props flow through `props`.
- Some Figma REST response shapes (component-set linkage, style node values, instance overrides) are best-effort and validated by the integration test against a real file.

## License

[MIT](./LICENSE) © chisanucha_s

## Disclaimer

Not affiliated with, endorsed by, or sponsored by Figma, Inc. Provided "as is" without warranty. You are responsible for keeping your Figma access token secret and for complying with Figma's API terms and rate limits. Never commit your token or local Figma exports — `.env`, `figma.code-connect.json`, `figma.variables.json`, and `figma-exports/` are git-ignored by default.
