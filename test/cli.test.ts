import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { runCli } from "../dist/cli/run.js";
import { validDesignMd } from "./fixtures.ts";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };

type FileMap = Record<string, string>;
interface IoOptions {
  writeError?: Error;
}

function createIo(files: FileMap, existingFiles: FileMap = {}, options: IoOptions = {}) {
  let stdout = "";
  let stderr = "";
  const writtenFiles: FileMap = {};

  return {
    io: {
      fileExists: async (filePath: string) =>
        Object.hasOwn(existingFiles, filePath) || Object.hasOwn(writtenFiles, filePath),
      readFile: async (filePath: string) => {
        if (!Object.hasOwn(files, filePath)) {
          throw new Error("ENOENT");
        }

        const content = files[filePath];
        if (content === undefined) {
          throw new Error("ENOENT");
        }

        return content;
      },
      writeFile: async (filePath: string, content: string) => {
        if (options.writeError !== undefined) {
          throw options.writeError;
        }

        writtenFiles[filePath] = content;
      },
      stdout: {
        write: (message: string | Uint8Array) => {
          stdout += String(message);
        },
      },
      stderr: {
        write: (message: string | Uint8Array) => {
          stderr += String(message);
        },
      },
    },
    output: () => ({ stdout, stderr, writtenFiles }),
  };
}

test("CLI lint exits 0 and prints valid for clean document", async () => {
  const harness = createIo({ "DESIGN.md": validDesignMd });

  const exitCode = await runCli(["lint", "DESIGN.md"], harness.io);
  const output = harness.output();

  assert.equal(exitCode, 0);
  assert.match(output.stdout, /DESIGN\.md: valid/);
  assert.equal(output.stderr, "");
});

test("CLI lint exits 1 when strict mode sees warnings", async () => {
  const source = validDesignMd.replace(
    "Acme uses calm surfaces and clear hierarchy.",
    "Acme uses calm surfaces and clear hierarchy. Avoid 16px in prose.",
  );
  const harness = createIo({ "DESIGN.md": source });

  const exitCode = await runCli(["lint", "--strict", "DESIGN.md"], harness.io);
  const output = harness.output();

  assert.equal(exitCode, 1);
  assert.match(output.stdout, /DESIGN\.md:\d+:\d+ warning/);
  assert.match(output.stdout, /warning hard-coded-prose-value/);
});

test("CLI lint exits 0 for warnings outside strict mode", async () => {
  const source = validDesignMd.replace(
    "Acme uses calm surfaces and clear hierarchy.",
    "Acme uses calm surfaces and clear hierarchy. Avoid 16px in prose.",
  );
  const harness = createIo({ "DESIGN.md": source });

  const exitCode = await runCli(["lint", "DESIGN.md"], harness.io);
  const output = harness.output();

  assert.equal(exitCode, 0);
  assert.match(output.stdout, /0 error\(s\), 1 warning\(s\)/);
});

test("CLI lint exits 1 for errors and prints diagnostic path", async () => {
  const source = validDesignMd.replace('primary: "#1A1C1E"', 'primary: "red"');
  const harness = createIo({ "DESIGN.md": source });

  const exitCode = await runCli(["lint", "DESIGN.md"], harness.io);
  const output = harness.output();

  assert.equal(exitCode, 1);
  assert.match(output.stdout, /DESIGN\.md:\d+:\d+ error invalid-color Colors\.primary:/);
  assert.match(output.stdout, /1 error\(s\), 0 warning\(s\)/);
});

test("CLI exits 2 for read failures and usage errors", async () => {
  const missing = createIo({});
  assert.equal(await runCli(["lint", "missing.md"], missing.io), 2);
  assert.match(missing.output().stderr, /failed to read 'missing\.md'/);

  const usage = createIo({});
  assert.equal(await runCli(["lint"], usage.io), 2);
  assert.match(usage.output().stderr, /lint requires exactly one DESIGN\.md file path/);
});

