import { dirname, join } from "node:path";
import { exportDesignMd } from "../../core/pipeline.js";
import type { ExportCommand } from "../args.js";
import { writeDiagnostics } from "../diagnostics.js";
import type { CommandIO } from "../io.js";

export type ExportCommandIO = CommandIO;

export async function runExportCommand(
  command: ExportCommand,
  io: ExportCommandIO,
): Promise<number> {
  let source: string;

  try {
    source = await io.readFile(command.filePath);
  } catch (error) {
    io.stderr.write(`designmd: failed to read '${command.filePath}': ${errorMessage(error)}\n`);
    return 2;
  }

  const result = exportDesignMd(source, {
    filePath: command.filePath,
    format: command.format,
  });

  if (!result.valid || result.output === undefined) {
    const blockingDiagnostics = result.diagnostics.filter(
      (diagnostic) => diagnostic.severity === "error",
    );
    writeDiagnostics(io.stderr, command.filePath, blockingDiagnostics);
    return 1;
  }

  const outputPath = command.outPath ?? defaultOutputPath(command.filePath, command.format);
  if (!command.force && (await io.fileExists(outputPath))) {
    io.stderr.write(`designmd: output '${outputPath}' already exists. Use --force to overwrite.\n`);
    return 2;
  }

  try {
    await io.writeFile(outputPath, result.output);
  } catch (error) {
    io.stderr.write(`designmd: failed to write '${outputPath}': ${errorMessage(error)}\n`);
    return 2;
  }

  io.stdout.write(`wrote ${outputPath}\n`);
  return 0;
}

function defaultOutputPath(filePath: string, format: ExportCommand["format"]): string {
  const fileName = format === "css-tailwind" ? "theme.css" : "design-tokens.css";
  return join(dirname(filePath), fileName);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
