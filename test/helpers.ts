import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export type Handler = (args: any) => Promise<any> | any;

// Captures tools registered via server.registerTool so their handlers can be
// invoked directly in a unit test, without a live MCP transport.
export function fakeServer() {
  const handlers: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _schema: unknown, handler: Handler) => {
      handlers[name] = handler;
    },
  } as unknown as McpServer;
  return { server, handlers };
}

// Unwrap the JSON payload from an MCP text tool result.
export function parseResult(res: any) {
  return JSON.parse(res.content[0].text);
}
