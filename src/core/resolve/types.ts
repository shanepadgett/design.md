import type { SourceSpan } from "../diagnostics/types.js";
import type { TokenGroupName } from "../sections/registry.js";
import type { TokenPrimitive } from "../token-yaml/types.js";

export type ResolvedTokenValue = TokenPrimitive | Record<string, TokenPrimitive>;

export interface ResolvedToken {
  path: string;
  group: TokenGroupName;
  value: ResolvedTokenValue;
  references: string[];
  span: SourceSpan;
}

export interface DesignSystem {
  name: string;
  themes: string[];
  defaultTheme?: string;
  tokens: Map<string, ResolvedToken>;
  containerPaths: Set<string>;
  tokenCountByGroup: Partial<Record<TokenGroupName, number>>;
}
