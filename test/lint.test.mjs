import assert from "node:assert/strict";
import test from "node:test";
import { lintDesignMd } from "../dist/index.js";
import {
  appendSection,
  colorsYaml,
  fence,
  layoutYaml,
  replaceColorsYaml,
  replaceLayoutYaml,
  replaceTypographyYaml,
  validDesignMd,
  withMetadata,
} from "./fixtures.mjs";

function lint(source, options = {}) {
  return lintDesignMd(source, { filePath: "DESIGN.md", ...options });
}

function assertDiagnostic(result, rule, severity) {
  assert.ok(
    result.diagnostics.some(
      (diagnostic) => diagnostic.rule === rule && (severity === undefined || diagnostic.severity === severity),
    ),
    `Expected ${severity ?? "any"} diagnostic '${rule}'. Got: ${result.diagnostics.map((diagnostic) => diagnostic.rule).join(", ")}`,
  );
}

function assertNoDiagnostic(result, rule) {
  assert.equal(
    result.diagnostics.some((diagnostic) => diagnostic.rule === rule),
    false,
    `Expected no diagnostic '${rule}'.`,
  );
}

test("lintDesignMd accepts valid canonical document", () => {
  const result = lint(validDesignMd);

  assert.equal(result.valid, true);
  assert.equal(result.summary.errors, 0);
  assert.equal(result.summary.warnings, 0);
});

test("lintDesignMd reports missing required sections", () => {
  const result = lint("# Acme Design\n\n## Overview\n\nClear identity.\n");

  assert.equal(result.valid, false);
  assertDiagnostic(result, "missing-section", "error");
});

test("document structure diagnostics cover title, duplicate sections, and fence placement", () => {
  assertDiagnostic(lint(validDesignMd.replace("# Acme Design", "Acme Design")), "missing-title", "error");

  assertDiagnostic(lint(`${validDesignMd}\n# Other Title\n`), "multiple-title", "error");

  assertDiagnostic(lint(`---\n${validDesignMd}`), "front-matter", "error");

  assertDiagnostic(
    lint(appendSection(validDesignMd, `## Colors\n\nDuplicate color notes.\n\n${fence('accent: "#ffffff"')}`)),
    "duplicate-section",
    "error",
  );

  assertDiagnostic(
    lint(validDesignMd.replace("Use primary for the main action. Use surface roles for page backgrounds and text.\n\n", "")),
    "missing-prose",
    "error",
  );

  assertDiagnostic(
    lint(validDesignMd.replace(`\n${fence(layoutYaml)}\n`, "\n")),
    "missing-token-fence",
    "error",
  );

  assertDiagnostic(
    lint(validDesignMd.replace(fence(colorsYaml), `${fence(colorsYaml)}\n\n${fence('accent: "#ffffff"')}`)),
    "multiple-token-fences",
    "error",
  );

  assertDiagnostic(
    lint(validDesignMd.replace("```\n\n## Typography", "```\n\nToken prose after the fence.\n\n## Typography")),
    "token-fence-placement",
    "error",
  );

  assertDiagnostic(
    lint(
      validDesignMd.replace(
        "## Shapes",
        `## Components\n\nButtons use semantic colors.\n\n${fence(`button:\n  base:\n    backgroundColor: "{colors.primary}"\n    textColor: "{colors.surface}"`)}\n\n## Shapes`,
      ),
    ),
    "section-order",
    "warning",
  );

  assertDiagnostic(lint(`${validDesignMd}\n\`\`\`yaml\nprimary: "#ffffff"\n`), "unclosed-code-fence", "error");
});

test("document structure ignores unknown sections and non-token yaml fences", () => {
  const unknownSection = appendSection(
    validDesignMd,
    `## Implementation Notes\n\nThis section is ignored by token linting.\n\n${fence("not token yaml")}`,
  );
  const overviewFence = validDesignMd.replace(
    "Acme uses calm surfaces and clear hierarchy.\n",
    `Acme uses calm surfaces and clear hierarchy.\n\n${fence("not token yaml")}\n`,
  );

  assert.equal(lint(unknownSection).valid, true);
  assert.equal(lint(overviewFence).valid, true);
  assertNoDiagnostic(lint(unknownSection), "invalid-token-yaml");
  assertNoDiagnostic(lint(overviewFence), "invalid-token-yaml");
});

