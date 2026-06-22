import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FigmaClient } from "../figma-client.js";
import { text, staleNotice } from "./util.js";
import { collapseNode } from "../components.js";
import { resolveCodeConnect } from "../code-connect.js";
import type { CodeConnectMap } from "../types.js";

export function registerReadTools(server: McpServer, client: FigmaClient, codeMap: CodeConnectMap) {
  server.registerTool(
    "get_file_metadata",
    {
      title: "Get Figma file metadata",
      description:
        "Summary navigation tree: each page and its top-level child nodes only " +
        "(id, name, type — e.g. FRAME, SECTION, COMPONENT_SET). Use this first to find a node, " +
        "then call get_node with that id. Never returns deep trees.",
      inputSchema: { fileKey: z.string() },
    },
    async ({ fileKey }) => {
      const file = (await client.getFile(fileKey, { depth: 2 })) as any;
      const pages = (file.document?.children ?? []).map((page: any) => ({
        id: page.id,
        name: page.name,
        type: page.type,
        children: (page.children ?? []).map((f: any) => ({ id: f.id, name: f.name, type: f.type })),
      }));
      return text({ name: file.name, lastModified: file.lastModified, pages }, staleNotice(client));
    }
  );

  server.registerTool(
    "get_node",
    {
      title: "Get Figma node(s) by id",
      description:
        "Fetch node(s) by id (obtain ids from get_file_metadata first). Component instances are " +
        "collapsed (internal subtree dropped) with variant/props surfaced; a codeConnect block is " +
        "attached when a mapping exists. expandSlots (default true) surfaces overridden slot children. " +
        "Keep depth small to control response size.",
      inputSchema: {
        fileKey: z.string(),
        ids: z.array(z.string()).min(1),
        depth: z.number().int().min(1).max(6).optional(),
        expandSlots: z.boolean().optional(),
      },
    },
    async ({ fileKey, ids, depth, expandSlots }) => {
      const data = (await client.getNodes(fileKey, ids, { depth: depth ?? 3 })) as any;
      if (data.err) return text({ error: data.err });
      const componentsById: Record<string, any> = {};
      for (const id of Object.keys(data.nodes ?? {})) {
        Object.assign(componentsById, data.nodes[id]?.components ?? {});
      }
      const out: Record<string, unknown> = {};
      for (const id of Object.keys(data.nodes ?? {})) {
        const entry = data.nodes[id];
        if (!entry?.document) {
          out[id] = { error: "node not found" };
          continue;
        }
        const collapsed = collapseNode(entry.document, { expandSlots: expandSlots ?? true });
        attachCodeConnect(collapsed, componentsById, codeMap);
        out[id] = collapsed;
      }
      return text(out, staleNotice(client));
    }
  );
}

// Walk a collapsed tree; for each collapsed instance whose main-component key is in the map,
// attach a resolved codeConnect block.
function attachCodeConnect(node: any, componentsById: Record<string, any>, codeMap: CodeConnectMap) {
  if (node.type === "INSTANCE" && node.componentId) {
    const key = componentsById[node.componentId]?.key;
    const entry = key ? codeMap[key] : undefined;
    // collapseNode always sets componentProperties (at least {}), so no fallback is needed here.
    if (entry) node.codeConnect = resolveCodeConnect(entry, node.componentProperties);
    for (const c of node.slotContent ?? []) attachCodeConnect(c, componentsById, codeMap);
    return;
  }
  for (const c of node.children ?? []) attachCodeConnect(c, componentsById, codeMap);
}
