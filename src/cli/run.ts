import { createRequire } from "node:module";
import { helpText, parseCliArgs } from "./args.js";
import { runExportCommand } from "./commands/export.js";
import { runLintCommand } from "./commands/lint.js";
import { runMigrateCommand } from "./commands/migrate.js";
import { runSpecCommand } from "./commands/spec.js";
import type { CommandIO } from "./io.js";

const require = createRequire(import.meta.url);
const packageJson = require("../../package.json") as { version: string };
const cliVersion = packageJson.version;

export type CliIO = CommandIO;

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
    case "export":
      return runExportCommand(command, io);
    case "migrate":
      return runMigrateCommand(command, io);
    case "spec":
      return runSpecCommand(command, io);
  }
}
