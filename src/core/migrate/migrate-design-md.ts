import type { Diagnostic } from "../diagnostics/types.js";
import { summarizeDiagnostics } from "../diagnostics/types.js";
import { canonicalKnownSectionNames } from "../sections/registry.js";
import { extractLegacyFrontmatter } from "./legacy-frontmatter.js";
import { parseLegacyYaml } from "./legacy-yaml.js";
import { serializeTokenYaml } from "./serialize-token-yaml.js";
import type {
  DesignMdMigrateOptions,
  DesignMdMigrateResult,
  LegacyEntry,
  LegacyMap,
  LegacyValue,
} from "./types.js";

interface MarkdownSection {
  name: string;
  contentLines: string[];
}

interface ParsedMarkdownBody {
  title?: string;
  preambleLines: string[];
  sections: MarkdownSection[];
}

const legacyRootKeys = new Set([
  "name",
  "description",
  "colors",
  "typography",
  "spacing",
  "rounded",
  "components",
]);

export function migrateDesignMd(
  source: string,
  options: DesignMdMigrateOptions = {},
): DesignMdMigrateResult {
  const diagnostics: Diagnostic[] = [];
  const frontmatterResult = extractLegacyFrontmatter(source, options);
  diagnostics.push(...frontmatterResult.diagnostics);

  if (frontmatterResult.frontmatter === undefined) {
    return invalidResult(diagnostics);
  }

  const parsedYaml = parseLegacyYaml(
    frontmatterResult.frontmatter.sourceFile,
    frontmatterResult.frontmatter.contentLines,
  );
  diagnostics.push(...parsedYaml.diagnostics);

  if (summarizeDiagnostics(diagnostics).errors > 0) {
    return invalidResult(diagnostics);
  }

  warnUnknownRootKeys(parsedYaml.root, diagnostics);

  const output = buildMigratedDocument(parsedYaml.root, frontmatterResult.frontmatter.body);
  const summary = summarizeDiagnostics(diagnostics);

  return {
    valid: summary.errors === 0,
    diagnostics,
    summary,
    output,
  };
}

function buildMigratedDocument(root: LegacyMap, body: string): string {
  const parsedBody = parseMarkdownBody(body);
  const legacyName = readScalar(root, "name");
  const description = readScalar(root, "description");
  const title = parsedBody.title ?? legacyName ?? "DESIGN.md";
  const sections = new Map<string, MarkdownSection>();
  const unknownSections: MarkdownSection[] = [];

  for (const section of parsedBody.sections) {
    const canonicalName = canonicalSectionName(section.name);
    if (isKnownSection(canonicalName) && !sections.has(canonicalName)) {
      sections.set(canonicalName, { name: canonicalName, contentLines: section.contentLines });
    } else {
      unknownSections.push(section);
    }
  }

  const preambleLines = trimBlankLines(parsedBody.preambleLines);
  const overview = sections.get("Overview");
  if (overview !== undefined && preambleLines.length > 0) {
    overview.contentLines = [...preambleLines, "", ...trimBlankLines(overview.contentLines)];
  } else if (overview === undefined) {
    if (description !== undefined) {
      sections.set("Overview", {
        name: "Overview",
        contentLines: preambleLines.length > 0 ? [description, "", ...preambleLines] : [description],
      });
    } else if (preambleLines.length > 0) {
      sections.set("Overview", { name: "Overview", contentLines: preambleLines });
    }
  }

  const tokenSections = buildTokenSections(root);
  for (const sectionName of tokenSections.keys()) {
    if (!sections.has(sectionName)) {
      sections.set(sectionName, { name: sectionName, contentLines: [] });
    }
  }

  const blocks: string[] = [`# ${title}`];

  for (const sectionName of canonicalKnownSectionNames) {
    if (sectionName === "Metadata") {
      continue;
    }

    const section = sections.get(sectionName);
    const tokens = tokenSections.get(sectionName);
    if (section === undefined && tokens === undefined) {
      continue;
    }

    blocks.push(formatSection(sectionName, section?.contentLines ?? [], tokens));
  }

  for (const section of unknownSections) {
    blocks.push(formatSection(section.name, section.contentLines));
  }

  return `${blocks.map((block) => block.trimEnd()).join("\n\n")}\n`;
}

