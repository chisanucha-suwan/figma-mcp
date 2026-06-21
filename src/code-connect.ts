import { readFileSync, writeFileSync, existsSync } from "node:fs";
import type { CodeConnectEntry, CodeConnectMap } from "./types.js";

export function loadMap(path: string): CodeConnectMap {
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf8")) as CodeConnectMap;
}

export function saveMap(path: string, map: CodeConnectMap): void {
  writeFileSync(path, JSON.stringify(map, null, 2) + "\n", "utf8");
}

export interface ResolvedCodeConnect {
  component: string;
  source: string;
  props: Record<string, string>;
}

// componentProperties: figma prop name -> selected value (variant or text)
// v1 scope: only `props` + `valueMap` are applied here. `entry.slots` is intentionally
// NOT consumed — content slots are surfaced separately as `slotContent` by get_node, and
// INSTANCE_SWAP props flow through `props`. Wire slots in here if slot->prop codegen is needed.
export function resolveCodeConnect(
  entry: CodeConnectEntry,
  componentProperties: Record<string, string>
): ResolvedCodeConnect {
  const props: Record<string, string> = {};
  for (const [figmaProp, rawValue] of Object.entries(componentProperties)) {
    const codeProp = entry.props?.[figmaProp] ?? figmaProp;
    const mapped = entry.valueMap?.[figmaProp]?.[rawValue] ?? rawValue;
    props[codeProp] = mapped;
  }
  return { component: entry.component, source: entry.source, props };
}
