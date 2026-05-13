import assert from "node:assert/strict";
import test from "node:test";
import { migrateDesignMd } from "../dist/index.js";

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

function assertDiagnostic(result, rule, severity) {
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
  assert.match(result.output, /^# Legacy Civic\n/);
  assert.doesNotMatch(result.output, /^---/);
  assert.match(result.output, /## Overview\n\nExisting overview prose stays\./);
  assert.match(result.output, /## Colors[\s\S]*primary: "#075985"/);
  assert.match(result.output, /## Typography[\s\S]*baseFontSize: "16px"/);
  assert.match(result.output, /body-md:[\s\S]*fontFamily: "Inter"/);
  assert.match(result.output, /fontWeight: 400/);
  assert.match(result.output, /lineHeight: 1\.5/);
  assert.match(result.output, /## Layout[\s\S]*spacing:[\s\S]*"2": "8px"/);
  assert.match(result.output, /## Shapes[\s\S]*radius:[\s\S]*md: "8px"/);
  assert.match(result.output, /button-primary:[\s\S]*base:/);
  assert.match(result.output, /radius: "\{shapes\.radius\.md\}"/);
  assert.match(result.output, /padding: "\{layout\.spacing\.2\}"/);
  assert.match(result.output, /typography: "typography\.text\.body-md"/);
  assertDiagnostic(result, "legacy-unknown-key", "warning");
});

test("migrate uses description when Overview prose is missing", () => {
  const result = migrateDesignMd(`---
name: Minimal
description: Converted overview.
colors:
  primary: "#000000"
---
`, { filePath: "legacy.md" });

  assert.equal(result.valid, true);
  assert.match(result.output, /## Overview\n\nConverted overview\./);
});

test("migrate rejects files without legacy frontmatter", () => {
  const result = migrateDesignMd("# Already New\n\n## Overview\n\nDone.\n", { filePath: "DESIGN.md" });

  assert.equal(result.valid, false);
  assert.equal(result.output, undefined);
  assertDiagnostic(result, "legacy-frontmatter", "error");
});

test("migrate rejects unsupported legacy YAML features", () => {
  const result = migrateDesignMd(`---
name: Bad
colors:
  - primary
---
`, { filePath: "legacy.md" });

  assert.equal(result.valid, false);
  assert.equal(result.output, undefined);
  assertDiagnostic(result, "legacy-yaml-unsupported", "error");
});
