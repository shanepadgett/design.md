import type { Diagnostic } from "../diagnostics/types.js";
import type { DesignDocument } from "../document/types.js";
import { spanFromOffsets, type SourceLine } from "../source/source-file.js";
import type { ParsedSectionToken } from "../sections/tokens.js";
import type { TokenGroupName } from "../sections/registry.js";
import type {
  TokenMap,
  TokenMapEntry,
  TokenNode,
  TokenPrimitive,
  TokenScalar,
} from "../token-yaml/types.js";
import { validateContrast } from "./contrast.js";
import type { DesignSystem, ResolvedToken } from "./types.js";

interface ThemeConfig {
  themes: string[];
  defaultTheme?: string;
}

interface ResolveState {
  document: DesignDocument;
  diagnostics: Diagnostic[];
  themes: string[];
  tokens: Map<string, ResolvedToken>;
  containerPaths: Set<string>;
  tokenCountByGroup: Partial<Record<TokenGroupName, number>>;
}

const referencePattern = /\{([^{}]+)\}/g;

export interface ResolveResult {
  designSystem: DesignSystem;
  diagnostics: Diagnostic[];
}

export function resolveDesignSystem(
  document: DesignDocument,
  sectionTokens: readonly ParsedSectionToken[],
): ResolveResult {
  const diagnostics: Diagnostic[] = [];
  const themeConfig = readThemeConfig(sectionTokens, diagnostics);
  const state: ResolveState = {
    document,
    diagnostics,
    themes: themeConfig.themes,
    tokens: new Map(),
    containerPaths: new Set(),
    tokenCountByGroup: {},
  };

  for (const sectionToken of sectionTokens) {
    const group = sectionToken.definition.group;
    if (group === undefined || group === "metadata") {
      continue;
    }

    flattenNode(state, group, [], sectionToken.parsed.root);
  }

  validateTokenReferences(state);
  validateProseReferencesAndValues(state);
  diagnostics.push(...validateContrast(state.tokens, state.themes));

  const designSystem: DesignSystem = {
    name: document.title?.text ?? "",
    themes: themeConfig.themes,
    tokens: state.tokens,
    containerPaths: state.containerPaths,
    tokenCountByGroup: state.tokenCountByGroup,
  };

  if (themeConfig.defaultTheme !== undefined) {
    designSystem.defaultTheme = themeConfig.defaultTheme;
  }

  return { designSystem, diagnostics };
}

function readThemeConfig(
  sectionTokens: readonly ParsedSectionToken[],
  diagnostics: Diagnostic[],
): ThemeConfig {
  const metadata = sectionTokens.find(
    (sectionToken) => sectionToken.definition.group === "metadata",
  );
  if (metadata === undefined) {
    return { themes: [] };
  }

  const themesEntry = findEntry(metadata.parsed.root, "themes");
  const defaultThemeEntry = findEntry(metadata.parsed.root, "defaultTheme");
  const themes: string[] = [];

  if (themesEntry !== undefined) {
    if (themesEntry.value.kind !== "list") {
      diagnostics.push({
        severity: "error",
        rule: "invalid-theme-declaration",
        path: "Metadata.themes",
        message: "Metadata.themes must be a scalar list.",
        span: themesEntry.value.span,
      });
    } else {
      const seen = new Set<string>();

      for (const item of themesEntry.value.items) {
        if (item.valueType !== "string") {
          diagnostics.push({
            severity: "error",
            rule: "invalid-theme-name",
            path: "Metadata.themes",
            message: "Theme names must be strings.",
            span: item.span,
          });
          continue;
        }

        const themeName = item.value;
        if (typeof themeName !== "string") {
          continue;
        }

        if (!isKebabCase(themeName)) {
          diagnostics.push({
            severity: "error",
            rule: "invalid-theme-name",
            path: "Metadata.themes",
            message: `Theme '${themeName}' must be kebab-case.`,
            span: item.span,
          });
        }

        if (seen.has(themeName)) {
          diagnostics.push({
            severity: "error",
            rule: "duplicate-theme",
            path: "Metadata.themes",
            message: `Duplicate theme '${themeName}'.`,
            span: item.span,
          });
        } else {
          seen.add(themeName);
          themes.push(themeName);
        }
      }
    }
  }

  let defaultTheme: string | undefined;
  if (defaultThemeEntry !== undefined) {
    if (defaultThemeEntry.value.kind !== "scalar" || defaultThemeEntry.value.valueType !== "string") {
      diagnostics.push({
        severity: "error",
        rule: "invalid-default-theme",
        path: "Metadata.defaultTheme",
        message: "Metadata.defaultTheme must be a string.",
        span: defaultThemeEntry.value.span,
      });
    } else {
      defaultTheme = String(defaultThemeEntry.value.value);
    }
  }

  if (defaultTheme !== undefined && !themes.includes(defaultTheme)) {
    const diagnostic: Diagnostic = {
      severity: "error",
      rule: "default-theme-not-found",
      path: "Metadata.defaultTheme",
      message: `Default theme '${defaultTheme}' is not declared in Metadata.themes.`,
    };

    if (defaultThemeEntry !== undefined) {
      diagnostic.span = defaultThemeEntry.value.span;
    }

    diagnostics.push(diagnostic);
  }

  const config: ThemeConfig = { themes };
  if (defaultTheme !== undefined) {
    config.defaultTheme = defaultTheme;
  }

  return config;
}

