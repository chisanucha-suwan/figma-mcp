import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FigmaClient } from "../figma-client.js";
import { text } from "./util.js";
import { stylesToTokens } from "../tokens.js";
import { existsSync, readFileSync } from "node:fs";
import { normalizeVariables } from "../variables.js";

export function registerTokenTools(server: McpServer, client: FigmaClient, variablesPath?: string) {
  server.registerTool(
    "get_design_tokens",
    {
      title: "Get design tokens from styles",
      description: "Extract color/typography/effect tokens from a file's styles (works on all plans).",
      inputSchema: { fileKey: z.string() },
    },
    async ({ fileKey }) => {
      const stylesResp = (await client.getFileStyles(fileKey)) as any;
      const styles = stylesResp.meta?.styles ?? [];
      const ids = styles.map((s: any) => s.node_id);
      if (ids.length === 0) return text([]);
      const nodesResp = (await client.getNodes(fileKey, ids, { depth: 1 })) as any;
      const nodes: Record<string, any> = {};
      for (const id of Object.keys(nodesResp.nodes ?? {})) nodes[id] = nodesResp.nodes[id]?.document;
      return text(stylesToTokens(styles, nodes));
    }
  );

  server.registerTool(
    "get_variables",
    {
      title: "Get variables from an imported JSON export",
      description:
        "Read variables exported by a Figma plugin (W3C DTCG or raw Figma JSON) and normalize to " +
        "{ modes, tokens } with alias refs. Variables REST is Enterprise-only, so this uses a local file.",
      inputSchema: { path: z.string().optional() },
    },
    async ({ path }) => {
      const file = path ?? variablesPath;
      if (!file || !existsSync(file)) {
        return text({
          error: "No variables file found.",
          how: "Export variables with a Figma plugin (e.g. a Variables Import/Export plugin) to JSON, " +
            "then set FIGMA_VARIABLES_PATH or pass `path`. As a fallback use get_design_tokens (styles).",
        });
      }
      let json: any;
      try {
        json = JSON.parse(readFileSync(file, "utf8"));
      } catch (e) {
        return text({ error: "Could not parse variables JSON.", detail: (e as Error).message, file });
      }
      return text(normalizeVariables(json));
    }
  );
}
