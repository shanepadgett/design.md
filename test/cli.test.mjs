import assert from "node:assert/strict";
import test from "node:test";
import { runCli } from "../dist/cli/run.js";
import { validDesignMd } from "./fixtures.mjs";

function createIo(files, existingFiles = {}) {
  let stdout = "";
  let stderr = "";
  const writtenFiles = {};

  return {
    io: {
      fileExists: async (filePath) => Object.hasOwn(existingFiles, filePath)
        || Object.hasOwn(writtenFiles, filePath),
      readFile: async (filePath) => {
        if (!Object.hasOwn(files, filePath)) {
          throw new Error("ENOENT");
        }

        return files[filePath];
      },
      writeFile: async (filePath, content) => {
        writtenFiles[filePath] = content;
      },
      stdout: {
        write: (message) => {
          stdout += String(message);
        },
      },
      stderr: {
        write: (message) => {
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

test("CLI export writes default css output next to input file", async () => {
  const harness = createIo({ "docs/DESIGN.md": validDesignMd });

  const exitCode = await runCli(["export", "--format", "css", "docs/DESIGN.md"], harness.io);
  const output = harness.output();

  assert.equal(exitCode, 0);
  assert.match(output.stdout, /wrote docs\/design-tokens\.css/);
  assert.match(output.writtenFiles["docs/design-tokens.css"], /:root \{/);
  assert.equal(output.stderr, "");
});

test("CLI export writes default tailwind output", async () => {
  const harness = createIo({ "DESIGN.md": validDesignMd });

  const exitCode = await runCli(["export", "--format", "css-tailwind", "DESIGN.md"], harness.io);
  const output = harness.output();

  assert.equal(exitCode, 0);
  assert.match(output.stdout, /wrote theme\.css/);
  assert.match(output.writtenFiles["theme.css"], /@theme static \{/);
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
    await runCli(["export", "--format", "css", "--out", "custom.css", "--force", "DESIGN.md"], forced.io),
    0,
  );
  assert.match(forced.output().writtenFiles["custom.css"], /:root \{/);
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
  assert.match(output.writtenFiles["legacy.md"], /^# Legacy CLI\n/);
});

test("CLI migrate exits 1 for non-legacy input", async () => {
  const harness = createIo({ "DESIGN.md": validDesignMd });

  const exitCode = await runCli(["migrate", "DESIGN.md"], harness.io);
  const output = harness.output();

  assert.equal(exitCode, 1);
  assert.match(output.stderr, /error legacy-frontmatter/);
  assert.deepEqual(output.writtenFiles, {});
});