function buildTokenSections(root: LegacyMap): Map<string, LegacyMap> {
  const sections = new Map<string, LegacyMap>();
  const colors = readMap(root, "colors");
  const typography = readMap(root, "typography");
  const spacing = readMap(root, "spacing");
  const rounded = readMap(root, "rounded");
  const components = readMap(root, "components");

  if (colors !== undefined) {
    sections.set("Colors", transformMap(colors, rewriteReferences));
  }

  if (typography !== undefined) {
    sections.set("Typography", migrateTypography(typography));
  }

  if (spacing !== undefined) {
    sections.set("Layout", legacyMap([
      legacyEntry("spacing", transformMap(spacing, rewriteReferences)),
    ]));
  }

  if (rounded !== undefined) {
    sections.set("Shapes", legacyMap([
      legacyEntry("radius", transformMap(rounded, rewriteReferences)),
    ]));
  }

  if (components !== undefined) {
    const migratedComponents = migrateComponents(components);
    if (migratedComponents.entries.length > 0) {
      sections.set("Components", migratedComponents);
    }
  }

  return sections;
}

function migrateTypography(source: LegacyMap): LegacyMap {
  const entries: LegacyEntry[] = [];
  const baseFontSize = inferBaseFontSize(source);

  if (baseFontSize !== undefined) {
    entries.push(legacyEntry("baseFontSize", baseFontSize));
  }

  entries.push(legacyEntry(
    "text",
    legacyMap(source.entries.map((style) => legacyEntry(
      style.key,
      isMap(style.value)
        ? legacyMap(style.value.entries.map((field) => legacyEntry(
          field.key,
          migrateTypographyField(field.key, field.value),
        )))
        : transformValue(style.value, rewriteReferences),
    ))),
  ));

  return legacyMap(entries);
}

function inferBaseFontSize(source: LegacyMap): LegacyValue | undefined {
  for (const styleName of ["body", "body-md"]) {
    const fontSize = readTypographyFontSize(source, styleName);
    if (fontSize !== undefined) {
      return transformValue(fontSize, rewriteReferences);
    }
  }

  for (const style of source.entries) {
    if (!isMap(style.value)) {
      continue;
    }

    const fontSize = readMapEntry(style.value, "fontSize")?.value;
    if (fontSize !== undefined) {
      return transformValue(fontSize, rewriteReferences);
    }
  }

  return undefined;
}

function readTypographyFontSize(source: LegacyMap, styleName: string): LegacyValue | undefined {
  const style = readMap(source, styleName);
  if (style === undefined) {
    return undefined;
  }

  return readMapEntry(style, "fontSize")?.value;
}

function migrateTypographyField(key: string, value: LegacyValue): LegacyValue {
  const rewritten = transformValue(value, rewriteReferences);
  if ((key === "fontWeight" || key === "lineHeight") && typeof rewritten === "string" && isNumericString(rewritten)) {
    return Number(rewritten);
  }

  return rewritten;
}

function migrateComponents(source: LegacyMap): LegacyMap {
  return legacyMap(source.entries.flatMap((component) => {
    if (!isMap(component.value)) {
      return [];
    }

    const base = legacyMap(component.value.entries.map((property) => {
      const propertyKey = property.key === "rounded" ? "radius" : property.key;
      return legacyEntry(propertyKey, migrateComponentProperty(property.key, property.value));
    }));

    return [legacyEntry(component.key, legacyMap([legacyEntry("base", base)]))];
  }));
}

function migrateComponentProperty(key: string, value: LegacyValue): LegacyValue {
  if (key === "typography" && typeof value === "string") {
    const match = /^\{typography\.([^{}.]+)\}$/.exec(value);
    if (match?.[1] !== undefined) {
      return `typography.text.${match[1]}`;
    }
  }

  return transformValue(value, rewriteReferences);
}

function transformMap(
  map: LegacyMap,
  transformScalar: (value: string) => string,
): LegacyMap {
  return legacyMap(map.entries.map((entry) => legacyEntry(
    entry.key,
    transformValue(entry.value, transformScalar),
  )));
}

function transformValue(
  value: LegacyValue,
  transformScalar: (value: string) => string,
): LegacyValue {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return transformScalar(value);
  }

  return transformMap(value, transformScalar);
}

function rewriteReferences(value: string): string {
  return value.replace(/\{([^{}]+)\}/g, (_match, reference: string) => {
    return `{${rewriteReferencePath(reference)}}`;
  });
}