function flattenNode(
  state: ResolveState,
  group: TokenGroupName,
  segments: string[],
  node: TokenNode,
): void {
  const currentPath = [group, ...segments].join(".");

  if (node.kind === "scalar") {
    addToken(state, group, currentPath, node.value, node, [node]);
    return;
  }

  state.containerPaths.add(currentPath);

  if (node.kind === "list") {
    return;
  }

  const themedValue = readThemedValue(state, currentPath, node);
  if (themedValue !== undefined) {
    addToken(state, group, currentPath, themedValue.value, node, themedValue.scalars);
    return;
  }

  for (const entry of node.entries) {
    flattenNode(state, group, [...segments, entry.key], entry.value);
  }
}

function readThemedValue(
  state: ResolveState,
  path: string,
  node: TokenMap,
): { value: Record<string, TokenPrimitive>; scalars: TokenScalar[] } | undefined {
  if (state.themes.length === 0 || node.entries.length === 0) {
    return undefined;
  }

  const keys = node.entries.map((entry) => entry.key);
  const hasThemeKey = keys.some((key) => state.themes.includes(key));
  const exactThemeMap = keys.length === state.themes.length
    && state.themes.every((theme) => keys.includes(theme));

  if (!hasThemeKey) {
    return undefined;
  }

  if (!exactThemeMap) {
    state.diagnostics.push({
      severity: "error",
      rule: "partial-theme-map",
      path,
      message: `Theme map '${path}' must define exactly all declared themes.`,
      span: node.span,
    });
    return undefined;
  }

  const value: Record<string, TokenPrimitive> = {};
  const scalars: TokenScalar[] = [];

  for (const entry of node.entries) {
    if (entry.value.kind !== "scalar") {
      state.diagnostics.push({
        severity: "error",
        rule: "themed-value-type",
        path,
        message: `Theme '${entry.key}' in '${path}' must resolve to a primitive token value.`,
        span: entry.value.span,
      });
      continue;
    }

    value[entry.key] = entry.value.value;
    scalars.push(entry.value);
  }

  return { value, scalars };
}

function addToken(
  state: ResolveState,
  group: TokenGroupName,
  path: string,
  value: TokenPrimitive | Record<string, TokenPrimitive>,
  node: TokenNode,
  scalars: readonly TokenScalar[],
): void {
  const references = scalars.flatMap((scalar) =>
    typeof scalar.value === "string" ? collectReferences(scalar.value) : [],
  );

  state.tokens.set(path, {
    path,
    group,
    value,
    references,
    span: node.span,
  });

  state.tokenCountByGroup[group] = (state.tokenCountByGroup[group] ?? 0) + 1;
}

function validateTokenReferences(state: ResolveState): void {
  for (const token of state.tokens.values()) {
    for (const reference of token.references) {
      validateReferencePath(state, reference, token.span, token.path);
    }
  }

  validateReferenceCycles(state);
}