test("CLI help and usage errors cover command option parsing", async () => {
  const help = createIo({});
  assert.equal(await runCli([], help.io), 0);
  assert.match(help.output().stdout, /Usage:/);

  const commandHelp = createIo({});
  assert.equal(await runCli(["export", "--help"], commandHelp.io), 0);
  assert.match(commandHelp.output().stdout, /designmd export/);

  const shortHelp = createIo({});
  assert.equal(await runCli(["-h"], shortHelp.io), 0);
  assert.match(shortHelp.output().stdout, /Usage:/);

  const lintHelp = createIo({});
  assert.equal(await runCli(["lint", "-h"], lintHelp.io), 0);
  assert.match(lintHelp.output().stdout, /designmd lint/);

  const migrateHelp = createIo({});
  assert.equal(await runCli(["migrate", "-h"], migrateHelp.io), 0);
  assert.match(migrateHelp.output().stdout, /designmd migrate/);

  const unknownCommand = createIo({});
  assert.equal(await runCli(["unknown"], unknownCommand.io), 2);
  assert.match(unknownCommand.output().stderr, /Unknown command 'unknown'/);

  const unknownLintOption = createIo({});
  assert.equal(await runCli(["lint", "--wat", "DESIGN.md"], unknownLintOption.io), 2);
  assert.match(unknownLintOption.output().stderr, /Unknown lint option '--wat'/);

  const unknownMigrateOption = createIo({});
  assert.equal(
    await runCli(["migrate", "--out", "next.md", "legacy.md"], unknownMigrateOption.io),
    2,
  );
  assert.match(unknownMigrateOption.output().stderr, /Unknown migrate option '--out'/);

  const missingMigrateFile = createIo({});
  assert.equal(await runCli(["migrate"], missingMigrateFile.io), 2);
  assert.match(
    missingMigrateFile.output().stderr,
    /migrate requires exactly one legacy DESIGN\.md file path/,
  );

  const tooManyMigrateFiles = createIo({});
  assert.equal(await runCli(["migrate", "one.md", "two.md"], tooManyMigrateFiles.io), 2);
  assert.match(
    tooManyMigrateFiles.output().stderr,
    /migrate requires exactly one legacy DESIGN\.md file path/,
  );
});

test("CLI export usage errors cover required option values and file count", async () => {
  const missingFormat = createIo({});
  assert.equal(await runCli(["export", "DESIGN.md"], missingFormat.io), 2);
  assert.match(missingFormat.output().stderr, /export requires --format/);

  const missingFormatValue = createIo({});
  assert.equal(await runCli(["export", "--format", "DESIGN.md"], missingFormatValue.io), 2);
  assert.match(missingFormatValue.output().stderr, /Unknown export format 'DESIGN\.md'/);

  const invalidFormat = createIo({});
  assert.equal(await runCli(["export", "--format", "json", "DESIGN.md"], invalidFormat.io), 2);
  assert.match(invalidFormat.output().stderr, /Unknown export format 'json'/);

  const missingOutValue = createIo({});
  assert.equal(
    await runCli(
      ["export", "--format", "css", "--out", "--force", "DESIGN.md"],
      missingOutValue.io,
    ),
    2,
  );
  assert.match(missingOutValue.output().stderr, /export --out requires a file path/);

  const unknownExportOption = createIo({});
  assert.equal(
    await runCli(["export", "--format", "css", "--minify", "DESIGN.md"], unknownExportOption.io),
    2,
  );
  assert.match(unknownExportOption.output().stderr, /Unknown export option '--minify'/);

  const tooManyFiles = createIo({});
  assert.equal(await runCli(["export", "--format", "css", "one.md", "two.md"], tooManyFiles.io), 2);
  assert.match(tooManyFiles.output().stderr, /export requires exactly one DESIGN\.md file path/);
});

test("CLI prints package version", async () => {
  const harness = createIo({});

  const exitCode = await runCli(["--version"], harness.io);
  const output = harness.output();

  assert.equal(exitCode, 0);
  assert.equal(output.stdout, `${packageJson.version}\n`);
  assert.equal(output.stderr, "");

  const short = createIo({});
  assert.equal(await runCli(["-V"], short.io), 0);
  assert.equal(short.output().stdout, `${packageJson.version}\n`);
});

