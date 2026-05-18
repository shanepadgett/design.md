import type { Diagnostic } from "./diagnostics/types.js";
import { summarizeDiagnostics } from "./diagnostics/types.js";
import { parseDocument } from "./document/parse-document.js";
import type { DesignDocument } from "./document/types.js";
import { serializeDesignSystemCss, type DesignMdExportFormat } from "./export/css.js";
import type { DesignSystem } from "./resolve/types.js";
import { resolveDesignSystem } from "./resolve/resolve-design-system.js";
import type { TokenGroupName } from "./sections/registry.js";
import type { ParsedSectionToken } from "./sections/tokens.js";
import { parseTokenYaml } from "./token-yaml/parse-token-yaml.js";
import { validateDocumentStructure } from "./validation/document-structure.js";
import { validateSectionSchemas } from "./validation/section-schemas.js";
export type {
  DesignMdProseOptions,
  DesignMdProseResult,
  DesignMdProseSection,
} from "./prose/extract-prose.js";
export { extractDesignMdProse } from "./prose/extract-prose.js";
export type { DesignMdMigrateOptions, DesignMdMigrateResult } from "./migrate/types.js";
export { migrateDesignMd } from "./migrate/migrate-design-md.js";

export interface DesignMdOptions {
  filePath?: string;
}

export interface DesignMdParseResult {
  document: DesignDocument;
  designSystem: DesignSystem;
  diagnostics: Diagnostic[];
}

export interface DesignMdLintOptions extends DesignMdOptions {
  strict?: boolean;
}

export interface DesignMdLintSummary {
  errors: number;
  warnings: number;
  tokens: Partial<Record<TokenGroupName, number>>;
}

export interface DesignMdLintResult extends DesignMdParseResult {
  valid: boolean;
  summary: DesignMdLintSummary;
}

export interface DesignMdExportOptions extends DesignMdOptions {
  format: DesignMdExportFormat;
}

export interface DesignMdExportResult extends DesignMdParseResult {
  valid: boolean;
  summary: DesignMdLintSummary;
  output?: string;
}

export function parseDesignMd(source: string, options: DesignMdOptions = {}): DesignMdParseResult {
  const document = parseDocument(source, options);
  const structure = validateDocumentStructure(document);
  const sectionTokens: ParsedSectionToken[] = [];
  const diagnostics: Diagnostic[] = [...document.diagnostics, ...structure.diagnostics];

  for (const tokenFence of structure.tokenFences) {
    const parsed = parseTokenYaml(document.sourceFile, tokenFence.fence.contentLines);
    diagnostics.push(...parsed.diagnostics);
    sectionTokens.push({ ...tokenFence, parsed });
  }

  diagnostics.push(...validateSectionSchemas(sectionTokens));

  const resolved = resolveDesignSystem(document, sectionTokens);
  diagnostics.push(...resolved.diagnostics);

  return {
    document,
    designSystem: resolved.designSystem,
    diagnostics,
  };
}

export function lintDesignMd(
  source: string,
  options: DesignMdLintOptions = {},
): DesignMdLintResult {
  const parsed = parseDesignMd(source, options);
  const summaryCounts = summarizeDiagnostics(parsed.diagnostics);
  const summary: DesignMdLintSummary = {
    ...summaryCounts,
    tokens: parsed.designSystem.tokenCountByGroup,
  };
  const valid = summary.errors === 0 && (!options.strict || summary.warnings === 0);

  return {
    ...parsed,
    valid,
    summary,
  };
}

export function exportDesignMd(
  source: string,
  options: DesignMdExportOptions,
): DesignMdExportResult {
  const linted = lintDesignMd(source, options);
  const diagnostics: Diagnostic[] = [...linted.diagnostics];

  if (linted.summary.errors > 0) {
    return {
      document: linted.document,
      designSystem: linted.designSystem,
      diagnostics,
      valid: false,
      summary: linted.summary,
    };
  }

  const exportOptions: Parameters<typeof serializeDesignSystemCss>[1] = {
    format: options.format,
  };

  if (options.filePath !== undefined) {
    exportOptions.sourcePath = options.filePath;
  }

  const exported = serializeDesignSystemCss(linted.designSystem, exportOptions);
  diagnostics.push(...exported.diagnostics);

  const summaryCounts = summarizeDiagnostics(diagnostics);
  const summary: DesignMdLintSummary = {
    ...summaryCounts,
    tokens: linted.designSystem.tokenCountByGroup,
  };
  const valid = summary.errors === 0;
  const result: DesignMdExportResult = {
    document: linted.document,
    designSystem: linted.designSystem,
    diagnostics,
    valid,
    summary,
  };

  if (valid && exported.output !== undefined) {
    result.output = exported.output;
  }

  return result;
}
