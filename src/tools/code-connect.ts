import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { saveMap } from "../code-connect.js";
import { text } from "./util.js";
import type { CodeConnectEntry, CodeConnectMap } from "../types.js";

// codeMap is shared in-memory; mutations are persisted to disk and reflected in get_node.
export function registerCodeConnectTools(server: McpServer, path: string, codeMap: CodeConnectMap) {
  server.registerTool(
    "get_code_connect_map",
    { title: "Get code connect map", description: "Return all Figma-component -> code-component mappings.", inputSchema: {} },
    async () => text(codeMap)
  );

  server.registerTool(
    "set_code_connect_map",
    {
      title: "Set a code connect mapping",
      description: "Add or update the mapping for one Figma component (keyed by its global component key).",
      inputSchema: {
        componentKey: z.string(),
        component: z.string(),
        source: z.string(),
        props: z.record(z.string()).optional(),
        valueMap: z.record(z.record(z.string())).optional(),
        slots: z.record(z.string()).optional(),
      },
    },
    async ({ componentKey, component, source, props, valueMap, slots }) => {
      const entry: CodeConnectEntry = { component, source, props, valueMap, slots };
      codeMap[componentKey] = entry;
      saveMap(path, codeMap);
      return text({ ok: true, componentKey, entry });
    }
  );

  server.registerTool(
    "delete_code_connect_map",
    { title: "Delete a code connect mapping", description: "Remove the mapping for one Figma component key.", inputSchema: { componentKey: z.string() } },
    async ({ componentKey }) => {
      const existed = componentKey in codeMap;
      delete codeMap[componentKey];
      saveMap(path, codeMap);
      return text({ ok: true, deleted: existed });
    }
  );
}
