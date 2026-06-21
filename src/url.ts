export interface ParsedFigmaUrl {
  fileKey: string;
  nodeId?: string;
}

export function parseFigmaUrl(url: string): ParsedFigmaUrl {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error(`Not a valid URL: ${url}`);
  }
  if (!/(^|\.)figma\.com$/.test(u.hostname)) {
    throw new Error(`Not a Figma URL: ${url}`);
  }
  const m = u.pathname.match(/\/(?:design|file)\/([A-Za-z0-9]+)/);
  if (!m) throw new Error(`No fileKey found in Figma URL: ${url}`);
  const rawNode = u.searchParams.get("node-id") ?? undefined;
  return {
    fileKey: m[1],
    nodeId: rawNode ? rawNode.replace(/-/g, ":") : undefined,
  };
}
