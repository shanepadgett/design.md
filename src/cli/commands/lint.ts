import { lintDesignMd } from "../../core/pipeline.js";
import type { LintCommand } from "../args.js";
import { writeDiagnostics } from "../diagnostics.js";
import type { CommandIO } from "../io.js";

export type LintCommandIO = Pick<CommandIO, "readFile" | "stdout" | "stderr">;

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

  writeDiagnostics(io.stdout, command.filePath, result.diagnostics);

  if (result.diagnostics.length === 0) {
    io.stdout.write(`${command.filePath}: valid\n`);
  } else {
    io.stdout.write(
      `${result.summary.errors} error(s), ${result.summary.warnings} warning(s)\n`,
    );
  }

  return result.valid ? 0 : 1;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
