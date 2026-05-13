import assert from "node:assert/strict";
import test from "node:test";
import { runCli } from "../dist/cli/run.js";
import { validDesignMd } from "./fixtures.mjs";

function createIo(files) {
  let stdout = "";
  let stderr = "";

  return {
    io: {
      readFile: async (filePath) => {
        if (!Object.hasOwn(files, filePath)) {
          throw new Error("ENOENT");
        }

        return files[filePath];
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
    output: () => ({ stdout, stderr }),
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
