import type { Diagnostic, DiagnosticSummary, SourceSpan } from "../diagnostics/types.js";

export interface DesignMdMigrateOptions {
  filePath?: string;
}

export interface DesignMdMigrateResult {
  valid: boolean;
  diagnostics: Diagnostic[];
  summary: DiagnosticSummary;
  output?: string;
}

export type LegacyScalar = string | number;
export type LegacyValue = LegacyScalar | LegacyMap;

export interface LegacyEntry {
  key: string;
  value: LegacyValue;
  keySpan?: SourceSpan;
}

export interface LegacyMap {
  kind: "map";
  entries: LegacyEntry[];
  span?: SourceSpan;
}