test("Token YAML syntax diagnostics cover strict subset failures", () => {
  const cases = [
    ["invalid-token-yaml", `- "#1A1C1E"`],
    ["invalid-token-yaml", `primary "#1A1C1E"`],
    ["invalid-indentation", `primary:\n surface: "#F7F5F2"\non-surface: "#1A1C1E"`],
    ["invalid-indentation", `primary:\n    deep: "#1A1C1E"\nsurface: "#F7F5F2"\non-surface: "#1A1C1E"`],
    ["comments-unsupported", `primary: "#1A1C1E"\n# no comments\nsurface: "#F7F5F2"\non-surface: "#1A1C1E"`],
    ["unquoted-string", `primary: red\nsurface: "#F7F5F2"\non-surface: "#1A1C1E"`],
    ["single-quoted-string", `primary: '#1A1C1E'\nsurface: "#F7F5F2"\non-surface: "#1A1C1E"`],
    ["empty-leaf-value", `primary:\nsurface: "#F7F5F2"\non-surface: "#1A1C1E"`],
    ["empty-leaf-value", `primary: ""\nsurface: "#F7F5F2"\non-surface: "#1A1C1E"`],
    ["duplicate-key", `primary: "#1A1C1E"\nprimary: "#222222"\nsurface: "#F7F5F2"\non-surface: "#1A1C1E"`],
    ["tabs-unsupported", `primary: "#1A1C1E"\n\tsurface: "#F7F5F2"\non-surface: "#1A1C1E"`],
    ["invalid-key", `: "#1A1C1E"\nsurface: "#F7F5F2"\non-surface: "#1A1C1E"`],
    ["invalid-key", `brand.primary: "#1A1C1E"\nsurface: "#F7F5F2"\non-surface: "#1A1C1E"`],
    ["numeric-key", `50: "#FAFAFA"\nprimary: "#1A1C1E"\nsurface: "#F7F5F2"\non-surface: "#1A1C1E"`],
    ["unsupported-scalar", `primary: true\nsurface: "#F7F5F2"\non-surface: "#1A1C1E"`],
    ["unsupported-yaml-feature", `primary: ["#1A1C1E"]\nsurface: "#F7F5F2"\non-surface: "#1A1C1E"`],
    ["unsupported-yaml-feature", `---\nprimary: "#1A1C1E"\nsurface: "#F7F5F2"\non-surface: "#1A1C1E"`],
    ["unsupported-yaml-feature", `primary: &brand "#1A1C1E"\nsurface: *brand\non-surface: "#1A1C1E"`],
    ["unsupported-yaml-feature", `primary: !color "#1A1C1E"\nsurface: "#F7F5F2"\non-surface: "#1A1C1E"`],
    ["unsupported-yaml-feature", `<<: *defaults\nprimary: "#1A1C1E"\nsurface: "#F7F5F2"\non-surface: "#1A1C1E"`],
    ["unsupported-yaml-feature", `primary: >-\n  #1A1C1E\nsurface: "#F7F5F2"\non-surface: "#1A1C1E"`],
  ];

  for (const [rule, yaml] of cases) {
    assertDiagnostic(lint(replaceColorsYaml(yaml)), rule, "error");
  }
});

test("section schema diagnostics cover invalid values, unknown keys, and recommended anchors", () => {
  assertDiagnostic(
    lint(replaceColorsYaml(`primary: "rebeccapurple"\nsurface: "#F7F5F2"\non-surface: "#1A1C1E"`)),
    "invalid-color",
    "error",
  );

  assertDiagnostic(
    lint(replaceTypographyYaml(`fontFamily:\n  sans: "Inter"\ntext:\n  body:\n    fontFamily: "{typography.fontFamily.sans}"\n    fontSize: "1rem"\n    lineHeight: 1.5`)),
    "required-token",
    "error",
  );

  assertDiagnostic(
    lint(replaceLayoutYaml(`spacing:\n  sm: "0.5rem"\n  md: "1rem"\n  lg: "1.5rem"\nunknownThing: "1rem"`)),
    "unknown-key",
    "warning",
  );

  assertDiagnostic(lint(replaceColorsYaml(`primary: "#1A1C1E"`)), "missing-anchor", "warning");
});

test("key-style warnings apply to token keys but not structural camelCase fields", () => {
  assertNoDiagnostic(lint(validDesignMd), "key-style");

  assertDiagnostic(
    lint(replaceColorsYaml(`brandPrimary: "#1A1C1E"\nprimary: "#1A1C1E"\nsurface: "#F7F5F2"\non-surface: "#1A1C1E"`)),
    "key-style",
    "warning",
  );

  assertNoDiagnostic(
    lint(replaceColorsYaml(`primary: "#1A1C1E"\nsurface: "#F7F5F2"\non-surface: "#1A1C1E"\nneutral:\n  "50": "#FAFAFA"`)),
    "key-style",
  );
});

