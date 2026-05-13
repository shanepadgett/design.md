export type DiagnosticSeverity = "error" | "warning";

export interface SourcePosition {
  line: number;
  column: number;
  offset: number;
}

export interface SourceSpan {
  filePath?: string;
  start: SourcePosition;
  end: SourcePosition;
}

export interface Diagnostic {
  severity: DiagnosticSeverity;
  rule: string;
  message: string;
  path?: string;
  span?: SourceSpan;
  suggestion?: string;
}

export interface DiagnosticSummary {
  errors: number;
  warnings: number;
}

export interface Result<T> {
  value: T;
  diagnostics: Diagnostic[];
}

export function summarizeDiagnostics(
  diagnostics: readonly Diagnostic[],
): DiagnosticSummary {
  let errors = 0;
  let warnings = 0;

  for (const diagnostic of diagnostics) {
    if (diagnostic.severity === "error") {
      errors += 1;
    } else {
      warnings += 1;
    }
  }

  return { errors, warnings };
}
