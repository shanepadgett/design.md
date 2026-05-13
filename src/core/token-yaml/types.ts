import type { Diagnostic, SourceSpan } from "../diagnostics/types.js";

export type TokenPrimitive = string | number;

export type TokenNode = TokenList | TokenMap | TokenScalar;

export interface TokenScalar {
  kind: "scalar";
  valueType: "number" | "string";
  value: TokenPrimitive;
  raw: string;
  span: SourceSpan;
}

export interface TokenList {
  kind: "list";
  items: TokenScalar[];
  span: SourceSpan;
}

export interface TokenMapEntry {
  key: string;
  quotedKey: boolean;
  keySpan: SourceSpan;
  value: TokenNode;
}

export interface TokenMap {
  kind: "map";
  entries: TokenMapEntry[];
  span: SourceSpan;
}

export interface ParsedTokenYaml {
  root: TokenMap;
  diagnostics: Diagnostic[];
}
