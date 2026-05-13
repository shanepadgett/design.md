import assert from "node:assert/strict";
import test from "node:test";
import { migrateDesignMd } from "../dist/index.js";

type DiagnosticSeverity = "error" | "warning";
type DiagnosticResult = {
  diagnostics: Array<{ rule: string; severity: DiagnosticSeverity }>;
};
type LegacyYamlErrorCase = [rule: string, yaml: string];

const legacyDesignMd = `---
name: Legacy Civic
description: Calm public-service interface.
version: alpha
colors:
  primary: "#075985"
  on-primary: "#ffffff"
  surface: "#f8fafc"
  on-surface: "#172033"
typography:
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: "400"
    lineHeight: "1.5"
spacing:
  2: 8px
  md: 16px
rounded:
  md: 8px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: "{spacing.2}"
    typography: "{typography.body-md}"
---

## Brand & Style

Existing overview prose stays.
`;

function assertDiagnostic(result: DiagnosticResult, rule: string, severity: DiagnosticSeverity) {
  assert.ok(
    result.diagnostics.some(
      (diagnostic) => diagnostic.rule === rule && diagnostic.severity === severity,
    ),
    `Expected ${severity} diagnostic '${rule}'. Got: ${result.diagnostics.map((diagnostic) => diagnostic.rule).join(", ")}`,
  );
}

test("migrate converts legacy frontmatter into section token fences", () => {
  const result = migrateDesignMd(legacyDesignMd, { filePath: "legacy.md" });

  assert.equal(result.valid, true);
  const output = result.output ?? "";
  assert.match(output, /^# Legacy Civic\n/);
  assert.doesNotMatch(output, /^---/);
  assert.match(output, /## Overview\n\nExisting overview prose stays\./);
  assert.match(output, /## Colors[\s\S]*primary: "#075985"/);
  assert.match(output, /## Typography[\s\S]*baseFontSize: "16px"/);
  assert.match(output, /body-md:[\s\S]*fontFamily: "Inter"/);
  assert.match(output, /fontWeight: 400/);
  assert.match(output, /lineHeight: 1\.5/);
  assert.match(output, /## Layout[\s\S]*spacing:[\s\S]*"2": "8px"/);
  assert.match(output, /## Shapes[\s\S]*radius:[\s\S]*md: "8px"/);
  assert.match(output, /button-primary:[\s\S]*base:/);
  assert.match(output, /radius: "\{shapes\.radius\.md\}"/);
  assert.match(output, /padding: "\{layout\.spacing\.2\}"/);
  assert.match(output, /typography: "typography\.text\.body-md"/);
  assertDiagnostic(result, "legacy-unknown-key", "warning");
});

test("migrate uses description when Overview prose is missing", () => {
  const result = migrateDesignMd(
    `---
name: Minimal
description: Converted overview.
colors:
  primary: "#000000"
---
`,
    { filePath: "legacy.md" },
  );

  assert.equal(result.valid, true);
  assert.match(result.output ?? "", /## Overview\n\nConverted overview\./);
});

test("migrate rejects files without legacy frontmatter", () => {
  const result = migrateDesignMd("# Already New\n\n## Overview\n\nDone.\n", {
    filePath: "DESIGN.md",
  });

  assert.equal(result.valid, false);
  assert.equal(result.output, undefined);
  assertDiagnostic(result, "legacy-frontmatter", "error");

  const empty = migrateDesignMd("", { filePath: "DESIGN.md" });
  assert.equal(empty.valid, false);
  assert.equal(empty.output, undefined);
  assertDiagnostic(empty, "legacy-frontmatter", "error");
});

test("migrate rejects unsupported legacy YAML features", () => {
  const result = migrateDesignMd(
    `---
name: Bad
colors:
  - primary
---
`,
    { filePath: "legacy.md" },
  );

  assert.equal(result.valid, false);
  assert.equal(result.output, undefined);
  assertDiagnostic(result, "legacy-yaml-unsupported", "error");
});

test("migrate rejects legacy YAML parser edge cases", () => {
  const cases: LegacyYamlErrorCase[] = [
    ["legacy-yaml", "colors"],
    ["legacy-yaml-key", ': "missing key"'],
    ["legacy-yaml-key", 'name : "spaced key"'],
    ["legacy-yaml-duplicate-key", "name: First\nname: Second"],
    ["legacy-yaml-empty-value", "colors:"],
    ["legacy-yaml-indentation", 'colors:\n   primary: "#075985"'],
    ["legacy-yaml-indentation", 'colors:\n    primary: "#075985"'],
    ["legacy-yaml-unsupported", "# comment"],
    ["legacy-yaml-unsupported", "colors:\n  primary: true"],
    ["legacy-yaml-unsupported", "colors:\n  primary: null"],
    ["legacy-yaml-unsupported", 'colors:\n  primary: ["#075985"]'],
    ["legacy-yaml-unsupported", "colors:\n  primary: >\n    #075985"],
    ["legacy-yaml-unsupported", 'colors:\n  primary: "#075985" # comment'],
    ["legacy-yaml-unsupported", 'colors:\n  primary: &brand "#075985"'],
    ["legacy-yaml-unsupported", 'colors:\n  primary: !color "#075985"'],
    ["legacy-yaml-unsupported", "<<: *defaults"],
    ["legacy-yaml-unsupported", "'name': Bad"],
    ["legacy-yaml-string", 'name: "Unclosed'],
    ["legacy-yaml-string", 'name: "Bad\\nescape"'],
    ["legacy-yaml-string", 'name: "Closed" trailing'],
    ["legacy-yaml", "---\nname: Extra document"],
    ["legacy-yaml", ""],
  ];

  for (const [rule, yaml] of cases) {
    const result = migrateDesignMd(`---\n${yaml}\n---\n`, { filePath: "legacy.md" });

    assert.equal(result.valid, false, `Expected '${rule}' to fail migration.`);
    assert.equal(result.output, undefined);
    assertDiagnostic(result, rule, "error");
  }
});

test("migrate rejects unclosed legacy frontmatter", () => {
  const result = migrateDesignMd("---\nname: Missing Close\n", { filePath: "legacy.md" });

  assert.equal(result.valid, false);
  assert.equal(result.output, undefined);
  assertDiagnostic(result, "legacy-frontmatter", "error");
});
