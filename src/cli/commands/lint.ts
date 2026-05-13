import { lintDesignMd } from "../../core/pipeline.js";
import type { Diagnostic } from "../../core/diagnostics/types.js";
import type { LintCommand } from "../args.js";

export interface LintCommandIO {
  readFile(filePath: string): Promise<string>;
  stdout: Writable;
  stderr: Writable;
}

export interface Writable {
  write(message: string): unknown;
}

export async function runLintCommand(
  command: LintCommand,
  io: LintCommandIO,
): Promise<number> {
  let source: string;

  try {
    source = await io.readFile(command.filePath);
  } catch (error) {
    io.stderr.write(`designmd: failed to read '${command.filePath}': ${errorMessage(error)}\n`);
    return 2;
  }

  const result = lintDesignMd(source, {
    filePath: command.filePath,
    strict: command.strict,
  });

  writeDiagnostics(io, command.filePath, result.diagnostics);

  if (result.diagnostics.length === 0) {
    io.stdout.write(`${command.filePath}: valid\n`);
  } else {
    io.stdout.write(
      `${result.summary.errors} error(s), ${result.summary.warnings} warning(s)\n`,
    );
  }

  return result.valid ? 0 : 1;
}

function writeDiagnostics(
  io: LintCommandIO,
  filePath: string,
  diagnostics: readonly Diagnostic[],
): void {
  for (const diagnostic of diagnostics) {
    const location = formatLocation(filePath, diagnostic);
    const path = diagnostic.path === undefined ? "" : ` ${diagnostic.path}`;
    io.stdout.write(
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
