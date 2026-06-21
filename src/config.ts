export interface Config {
  token: string;
  baseUrl: string;
  codeConnectPath: string;
  variablesPath?: string;
  outputDir: string;
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
  };
}
