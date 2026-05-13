import { migrateDesignMd } from "../../core/pipeline.js";
import type { MigrateCommand } from "../args.js";
import { writeDiagnostics } from "../diagnostics.js";
import type { CommandIO } from "../io.js";

export type MigrateCommandIO = Pick<CommandIO, "readFile" | "writeFile" | "stdout" | "stderr">;

export async function runMigrateCommand(
  command: MigrateCommand,
  io: MigrateCommandIO,
): Promise<number> {
  let source: string;

  try {
    source = await io.readFile(command.filePath);
  } catch (error) {
    io.stderr.write(`designmd: failed to read '${command.filePath}': ${errorMessage(error)}\n`);
    return 2;
  }

  const result = migrateDesignMd(source, { filePath: command.filePath });
  if (!result.valid || result.output === undefined) {
    writeDiagnostics(io.stderr, command.filePath, result.diagnostics);
    return 1;
  }

  const warnings = result.diagnostics.filter((diagnostic) => diagnostic.severity === "warning");
  writeDiagnostics(io.stderr, command.filePath, warnings);

  if (!command.write) {
    io.stdout.write(result.output);
    return 0;
  }

  try {
    await io.writeFile(command.filePath, result.output);
  } catch (error) {
    io.stderr.write(`designmd: failed to write '${command.filePath}': ${errorMessage(error)}\n`);
    return 2;
  }

  io.stdout.write(`wrote ${command.filePath}\n`);
  return 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