test("CLI export writes default css output next to input file", async () => {
  const harness = createIo({ "docs/DESIGN.md": validDesignMd });

  const exitCode = await runCli(["export", "--format", "css", "docs/DESIGN.md"], harness.io);
  const output = harness.output();

  assert.equal(exitCode, 0);
  assert.match(output.stdout, /wrote docs\/design-tokens\.css/);
  assert.match(output.writtenFiles["docs/design-tokens.css"] ?? "", /:root \{/);
  assert.equal(output.stderr, "");
});

test("CLI export writes default tailwind output", async () => {
  const harness = createIo({ "DESIGN.md": validDesignMd });

  const exitCode = await runCli(["export", "--format", "css-tailwind", "DESIGN.md"], harness.io);
  const output = harness.output();

  assert.equal(exitCode, 0);
  assert.match(output.stdout, /wrote theme\.css/);
  assert.match(output.writtenFiles["theme.css"] ?? "", /@theme static \{/);
});

test("CLI export protects existing output unless force is set", async () => {
  const blocked = createIo({ "DESIGN.md": validDesignMd }, { "custom.css": "old" });

  assert.equal(
    await runCli(["export", "--format", "css", "--out", "custom.css", "DESIGN.md"], blocked.io),
    2,
  );
  assert.match(blocked.output().stderr, /already exists/);
  assert.equal(blocked.output().writtenFiles["custom.css"], undefined);

  const forced = createIo({ "DESIGN.md": validDesignMd }, { "custom.css": "old" });
  assert.equal(
    await runCli(
      ["export", "--format", "css", "--out", "custom.css", "--force", "DESIGN.md"],
      forced.io,
    ),
    0,
  );
  assert.match(forced.output().writtenFiles["custom.css"] ?? "", /:root \{/);
});

test("CLI export exits 1 for blocking diagnostics and writes no file", async () => {
  const source = validDesignMd.replace('primary: "#1A1C1E"', 'primary: "red"');
  const harness = createIo({ "DESIGN.md": source });

  const exitCode = await runCli(["export", "--format", "css", "DESIGN.md"], harness.io);
  const output = harness.output();

  assert.equal(exitCode, 1);
  assert.match(output.stderr, /error invalid-color Colors\.primary:/);
  assert.equal(output.writtenFiles["design-tokens.css"], undefined);
});

test("CLI export reports read and write failures", async () => {
  const missing = createIo({});
  assert.equal(await runCli(["export", "--format", "css", "missing.md"], missing.io), 2);
  assert.match(missing.output().stderr, /failed to read 'missing\.md'/);

  const writeFailure = createIo(
    { "DESIGN.md": validDesignMd },
    {},
    { writeError: new Error("readonly filesystem") },
  );
  assert.equal(await runCli(["export", "--format", "css", "DESIGN.md"], writeFailure.io), 2);
  assert.match(
    writeFailure.output().stderr,
    /failed to write 'design-tokens\.css': readonly filesystem/,
  );
  assert.deepEqual(writeFailure.output().writtenFiles, {});
});

const legacyDesignMd = `---
name: Legacy CLI
description: Converted by CLI.
colors:
  primary: "#075985"
typography:
  body:
    fontFamily: Inter
    fontSize: 16px
    lineHeight: "1.5"
spacing:
  md: 16px
rounded:
  md: 8px
---
`;

test("CLI migrate writes converted document to stdout by default", async () => {
  const harness = createIo({ "legacy.md": legacyDesignMd });

  const exitCode = await runCli(["migrate", "legacy.md"], harness.io);
  const output = harness.output();

  assert.equal(exitCode, 0);
  assert.match(output.stdout, /^# Legacy CLI\n/);
  assert.match(output.stdout, /## Colors[\s\S]*primary: "#075985"/);
  assert.deepEqual(output.writtenFiles, {});
});

test("CLI migrate --write updates the input file", async () => {
  const harness = createIo({ "legacy.md": legacyDesignMd });

  const exitCode = await runCli(["migrate", "--write", "legacy.md"], harness.io);
  const output = harness.output();

  assert.equal(exitCode, 0);
  assert.match(output.stdout, /wrote legacy\.md/);
  assert.match(output.writtenFiles["legacy.md"] ?? "", /^# Legacy CLI\n/);
});

test("CLI migrate reports write failures", async () => {
  const harness = createIo(
    { "legacy.md": legacyDesignMd },
    {},
    { writeError: new Error("disk full") },
  );

  const exitCode = await runCli(["migrate", "--write", "legacy.md"], harness.io);
  const output = harness.output();

  assert.equal(exitCode, 2);
  assert.match(output.stderr, /failed to write 'legacy\.md': disk full/);
  assert.deepEqual(output.writtenFiles, {});
});

test("CLI migrate exits 1 for non-legacy input", async () => {
  const harness = createIo({ "DESIGN.md": validDesignMd });

  const exitCode = await runCli(["migrate", "DESIGN.md"], harness.io);
  const output = harness.output();

  assert.equal(exitCode, 1);
  assert.match(output.stderr, /error legacy-frontmatter/);
  assert.deepEqual(output.writtenFiles, {});
});
