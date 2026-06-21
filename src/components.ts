export interface CollapseOptions {
  expandSlots?: boolean;
}

export function flattenComponentProperties(
  cp: Record<string, { type: string; value: unknown }> | undefined
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cp) return out;
  for (const [name, def] of Object.entries(cp)) {
    out[name] = String((def as any)?.value ?? "");
  }
  return out;
}

function overriddenIds(node: any): Set<string> {
  const ids = new Set<string>();
  for (const o of node.overrides ?? []) {
    if (o?.id) ids.add(o.id);
  }
  return ids;
}

export function collapseNode(node: any, opts: CollapseOptions = {}): any {
  if (node.type === "INSTANCE") {
    const collapsed: any = {
      id: node.id,
      name: node.name,
      type: node.type,
      componentId: node.componentId,
      componentProperties: flattenComponentProperties(node.componentProperties),
      collapsed: true,
    };
    if (opts.expandSlots) {
      const oIds = overriddenIds(node);
      const slot = (node.children ?? []).filter((c: any) => oIds.has(c.id));
      if (slot.length) {
        collapsed.slotContent = slot.map((c: any) => collapseNode(c, opts));
      }
    }
    return collapsed;
  }
  const out: any = { ...node };
  if (Array.isArray(node.children)) {
    out.children = node.children.map((c: any) => collapseNode(c, opts));
  }
  return out;
}
