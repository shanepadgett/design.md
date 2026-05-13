import { helpText, parseCliArgs } from "./args.js";
import { runLintCommand, type LintCommandIO } from "./commands/lint.js";

const cliVersion = "0.0.0";

export type CliIO = LintCommandIO;

export async function runCli(args: readonly string[], io: CliIO): Promise<number> {
  const command = parseCliArgs(args);

  switch (command.kind) {
    case "help":
      io.stdout.write(helpText());
      return 0;
    case "version":
      io.stdout.write(`${cliVersion}\n`);
      return 0;
    case "usage-error":
      io.stderr.write(`designmd: ${command.message}\n\n${helpText()}`);
      return 2;
    case "lint":
      return runLintCommand(command, io);
  }
}
