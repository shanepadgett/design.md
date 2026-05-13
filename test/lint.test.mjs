import assert from "node:assert/strict";
import test from "node:test";
import { lintDesignMd } from "../dist/index.js";

const validDesignMd = `# Acme Design

## Overview

Acme uses calm surfaces and clear hierarchy.

## Colors

Use primary for the main action. Use surface roles for page backgrounds and text.

\`\`\`yaml
primary: "#1A1C1E"
surface: "#F7F5F2"
on-surface: "#1A1C1E"
\`\`\`

## Typography

Use a clear sans-serif stack for interface text.

\`\`\`yaml
fontFamily:
  sans: "Inter, system-ui, sans-serif"
baseFontSize: "16px"
text:
  body:
    fontFamily: "{typography.fontFamily.sans}"
    fontSize: "1rem"
    lineHeight: 1.5
\`\`\`

## Layout

Use a compact spacing rhythm with centered content containers.

\`\`\`yaml
spacing:
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
\`\`\`

## Elevation

Use borders and tonal contrast for most hierarchy.

## Shapes

Use modest radius for controls and cards.

\`\`\`yaml
radius:
  none: 0
  sm: "0.25rem"
  md: "0.5rem"
  full: "9999px"
\`\`\`
`;

test("lintDesignMd accepts valid canonical document", () => {
  const result = lintDesignMd(validDesignMd, { filePath: "DESIGN.md" });

  assert.equal(result.valid, true);
  assert.equal(result.summary.errors, 0);
});

test("lintDesignMd reports missing required sections", () => {
  const result = lintDesignMd("# Acme Design\n\n## Overview\n\nClear identity.\n");

  assert.equal(result.valid, false);
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.rule === "missing-section"));
});
