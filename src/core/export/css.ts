import type { Diagnostic } from "../diagnostics/types.js";
import type { DesignSystem, ResolvedToken } from "../resolve/types.js";
import type { TokenPrimitive } from "../token-yaml/types.js";

export type DesignMdExportFormat = "css" | "css-tailwind";

export interface SerializeDesignSystemCssOptions {
  format: DesignMdExportFormat;
  sourcePath?: string;
}

export interface SerializeDesignSystemCssResult {
  output?: string;
  diagnostics: Diagnostic[];
}

interface VariableMapping {
  cssName: string;
  order: number;
  tailwind: boolean;
}

interface ExportedToken {
  token: ResolvedToken;
  cssName: string;
  order: number;
  index: number;
}

interface CssDeclaration {
  name: string;
  value: string;
  order: number;
  index: number;
}

const referencePattern = /\{([^{}]+)\}/g;

export function serializeDesignSystemCss(
  designSystem: DesignSystem,
  options: SerializeDesignSystemCssOptions,
): SerializeDesignSystemCssResult {
  const diagnostics: Diagnostic[] = [];
  const exportedTokens = collectExportedTokens(designSystem, options.format, diagnostics);

  if (hasErrors(diagnostics)) {
    return { diagnostics };
  }

  const rootTheme = rootThemeName(designSystem);
  const rootDeclarations: CssDeclaration[] = [];
  const themeDeclarations = new Map<string, CssDeclaration[]>();

  for (const theme of designSystem.themes) {
    if (theme !== rootTheme) {
      themeDeclarations.set(theme, []);
    }
  }

  for (const exported of exportedTokens) {
    const value = exported.token.value;

    if (isThemedValue(value)) {
      if (rootTheme === undefined) {
        diagnostics.push({
          severity: "error",
          rule: "missing-theme-value",
          path: exported.token.path,
          message: `Token '${exported.token.path}' has themed values but no root theme is available.`,
          span: exported.token.span,
        });
        continue;
      }

      addThemedDeclaration({
        declarations: rootDeclarations,
        diagnostics,
        exported,
        format: options.format,
        theme: rootTheme,
        value: value[rootTheme],
      });

      for (const theme of designSystem.themes) {
        if (theme === rootTheme) {
          continue;
        }

        const declarations = themeDeclarations.get(theme);
        if (declarations === undefined) {
          continue;
        }

        addThemedDeclaration({
          declarations,
          diagnostics,
          exported,
          format: options.format,
          theme,
          value: value[theme],
        });
      }
    } else {
      const cssValue = stringifyCssValue(value, exported.token, options.format, diagnostics);
      if (cssValue !== undefined) {
        rootDeclarations.push({
          name: exported.cssName,
          value: cssValue,
          order: exported.order,
          index: exported.index,
        });
      }
    }
  }

  if (hasErrors(diagnostics)) {
    return { diagnostics };
  }

  const sourceName = basename(options.sourcePath);
  const output = renderCss({
    format: options.format,
    sourceName,
    rootDeclarations,
    themeDeclarations,
  });

  return { output, diagnostics };
}

function collectExportedTokens(
  designSystem: DesignSystem,
  format: DesignMdExportFormat,
  diagnostics: Diagnostic[],
): ExportedToken[] {
  const exportedTokens: ExportedToken[] = [];
  const seenVariables = new Map<string, ResolvedToken>();
  let index = 0;

  for (const token of designSystem.tokens.values()) {
    const mapping = mapTokenPath(token.path, format);
    if (mapping === undefined) {
      index += 1;
      continue;
    }

    const previous = seenVariables.get(mapping.cssName);
    if (previous !== undefined) {
      diagnostics.push({
        severity: "error",
        rule: "css-variable-collision",
        path: token.path,
        message: `Token '${token.path}' exports to '${mapping.cssName}', which already maps to '${previous.path}'.`,
        span: token.span,
      });
    } else {
      seenVariables.set(mapping.cssName, token);
      exportedTokens.push({
        token,
        cssName: mapping.cssName,
        order: mapping.order,
        index,
      });
    }

    index += 1;
  }

  return exportedTokens;
}

function addThemedDeclaration(args: {
  declarations: CssDeclaration[];
  diagnostics: Diagnostic[];
  exported: ExportedToken;
  format: DesignMdExportFormat;
  theme: string;
  value: TokenPrimitive | undefined;
}): void {
  if (args.value === undefined) {
    args.diagnostics.push({
      severity: "error",
      rule: "missing-theme-value",
      path: args.exported.token.path,
      message: `Token '${args.exported.token.path}' is missing a value for theme '${args.theme}'.`,
      span: args.exported.token.span,
    });
    return;
  }

  const cssValue = stringifyCssValue(
    args.value,
    args.exported.token,
    args.format,
    args.diagnostics,
  );

  if (cssValue !== undefined) {
    args.declarations.push({
      name: args.exported.cssName,
      value: cssValue,
      order: args.exported.order,
      index: args.exported.index,
    });
  }
}

function stringifyCssValue(
  value: TokenPrimitive,
  token: ResolvedToken,
  format: DesignMdExportFormat,
  diagnostics: Diagnostic[],
): string | undefined {
  if (typeof value === "number") {
    return String(value);
  }

  let valid = true;
  const converted = value.replace(referencePattern, (match, reference: string) => {
    const mapping = mapTokenPath(reference, format);
    if (mapping === undefined) {
      diagnostics.push({
        severity: "error",
        rule: "unexportable-reference",
        path: token.path,
        message: `Reference '${match}' cannot be exported as a CSS variable in ${format} format.`,
        span: token.span,
      });
      valid = false;
      return match;
    }

    return `var(${mapping.cssName})`;
  });

  return valid ? converted : undefined;
}

