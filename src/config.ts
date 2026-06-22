export interface Config {
  token: string;
  baseUrl: string;
  codeConnectPath: string;
  variablesPath?: string;
  outputDir: string;
  maxRetries: number;
  baseDelayMs: number;
  cacheEnabled: boolean;
  cacheTtlMs: number;
  maxStaleMs: number;
  cacheDir: string;
}

// Parse an integer env var, falling back to `fallback` when unset, blank, or invalid
// (non-integer or below `min`). Keeps a bad/typo'd value from silently disabling retries.
function parseIntEnv(value: string | undefined, fallback: number, min: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const n = Number(value);
  return Number.isInteger(n) && n >= min ? n : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const token = env.FIGMA_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "FIGMA_ACCESS_TOKEN is not set. Create a personal access token at " +
        "https://www.figma.com/developers/api#access-tokens and set it in the MCP server env."
    );
  }
  // Figma tokens are printable ASCII (e.g. "figd_..."). A non-ASCII value — most often a
  // leftover placeholder pasted verbatim — cannot be sent in the X-Figma-Token HTTP header and
  // would otherwise fail later with an opaque "Cannot convert argument to a ByteString" error.
  if (/[^\x21-\x7E]/.test(token)) {
    throw new Error(
      "FIGMA_ACCESS_TOKEN contains non-ASCII or whitespace characters and is not a valid token. " +
        "Replace it with a real Figma personal access token (looks like 'figd_...') from " +
        "Figma → Settings → Security → Personal access tokens."
    );
  }
  return {
    token,
    baseUrl: env.FIGMA_BASE_URL ?? "https://api.figma.com",
    codeConnectPath: env.FIGMA_CODE_CONNECT_PATH ?? "./figma.code-connect.json",
    variablesPath: env.FIGMA_VARIABLES_PATH,
    outputDir: env.FIGMA_OUTPUT_DIR ?? "./figma-exports",
    // Retry tuning for Figma REST 429s. Defaults give ~1s,2s,4s,8s backoff before giving up.
    maxRetries: parseIntEnv(env.FIGMA_MAX_RETRIES, 5, 1),
    baseDelayMs: parseIntEnv(env.FIGMA_BASE_DELAY_MS, 1000, 0),
    // Response cache. On by default — repeated reads of the same file are the main rate-limit
    // driver, and a frozen file stays valid for the whole bulk-read pass. Set FIGMA_CACHE_ENABLED
    // to "false" to always hit the network (e.g. when you need real-time edits).
    cacheEnabled: env.FIGMA_CACHE_ENABLED?.trim().toLowerCase() !== "false",
    cacheTtlMs: parseIntEnv(env.FIGMA_CACHE_TTL_MS, 15 * 60 * 1000, 0),
    // Oldest a cached entry may be and still be served on a 429 (else the error surfaces). 24h.
    maxStaleMs: parseIntEnv(env.FIGMA_MAX_STALE_MS, 24 * 60 * 60 * 1000, 0),
    cacheDir: env.FIGMA_CACHE_DIR ?? "./.figma-cache",
  };
}
