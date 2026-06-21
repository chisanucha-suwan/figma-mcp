// Shared helper to wrap any JSON-serializable value as an MCP text tool result.
export function text(obj: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(obj, null, 2) }] };
}