function mapTokenPath(path: string, format: DesignMdExportFormat): VariableMapping | undefined {
  const mapping = mapTokenPathForCss(path);
  if (mapping === undefined) {
    return undefined;
  }

  if (format === "css-tailwind" && !mapping.tailwind) {
    return undefined;
  }

  return mapping;
}

function mapTokenPathForCss(path: string): VariableMapping | undefined {
  const segments = path.split(".");
  const [group, second] = segments;

  if (group === "colors" && segments.length > 1) {
    return prefixed("--color-", segments.slice(1), 0, true);
  }

  if (group === "typography") {
    if (second === "fontFamily" && segments.length > 2) {
      return prefixed("--font-", segments.slice(2), 1, true);
    }

    if (second === "text" && segments.length > 3) {
      const field = segments.at(-1);
      const name = segments.slice(2, -1);

      if (field === "fontSize") {
        return prefixed("--text-", name, 2, true);
      }

      if (field === "lineHeight") {
        return prefixed("--leading-", name, 3, true);
      }

      if (field === "letterSpacing") {
        return prefixed("--tracking-", name, 4, true);
      }

      if (field === "fontWeight") {
        return prefixed("--font-weight-", name, 5, true);
      }
    }
  }

  if (group === "layout" && segments.length > 2) {
    if (second === "spacing") {
      return prefixed("--spacing-", segments.slice(2), 6, true);
    }

    if (second === "container") {
      return prefixed("--container-", segments.slice(2), 7, true);
    }

    if (second === "breakpoint") {
      return prefixed("--breakpoint-", segments.slice(2), 8, true);
    }
  }

  if (group === "shapes" && segments.length > 2) {
    if (second === "radius") {
      return prefixed("--radius-", segments.slice(2), 9, true);
    }

    if (second === "borderWidth") {
      return prefixed("--border-width-", segments.slice(2), 10, false);
    }

    if (second === "borderStyle") {
      return prefixed("--border-style-", segments.slice(2), 11, false);
    }
  }

  if (group === "elevation" && segments.length > 2) {
    if (second === "shadow") {
      return prefixed("--shadow-", segments.slice(2), 12, true);
    }

    if (second === "zIndex") {
      return prefixed("--z-index-", segments.slice(2), 13, false);
    }
  }

  if (group === "motion" && segments.length > 2) {
    if (second === "duration") {
      return prefixed("--duration-", segments.slice(2), 14, false);
    }

    if (second === "easing") {
      return prefixed("--ease-", segments.slice(2), 15, true);
    }
  }

  if (group === "iconography") {
    if (second === "size" && segments.length > 2) {
      return prefixed("--icon-size-", segments.slice(2), 16, false);
    }

    if (path === "iconography.strokeWidth") {
      return literal("--icon-stroke-width", 17, false);
    }

    if (path === "iconography.color") {
      return literal("--icon-color", 18, false);
    }
  }

  return undefined;
}

function prefixed(
  prefix: string,
  segments: readonly string[],
  order: number,
  tailwind: boolean,
): VariableMapping | undefined {
  const slug = slugifySegments(segments);
  if (slug.length === 0) {
    return undefined;
  }

  return { cssName: `${prefix}${slug}`, order, tailwind };
}

function literal(cssName: string, order: number, tailwind: boolean): VariableMapping {
  return { cssName, order, tailwind };
}

function slugifySegments(segments: readonly string[]): string {
  return segments
    .map(slugifySegment)
    .filter((segment) => segment.length > 0)
    .join("-");
}

function slugifySegment(segment: string): string {
  return segment
    .trim()
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .replace(/[^A-Za-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function renderCss(args: {
  format: DesignMdExportFormat;
  sourceName: string;
  rootDeclarations: CssDeclaration[];
  themeDeclarations: Map<string, CssDeclaration[]>;
}): string {
  const header = `/* Generated by designmd from ${args.sourceName}. Do not edit directly. */`;
  const rootSelector = args.format === "css-tailwind" ? "@theme static" : ":root";
  const blocks = [renderBlock(rootSelector, args.rootDeclarations)];

  for (const [theme, declarations] of args.themeDeclarations) {
    if (declarations.length === 0) {
      continue;
    }

    blocks.push(renderBlock(`[data-theme="${cssStringContent(theme)}"]`, declarations));
  }

  return `${header}\n\n${blocks.join("\n\n")}\n`;
}

function renderBlock(selector: string, declarations: readonly CssDeclaration[]): string {
  const lines = [`${selector} {`];
  const sorted = [...declarations].sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order;
    }

    return left.index - right.index;
  });

  for (const declaration of sorted) {
    lines.push(`  ${declaration.name}: ${declaration.value};`);
  }

  lines.push("}");
  return lines.join("\n");
}

function rootThemeName(designSystem: DesignSystem): string | undefined {
  if (designSystem.defaultTheme !== undefined) {
    return designSystem.defaultTheme;
  }

  return designSystem.themes[0];
}

function isThemedValue(value: ResolvedToken["value"]): value is Record<string, TokenPrimitive> {
  return typeof value === "object" && value !== null;
}

function hasErrors(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}

function basename(filePath: string | undefined): string {
  if (filePath === undefined || filePath.length === 0) {
    return "DESIGN.md";
  }

  const normalized = filePath.replace(/\\/g, "/");
  return normalized.split("/").filter(Boolean).at(-1) ?? filePath;
}

function cssStringContent(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\a ");
}
