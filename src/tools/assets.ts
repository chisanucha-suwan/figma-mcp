import { z } from "zod";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FigmaClient } from "../figma-client.js";
import { text } from "./util.js";

export function registerAssetTools(server: McpServer, client: FigmaClient, outputDir: string) {
  server.registerTool(
    "export_image",
    {
      title: "Export node(s) as image",
      description: "Render node(s) to PNG/SVG/PDF and download to the output dir. Returns saved file paths (render URLs expire).",
      inputSchema: {
        fileKey: z.string(),
        ids: z.array(z.string()).min(1),
        format: z.enum(["png", "svg", "pdf"]).optional(),
        scale: z.number().min(0.1).max(4).optional(),
      },
    },
    async ({ fileKey, ids, format, scale }) => {
      const fmt = format ?? "png";
      const resp = await client.getImages(fileKey, ids, { format: fmt, scale: scale ?? 2 });
      if (resp.err) return text({ error: resp.err });
      mkdirSync(outputDir, { recursive: true });
      const saved: Record<string, string> = {};
      const errors: Record<string, string> = {};
      for (const [id, url] of Object.entries(resp.images)) {
        if (!url) {
          errors[id] = "no render url returned";
          continue;
        }
        try {
          const dl = await fetch(url);
          if (!dl.ok) {
            errors[id] = `download failed: HTTP ${dl.status}`;
            continue;
          }
          const bytes = Buffer.from(await dl.arrayBuffer());
          const file = join(outputDir, `${id.replace(/[:/]/g, "-")}.${fmt}`);
          writeFileSync(file, bytes);
          saved[id] = file;
        } catch (e) {
          errors[id] = (e as Error).message;
        }
      }
      return text(Object.keys(errors).length ? { saved, errors } : { saved });
    }
  );
}
