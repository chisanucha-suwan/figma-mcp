#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { FigmaClient } from "./figma-client.js";
import { loadMap } from "./code-connect.js";
import { registerReadTools } from "./tools/read.js";
import { registerCodeConnectTools } from "./tools/code-connect.js";
import { registerComponentTools } from "./tools/components.js";
import { registerTokenTools } from "./tools/tokens.js";
import { registerAssetTools } from "./tools/assets.js";
import { registerMiscTools } from "./tools/misc.js";

async function main() {
  const config = loadConfig();
  const client = new FigmaClient({ token: config.token, baseUrl: config.baseUrl });
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
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