function validateReferencePath(
  state: ResolveState,
  reference: string,
  span: ResolvedToken["span"],
  ownerPath?: string,
): void {
  if (state.tokens.has(reference)) {
    return;
  }

  if (state.containerPaths.has(reference)) {
    const diagnostic: Diagnostic = {
      severity: "error",
      rule: "non-primitive-reference",
      message: `Reference '{${reference}}' resolves to a non-primitive token value.`,
      span,
    };

    if (ownerPath !== undefined) {
      diagnostic.path = ownerPath;
    }

    state.diagnostics.push(diagnostic);
    return;
  }

  const diagnostic: Diagnostic = {
    severity: "error",
    rule: "missing-reference",
    message: `Reference '{${reference}}' does not resolve to a token path.`,
    span,
  };

  if (ownerPath !== undefined) {
    diagnostic.path = ownerPath;
  }

  state.diagnostics.push(diagnostic);
}

function validateReferenceCycles(state: ResolveState): void {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (path: string, trail: string[]): void => {
    if (visited.has(path)) {
      return;
    }

    if (visiting.has(path)) {
      const token = state.tokens.get(path);
      const diagnostic: Diagnostic = {
        severity: "error",
        rule: "reference-cycle",
        path,
        message: `Reference cycle detected: ${[...trail, path].join(" -> ")}.`,
      };

      if (token !== undefined) {
        diagnostic.span = token.span;
      }

      state.diagnostics.push(diagnostic);
      return;
    }

    const token = state.tokens.get(path);
    if (token === undefined) {
      return;
    }

    visiting.add(path);
    for (const reference of token.references) {
      if (state.tokens.has(reference)) {
        visit(reference, [...trail, path]);
      }
    }
    visiting.delete(path);
    visited.add(path);
  };

  for (const path of state.tokens.keys()) {
    visit(path, []);
  }
}

function validateProseReferencesAndValues(state: ResolveState): void {
  for (const section of state.document.sections) {
    let insideFence = false;

    for (const line of section.lines) {
      if (line.text.trimEnd().startsWith("```")) {
        insideFence = !insideFence;
        continue;
      }

      if (insideFence || line.text.trim().length === 0) {
        continue;
      }

      validateProseReferences(state, line);
      validateHardCodedProseValues(state, line);
    }
  }
}

function validateProseReferences(state: ResolveState, line: SourceLine): void {
  for (const match of line.text.matchAll(referencePattern)) {
    const rawReference = match[1];
    if (rawReference === undefined) {
      continue;
    }

    const reference = rawReference.trim();
    const start = line.startOffset + (match.index ?? 0);
    const span = spanFromOffsets(state.document.sourceFile, start, start + match[0].length);

    if (reference.length === 0 || reference !== rawReference) {
      state.diagnostics.push({
        severity: "error",
        rule: "invalid-reference",
        message: "Token references must contain a non-empty token path without surrounding whitespace.",
        span,
      });
      continue;
    }

    validateReferencePath(state, reference, span);
  }
}

function validateHardCodedProseValues(state: ResolveState, line: SourceLine): void {
  const patterns = [
    /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g,
    /\b(?:rgb|rgba|hsl|hsla|oklab|oklch|color)\([^)]*\)/g,
    /\b\d+(?:\.\d+)?(?:px|rem|em|ch|vw|vh|vmin|vmax|%|ms|s)\b/g,
  ];

  for (const pattern of patterns) {
    for (const match of line.text.matchAll(pattern)) {
      const start = line.startOffset + (match.index ?? 0);
      state.diagnostics.push({
        severity: "warning",
        rule: "hard-coded-prose-value",
        message: "Prose should refer to token names or token references instead of hard-coded values.",
        span: spanFromOffsets(state.document.sourceFile, start, start + match[0].length),
      });
    }
  }
}

function collectReferences(value: string): string[] {
  const references: string[] = [];

  for (const match of value.matchAll(referencePattern)) {
    const reference = match[1]?.trim();
    if (reference !== undefined && reference.length > 0) {
      references.push(reference);
    }
  }

  return references;
}

function findEntry(map: TokenMap, key: string): TokenMapEntry | undefined {
  return map.entries.find((entry) => entry.key === key);
}

function isKebabCase(value: string): boolean {
  return /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value);
}
