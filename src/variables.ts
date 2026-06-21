import type { NormalizedToken, NormalizedVariables } from "./types.js";

type Json = Record<string, any>;

function isDtcg(json: Json): boolean {
  // DTCG nodes carry $value; detect by finding any $value in the tree.
  const stack = [json];
  while (stack.length) {
    const n = stack.pop();
    if (n && typeof n === "object") {
      if ("$value" in n) return true;
      for (const v of Object.values(n)) if (v && typeof v === "object") stack.push(v as Json);
    }
  }
  return false;
}

function dtcgAlias(value: unknown): string | undefined {
  if (typeof value === "string") {
    const m = value.match(/^\{(.+)\}$/);
    if (m) return m[1];
  }
  return undefined;
}

function flattenDtcg(json: Json): NormalizedVariables {
  const tokens: NormalizedToken[] = [];
  const walk = (node: Json, path: string[]) => {
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith("$")) continue;
      if (v && typeof v === "object" && "$value" in v) {
        const name = [...path, k].join(".");
        tokens.push({ name, type: (v as any).$type ?? "string", valuesByMode: { default: (v as any).$value }, alias: dtcgAlias((v as any).$value) });
      } else if (v && typeof v === "object") {
        walk(v as Json, [...path, k]);
      }
    }
  };
  walk(json, []);
  return { modes: ["default"], tokens };
}

// Raw Figma export: { collections: [{ modes:[{modeId,name}], variables:[{ name, resolvedType, valuesByMode }] }] }
function flattenRawFigma(json: Json): NormalizedVariables {
  const tokens: NormalizedToken[] = [];
  const modeSet = new Set<string>();
  for (const col of json.collections ?? []) {
    const modeNames: Record<string, string> = {};
    for (const m of col.modes ?? []) { modeNames[m.modeId ?? m.id ?? m.name] = m.name; modeSet.add(m.name); }
    for (const v of col.variables ?? []) {
      const valuesByMode: Record<string, unknown> = {};
      let alias: string | undefined;
      for (const [modeId, val] of Object.entries(v.valuesByMode ?? {})) {
        const modeName = modeNames[modeId] ?? modeId;
        if (val && typeof val === "object" && (val as any).type === "VARIABLE_ALIAS") alias = (val as any).id;
        valuesByMode[modeName] = val;
      }
      tokens.push({ name: v.name, type: v.resolvedType ?? v.type ?? "string", valuesByMode, alias });
    }
  }
  return { modes: [...modeSet], tokens };
}

export function normalizeVariables(json: Json): NormalizedVariables {
  return isDtcg(json) ? flattenDtcg(json) : flattenRawFigma(json);
}
