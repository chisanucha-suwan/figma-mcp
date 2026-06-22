#!/usr/bin/env node
import "dotenv/config";
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { FigmaClient } from "./figma-client.js";
import { DiskCacheStore } from "./cache.js";
import { loadMap } from "./code-connect.js";
import { registerReadTools } from "./tools/read.js";
import { registerCodeConnectTools } from "./tools/code-connect.js";
import { registerComponentTools } from "./tools/components.js";
import { registerTokenTools } from "./tools/tokens.js";
import { registerAssetTools } from "./tools/assets.js";
import { registerMiscTools } from "./tools/misc.js";

async function main() {
  const config = loadConfig();
  const client = new FigmaClient({
    token: config.token,
    baseUrl: config.baseUrl,
    maxRetries: config.maxRetries,
    baseDelayMs: config.baseDelayMs,
    // Disk-backed cache survives the per-session MCP restart; disable via FIGMA_CACHE_ENABLED=false.
    cacheStore: config.cacheEnabled ? new DiskCacheStore(config.cacheDir) : undefined,
    cacheTtlMs: config.cacheTtlMs,
    maxStaleMs: config.maxStaleMs,
  });
  const codeMap = loadMap(config.codeConnectPath);

  const server = new McpServer({ name: "figma-mcp", version: "0.1.0" });
  registerReadTools(server, client, codeMap);
  registerComponentTools(server, client);
  registerCodeConnectTools(server, config.codeConnectPath, codeMap);
  registerTokenTools(server, client, config.variablesPath);
  registerAssetTools(server, client, config.outputDir);
  registerMiscTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("figma-mcp running on stdio");
  // Cache dir is resolved against CWD (which the MCP client sets, often not the project dir).
  // Log the absolute path so it's clear where responses are cached. Set FIGMA_CACHE_DIR to pin it.
  if (config.cacheEnabled) {
    console.error(`figma-mcp cache: ${resolve(config.cacheDir)} (ttl ${config.cacheTtlMs}ms)`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