function rewriteReferencePath(path: string): string {
  if (path.startsWith("spacing.")) {
    return `layout.spacing.${path.slice("spacing.".length)}`;
  }

  if (path.startsWith("rounded.")) {
    return `shapes.radius.${path.slice("rounded.".length)}`;
  }

  if (path.startsWith("typography.")) {
    return `typography.text.${path.slice("typography.".length)}`;
  }

  return path;
}

function parseMarkdownBody(body: string): ParsedMarkdownBody {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  let index = 0;
  let title: string | undefined;

  while (lines[index]?.trim() === "") {
    index += 1;
  }

  const firstLine = lines[index];
  const titleMatch = firstLine === undefined ? undefined : /^# ([^#].*)$/.exec(firstLine);
  if (titleMatch?.[1] !== undefined) {
    title = titleMatch[1].trim();
    index += 1;
  }

  const preambleLines: string[] = [];
  const sections: MarkdownSection[] = [];
  let currentSection: MarkdownSection | undefined;

  for (; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const sectionMatch = /^## ([^#].*)$/.exec(line);

    if (sectionMatch?.[1] !== undefined) {
      currentSection = {
        name: sectionMatch[1].trim(),
        contentLines: [],
      };
      sections.push(currentSection);
      continue;
    }

    if (currentSection === undefined) {
      preambleLines.push(line);
    } else {
      currentSection.contentLines.push(line);
    }
  }

  const parsed: ParsedMarkdownBody = {
    preambleLines,
    sections,
  };

  if (title !== undefined) {
    parsed.title = title;
  }

  return parsed;
}

function formatSection(
  name: string,
  contentLines: readonly string[],
  tokens?: LegacyMap,
): string {
  const lines = [`## ${name}`];
  const trimmedContent = trimBlankLines(contentLines);

  if (trimmedContent.length > 0) {
    lines.push("", ...trimmedContent);
  }

  if (tokens !== undefined) {
    lines.push("", "```yaml", serializeTokenYaml(tokens), "```");
  }

  return lines.join("\n");
}

function trimBlankLines(lines: readonly string[]): string[] {
  let start = 0;
  let end = lines.length;

  while (start < end && lines[start]?.trim() === "") {
    start += 1;
  }

  while (end > start && lines[end - 1]?.trim() === "") {
    end -= 1;
  }

  return lines.slice(start, end);
}

function canonicalSectionName(name: string): string {
  switch (name) {
    case "Brand & Style":
      return "Overview";
    case "Layout & Spacing":
      return "Layout";
    case "Elevation & Depth":
      return "Elevation";
    default:
      return name;
  }
}

function warnUnknownRootKeys(root: LegacyMap, diagnostics: Diagnostic[]): void {
  for (const entry of root.entries) {
    if (legacyRootKeys.has(entry.key)) {
      continue;
    }

    const diagnostic: Diagnostic = {
      severity: "warning",
      rule: "legacy-unknown-key",
      path: entry.key,
      message: `Legacy root key '${entry.key}' is not migrated.`,
    };

    if (entry.keySpan !== undefined) {
      diagnostic.span = entry.keySpan;
    }

    diagnostics.push(diagnostic);
  }
}

function readMap(map: LegacyMap, key: string): LegacyMap | undefined {
  const value = readMapEntry(map, key)?.value;
  return isMap(value) ? value : undefined;
}

function readScalar(map: LegacyMap, key: string): string | undefined {
  const value = readMapEntry(map, key)?.value;
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  return undefined;
}

function readMapEntry(map: LegacyMap, key: string): LegacyEntry | undefined {
  return map.entries.find((entry) => entry.key === key);
}

function legacyMap(entries: LegacyEntry[]): LegacyMap {
  return { kind: "map", entries };
}

function legacyEntry(key: string, value: LegacyValue): LegacyEntry {
  return { key, value };
}

function isKnownSection(name: string): boolean {
  return (canonicalKnownSectionNames as readonly string[]).includes(name);
}

function isMap(value: LegacyValue | undefined): value is LegacyMap {
  return typeof value !== "string" && typeof value !== "number" && value !== undefined;
}

function isNumericString(value: string): boolean {
  return /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value);
}

function invalidResult(diagnostics: Diagnostic[]): DesignMdMigrateResult {
  return {
    valid: false,
    diagnostics,
    summary: summarizeDiagnostics(diagnostics),
  };
}
