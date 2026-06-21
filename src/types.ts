// Code Connect mapping (keyed by Figma component `key`, global/stable)
export interface CodeConnectEntry {
  component: string;
  source: string;
  props?: Record<string, string>;      // figma prop name -> code prop name
  valueMap?: Record<string, Record<string, string>>; // prop -> {figma value -> code value}
  slots?: Record<string, string>;      // figma slot name -> code prop / "children"
}
export type CodeConnectMap = Record<string, CodeConnectEntry>;

// Normalized variables
export interface NormalizedToken {
  name: string;                         // dot path, e.g. "color.primary"
  type: string;                         // color | number | string | boolean
  valuesByMode: Record<string, unknown>;
  alias?: string;                       // referenced token name if this is an alias
}
export interface NormalizedVariables {
  modes: string[];
  tokens: NormalizedToken[];
}
