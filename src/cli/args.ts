import type { DesignMdExportFormat } from "../core/export/css.js";

export type CliCommand = ExportCommand | HelpCommand | LintCommand | UsageErrorCommand | VersionCommand;

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

export interface ExportCommand {
  kind: "export";
  filePath: string;
  format: DesignMdExportFormat;
  outPath?: string;
  force: boolean;
}

export function parseCliArgs(args: readonly string[]): CliCommand {
  const [command, ...rest] = args;

  if (command === undefined || command === "--help" || command === "-h") {
    return { kind: "help" };
  }

  if (command === "--version" || command === "-V") {
    return { kind: "version" };
  }

  if (command === "lint") {
    return parseLintArgs(rest);
  }

  if (command === "export") {
    return parseExportArgs(rest);
  }

  return {
    kind: "usage-error",
    message: `Unknown command '${command}'.`,
  };
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

function parseExportArgs(args: readonly string[]): CliCommand {
  let force = false;
  let format: DesignMdExportFormat | undefined;
  let outPath: string | undefined;
  const filePaths: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === undefined) {
      continue;
    }

    if (arg === "--force") {
      force = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      return { kind: "help" };
    }

    if (arg === "--format") {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("-")) {
        return {
          kind: "usage-error",
          message: "export --format requires css or css-tailwind.",
        };
      }

      if (!isExportFormat(value)) {
        return {
          kind: "usage-error",
          message: `Unknown export format '${value}'.`,
        };
      }

      format = value;
      index += 1;
      continue;
    }

    if (arg === "--out") {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("-")) {
        return {
          kind: "usage-error",
          message: "export --out requires a file path.",
        };
      }

      outPath = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("-")) {
      return {
        kind: "usage-error",
        message: `Unknown export option '${arg}'.`,
      };
    }

    filePaths.push(arg);
  }

  if (format === undefined) {
    return {
      kind: "usage-error",
      message: "export requires --format css or css-tailwind.",
    };
  }

  if (filePaths.length !== 1) {
    return {
      kind: "usage-error",
      message: "export requires exactly one DESIGN.md file path.",
    };
  }

  const command: ExportCommand = {
    kind: "export",
    filePath: filePaths[0] ?? "",
    format,
    force,
  };

  if (outPath !== undefined) {
    command.outPath = outPath;
  }

  return command;
}

function isExportFormat(value: string): value is DesignMdExportFormat {
  return value === "css" || value === "css-tailwind";
}

export function helpText(): string {
  return `designmd

Usage:
  designmd lint [--strict] <file>
  designmd export --format css|css-tailwind [--out <file>] [--force] <file>
  designmd --help
  designmd --version

Commands:
  lint      Validate a DESIGN.md file
  export    Export DESIGN.md tokens to CSS files

Options:
  --strict        Treat warnings as lint failures
  --format        Export format: css or css-tailwind
  --out <file>    Override export output path
  --force         Overwrite existing export output
`;
}
