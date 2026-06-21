export interface RGBA { r: number; g: number; b: number; a: number; }

export function rgbaToHex(c: RGBA): string {
  const to = (n: number) => Math.round(n * 255).toString(16).padStart(2, "0");
  return `#${to(c.r)}${to(c.g)}${to(c.b)}`;
}

export interface DesignToken {
  name: string;
  type: "color" | "typography" | "effect";
  value: unknown;
}

export function stylesToTokens(
  styles: Array<{ node_id: string; name: string; style_type: string }>,
  nodes: Record<string, any>
): DesignToken[] {
  const tokens: DesignToken[] = [];
  for (const s of styles) {
    const node = nodes[s.node_id];
    if (!node) continue;
    if (s.style_type === "FILL" && node.fills?.[0]?.color) {
      tokens.push({ name: s.name, type: "color", value: rgbaToHex(node.fills[0].color) });
    } else if (s.style_type === "TEXT" && node.style) {
      tokens.push({
        name: s.name,
        type: "typography",
        value: {
          fontFamily: node.style.fontFamily,
          fontSize: node.style.fontSize,
          fontWeight: node.style.fontWeight,
          lineHeight: node.style.lineHeightPx,
        },
      });
    } else if (s.style_type === "EFFECT" && node.effects) {
      tokens.push({ name: s.name, type: "effect", value: node.effects });
    }
  }
  return tokens;
}
