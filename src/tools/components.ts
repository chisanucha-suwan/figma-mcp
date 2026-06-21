import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FigmaClient } from "../figma-client.js";
import { text } from "./util.js";

// "DocType=Z100, PartnerType=Corporate" -> { DocType: "Z100", PartnerType: "Corporate" }
export function parseVariantName(name: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of name.split(",")) {
    const [k, v] = pair.split("=").map((s) => s.trim());
    if (k && v) out[k] = v;
  }
  return out;
}

export function registerComponentTools(server: McpServer, client: FigmaClient) {
  server.registerTool(
    "get_components",
    { title: "List components", description: "List published components in a file (name, key, id).", inputSchema: { fileKey: z.string() } },
    async ({ fileKey }) => {
      const data = (await client.getFileComponents(fileKey)) as any;
      const comps = (data.meta?.components ?? []).map((c: any) => ({ key: c.key, name: c.name, nodeId: c.node_id, componentSetId: c.containing_frame?.nodeId }));
      return text(comps);
    }
  );

  server.registerTool(
    "get_component_sets",
    {
      title: "List component sets with variant axes",
      description: "List component sets and the catalog of variant axes (property name -> possible values).",
      inputSchema: { fileKey: z.string() },
    },
    async ({ fileKey }) => {
      const [sets, comps] = (await Promise.all([
        client.getFileComponentSets(fileKey),
        client.getFileComponents(fileKey),
      ])) as [any, any];
      const axesBySet: Record<string, Record<string, Set<string>>> = {};
      for (const c of comps.meta?.components ?? []) {
        const setId = c.containing_frame?.nodeId ?? c.component_set_id;
        if (!setId) continue;
        const axes = (axesBySet[setId] ??= {});
        for (const [k, v] of Object.entries(parseVariantName(c.name))) {
          (axes[k] ??= new Set()).add(v);
        }
      }
      const out = (sets.meta?.component_sets ?? []).map((s: any) => ({
        key: s.key,
        name: s.name,
        nodeId: s.node_id,
        variantAxes: Object.fromEntries(Object.entries(axesBySet[s.node_id] ?? {}).map(([k, set]) => [k, [...set]])),
      }));
      return text(out);
    }
  );
}
