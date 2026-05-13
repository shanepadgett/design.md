export type CliCommand = HelpCommand | LintCommand | UsageErrorCommand | VersionCommand;

export interface HelpCommand {
  kind: "help";
}

export interface VersionCommand {
  kind: "version";
}

export interface UsageErrorCommand {
  kind: "usage-error";
  message: string;
}

export interface LintCommand {
  kind: "lint";
  filePath: string;
  strict: boolean;
}

export function parseCliArgs(args: readonly string[]): CliCommand {
  const [command, ...rest] = args;

  if (command === undefined || command === "--help" || command === "-h") {
    return { kind: "help" };
  }

  if (command === "--version" || command === "-V") {
    return { kind: "version" };
  }

  if (command !== "lint") {
    return {
      kind: "usage-error",
      message: `Unknown command '${command}'.`,
    };
  }

  return parseLintArgs(rest);
}

function parseLintArgs(args: readonly string[]): CliCommand {
  let strict = false;
  const filePaths: string[] = [];

  for (const arg of args) {
    if (arg === "--strict") {
      strict = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      return { kind: "help" };
    }

    if (arg.startsWith("-")) {
      return {
        kind: "usage-error",
        message: `Unknown lint option '${arg}'.`,
      };
    }

    filePaths.push(arg);
  }

  if (filePaths.length !== 1) {
    return {
      kind: "usage-error",
      message: "lint requires exactly one DESIGN.md file path.",
    };
  }

  return { kind: "lint", filePath: filePaths[0] ?? "", strict };
}

export function helpText(): string {
  return `designmd

Usage:
  designmd lint [--strict] <file>
  designmd --help
  designmd --version

Commands:
  lint      Validate a DESIGN.md file

Options:
  --strict  Treat warnings as lint failures
`;
}