test("reference diagnostics cover missing, non-primitive, prose, and cycle failures", () => {
  assertDiagnostic(
    lint(replaceTypographyYaml(`fontFamily:\n  sans: "Inter"\nbaseFontSize: "16px"\ntext:\n  body:\n    fontFamily: "{typography.fontFamily.missing}"\n    fontSize: "1rem"\n    lineHeight: 1.5`)),
    "missing-reference",
    "error",
  );

  assertDiagnostic(
    lint(replaceTypographyYaml(`fontFamily:\n  sans: "Inter"\nbaseFontSize: "16px"\ntext:\n  body:\n    fontFamily: "{typography.fontFamily}"\n    fontSize: "1rem"\n    lineHeight: 1.5`)),
    "non-primitive-reference",
    "error",
  );

  assertDiagnostic(
    lint(replaceColorsYaml(`primary: "{colors.secondary}"\nsecondary: "{colors.primary}"\nsurface: "#F7F5F2"\non-surface: "#1A1C1E"`)),
    "reference-cycle",
    "error",
  );

  assertDiagnostic(
    lint(validDesignMd.replace("Acme uses calm surfaces", "Use {colors.missing} while Acme uses calm surfaces")),
    "missing-reference",
    "error",
  );
});

test("theme diagnostics cover default theme and partial theme maps", () => {
  assertDiagnostic(
    lint(withMetadata(`themes:\n  - "light"\ndefaultTheme: "dark"`)),
    "default-theme-not-found",
    "error",
  );

  assertDiagnostic(
    lint(withMetadata(`themes:\n  - "light"\n  - "dark"\ndefaultTheme: "light"`, replaceColorsYaml(`primary:\n  light: "#1A1C1E"\nsurface:\n  light: "#F7F5F2"\n  dark: "#111111"\non-surface:\n  light: "#1A1C1E"\n  dark: "#F7F5F2"`))),
    "partial-theme-map",
    "error",
  );
});

test("hard-coded prose values warn and fail only in strict mode", () => {
  const source = validDesignMd.replace(
    "Acme uses calm surfaces and clear hierarchy.",
    "Acme uses calm surfaces and clear hierarchy. Avoid writing 16px in prose.",
  );

  const defaultResult = lint(source);
  const strictResult = lint(source, { strict: true });

  assertDiagnostic(defaultResult, "hard-coded-prose-value", "warning");
  assert.equal(defaultResult.valid, true);
  assert.equal(strictResult.valid, false);
});

test("contrast warnings cover semantic color pairs", () => {
  const result = lint(replaceColorsYaml(`primary: "#777777"\non-primary: "#777777"\nsurface: "#F7F5F2"\non-surface: "#1A1C1E"`));

  assertDiagnostic(result, "contrast", "warning");
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.path === "colors.primary/colors.on-primary"));
});

test("contrast warnings are checked per theme", () => {
  const themed = withMetadata(
    `themes:\n  - "light"\n  - "dark"\ndefaultTheme: "light"`,
    replaceColorsYaml(`primary: "#1A1C1E"\nsurface:\n  light: "#FFFFFF"\n  dark: "#111111"\non-surface:\n  light: "#111111"\n  dark: "#222222"`),
  );
  const result = lint(themed);

  assertDiagnostic(result, "contrast", "warning");
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.message.includes("theme 'dark'")));
});

test("contrast warnings cover component base and variant color pairs after merge", () => {
  const source = appendSection(
    replaceColorsYaml(`primary: "#000000"\non-primary: "#FFFFFF"\nsurface: "#F7F5F2"\non-surface: "#1A1C1E"`),
    `## Components\n\nButtons use semantic colors for every intent.\n\n${fence(`button:\n  base:\n    backgroundColor: "{colors.primary}"\n    textColor: "{colors.on-primary}"\n  variants:\n    intent:\n      secondary:\n        backgroundColor: "{colors.surface}"\n        textColor: "{colors.surface}"`)}`,
  );
  const result = lint(source);

  assertDiagnostic(result, "contrast", "warning");
  assert.ok(
    result.diagnostics.some(
      (diagnostic) => diagnostic.path === "Components.button.variants.intent.secondary",
    ),
  );
});
