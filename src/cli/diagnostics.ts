import type { Diagnostic } from "../core/diagnostics/types.js";
import type { Writable } from "./io.js";

export function writeDiagnostics(
  output: Writable,
  filePath: string,
  diagnostics: readonly Diagnostic[],
): void {
  for (const diagnostic of diagnostics) {
    const location = formatLocation(filePath, diagnostic);
    const path = diagnostic.path === undefined ? "" : ` ${diagnostic.path}`;
    output.write(
      `${location} ${diagnostic.severity} ${diagnostic.rule}${path}: ${diagnostic.message}\n`,
    );
  }
}

function formatLocation(filePath: string, diagnostic: Diagnostic): string {
  const span = diagnostic.span;
  if (span === undefined) {
    return filePath;
  }

  const path = span.filePath ?? filePath;
  return `${path}:${span.start.line}:${span.start.column}`;
}
