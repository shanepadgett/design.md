import type { ProseCommand } from "../args.js";
import { extractDesignMdProse } from "../../core/prose/extract-prose.js";
import { writeDiagnostics } from "../diagnostics.js";
import type { CommandIO } from "../io.js";

export type ProseCommandIO = Pick<CommandIO, "readFile" | "stdout" | "stderr">;

export async function runProseCommand(command: ProseCommand, io: ProseCommandIO): Promise<number> {
  let source: string;
  try {
    source = await io.readFile(command.filePath);
  } catch (error) {
    io.stderr.write(`designmd: failed to read '${command.filePath}': ${errorMessage(error)}\n`);
    return 2;
  }

  const options: Parameters<typeof extractDesignMdProse>[1] = {
    filePath: command.filePath,
    list: command.list,
  };
  if (command.section !== undefined) {
    options.section = command.section;
  }

  const result = extractDesignMdProse(source, options);

  const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  if (errors.length > 0) {
    writeDiagnostics(io.stderr, command.filePath, errors);
    return 1;
  }

  io.stdout.write(result.output ?? "");
  return 0;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
