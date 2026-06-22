// Shared helper to wrap any JSON-serializable value as an MCP text tool result.
// An optional notice (e.g. a stale-cache warning) is prepended above the JSON so the
// model consuming the result sees it inline.
export function text(obj: unknown, notice?: string) {
  const json = JSON.stringify(obj, null, 2);
  return { content: [{ type: "text" as const, text: notice ? `${notice}\n\n${json}` : json }] };
}

interface StaleNoticeSource {
  // Optional: a client that doesn't track staleness simply yields no notice.
  consumeStaleNotice?(): { ageSeconds: number } | undefined;
}

// Pull the pending stale-cache notice off the client (consuming it) and format it for the user.
// Returns undefined when the last read was fresh. Call once, at a tool's return, after the
// client request(s) have resolved.
export function staleNotice(client: StaleNoticeSource): string | undefined {
  const n = client.consumeStaleNotice?.();
  if (!n) return undefined;
  return `⚠ STALE DATA: Figma was rate-limited; served a cached copy from ~${n.ageSeconds}s ago. It may be out of date — retry later or use the official Figma MCP plugin for live data.`;
}
