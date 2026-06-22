import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FigmaClient } from "../figma-client.js";
import { text, staleNotice } from "./util.js";
import { parseFigmaUrl } from "../url.js";

export function registerMiscTools(server: McpServer, client: FigmaClient) {
  server.registerTool(
    "parse_figma_url",
    { title: "Parse a Figma URL", description: "Extract { fileKey, nodeId } from a figma.com URL.", inputSchema: { url: z.string() } },
    async ({ url }) => text(parseFigmaUrl(url))
  );

  server.registerTool(
    "get_comments",
    { title: "Get file comments", description: "List comments in a Figma file (id, message, author handle, timestamps).", inputSchema: { fileKey: z.string() } },
    async ({ fileKey }) => {
      const resp = (await client.getComments(fileKey)) as any;
      const comments = (resp.comments ?? []).map((c: any) => ({
        id: c.id,
        message: c.message,
        user: c.user?.handle,
        created_at: c.created_at,
        resolved_at: c.resolved_at,
      }));
      return text({ comments }, staleNotice(client));
    }
  );
}
