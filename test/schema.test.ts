import assert from "node:assert/strict";
import test from "node:test";
import { lintDesignMd } from "../dist/index.js";
import {
  layoutYaml,
  replaceColorsYaml,
  replaceLayoutYaml,
  replaceShapesYaml,
  replaceTypographyYaml,
  validDesignMd,
  withComponentsYaml,
  withElevationYaml,
  withIconographyYaml,
  withMetadata,
  withMotionYaml,
} from "./fixtures.ts";

type DiagnosticSeverity = "error" | "warning";
type DiagnosticResult = {
  diagnostics: Array<{ rule: string; severity: DiagnosticSeverity; path?: string }>;
};
type RuleCase = [rule: string, yaml: string];
type SourceCase = [rule: string, source: string];
type SeverityCase = [rule: string, yaml: string, severity: DiagnosticSeverity];
type PathCase = [rule: string, yaml: string, path: string];

function lint(source: string) {
  return lintDesignMd(source, { filePath: "DESIGN.md" });
}

function assertDiagnostic(
  result: DiagnosticResult,
  rule: string,
  severity: DiagnosticSeverity,
  path?: string,
) {
  assert.ok(
    result.diagnostics.some(
      (diagnostic) =>
        diagnostic.rule === rule &&
        diagnostic.severity === severity &&
        (path === undefined || diagnostic.path === path),
    ),
    `Expected ${severity} diagnostic '${rule}'${path === undefined ? "" : ` at ${path}`}. Got: ${result.diagnostics.map((diagnostic) => `${diagnostic.rule}:${diagnostic.path ?? ""}`).join(", ")}`,
  );
}

test("schema validation reports color minimum and preserves unknown token keys", () => {
  assertDiagnostic(lint(replaceColorsYaml("")), "token-minimum", "error", "Colors");

  const result = lint(replaceLayoutYaml(`${layoutYaml}\ncustom: "1rem"`));

  assertDiagnostic(result, "unknown-key", "warning", "Layout.custom");
  assert.equal(result.designSystem.tokens.has("layout.custom"), true);
});

test("schema validation covers typography fields", () => {
  const cases: RuleCase[] = [
    [
      "invalid-dimension",
      replaceTypographyYaml(`fontFamily:
  sans: "Inter"
baseFontSize: "16"
text:
  body:
    fontFamily: "{typography.fontFamily.sans}"
    fontSize: "1rem"
    lineHeight: 1.5`),
    ],
    [
      "invalid-value-type",
      replaceTypographyYaml(`fontFamily:
  sans: "Inter"
baseFontSize: "16px"
text: "body"`),
    ],
    [
      "required-token",
      replaceTypographyYaml(`fontFamily:
  sans: "Inter"
baseFontSize: "16px"
text:
  body:
    fontFamily: "{typography.fontFamily.sans}"`),
    ],
    [
      "unknown-key",
      replaceTypographyYaml(`fontFamily:
  sans: "Inter"
baseFontSize: "16px"
text:
  body:
    fontFamily: "{typography.fontFamily.sans}"
    fontSize: "1rem"
    lineHeight: 1.5
    tracking: "tight"`),
    ],
    [
      "missing-anchor",
      replaceTypographyYaml(`fontFamily:
  sans: "Inter"
baseFontSize: "16px"
text:
  caption:
    fontFamily: "{typography.fontFamily.sans}"
    fontSize: "0.875rem"
    lineHeight: 1.4`),
    ],
  ];

  for (const [rule, source] of cases) {
    assertDiagnostic(
      lint(source),
      rule,
      rule === "unknown-key" || rule === "missing-anchor" ? "warning" : "error",
    );
  }
});

test("schema validation covers layout fields", () => {
  const cases: RuleCase[] = [
    ["required-token", 'container:\n  md: "64rem"'],
    ["invalid-value-type", 'spacing: "1rem"'],
    ["token-minimum", "spacing:"],
    ["invalid-dimension", "spacing:\n  sm: 1"],
    ["invalid-value-type", `${layoutYaml}\ngrid:\n  columns: "12"`],
    ["invalid-dimension", `${layoutYaml}\ngrid:\n  gutter: 1`],
    ["missing-anchor", 'spacing:\n  xs: "0.25rem"'],
  ];

  for (const [rule, yaml] of cases) {
    assertDiagnostic(
      lint(replaceLayoutYaml(yaml)),
      rule,
      rule === "missing-anchor" ? "warning" : "error",
    );
  }
});

test("schema validation covers elevation fields", () => {
  const cases: SeverityCase[] = [
    ["unknown-key", 'layer: "flat"', "warning"],
    ["invalid-value-type", "shadow:\n  sm: 1", "error"],
    ["invalid-value-type", 'zIndex:\n  modal: "top"', "error"],
    ["invalid-value-type", 'shadow: "0 1px 2px rgb(0 0 0 / 0.1)"', "error"],
  ];

  for (const [rule, yaml, severity] of cases) {
    assertDiagnostic(lint(withElevationYaml(yaml)), rule, severity);
  }
});

test("schema validation covers shapes fields", () => {
  const cases: SeverityCase[] = [
    ["required-token", 'borderWidth:\n  thin: "1px"', "error"],
    ["invalid-value-type", 'radius: "0.25rem"', "error"],
    ["token-minimum", "radius:", "error"],
    ["invalid-dimension", 'radius:\n  none: "none"', "error"],
    [
      "invalid-dimension",
      'radius:\n  none: 0\n  sm: "0.25rem"\n  md: "0.5rem"\n  full: "9999px"\nborderWidth:\n  thick: 2',
      "error",
    ],
    [
      "invalid-border-style",
      'radius:\n  none: 0\n  sm: "0.25rem"\n  md: "0.5rem"\n  full: "9999px"\nborderStyle:\n  default: "heavy"',
      "error",
    ],
    ["missing-anchor", 'radius:\n  sm: "0.25rem"', "warning"],
  ];

  for (const [rule, yaml, severity] of cases) {
    assertDiagnostic(lint(replaceShapesYaml(yaml)), rule, severity);
  }
});

test("schema validation covers component shape and properties", () => {
  const cases: PathCase[] = [
    ["invalid-value-type", 'button: "primary"', "Components.button"],
    ["component-shape", 'button:\n  style:\n    color: "#ffffff"', "Components.button"],
    ["unknown-key", 'button:\n  style:\n    color: "#ffffff"', "Components.button.style"],
    [
      "unknown-component-property",
      'button:\n  base:\n    custom: "value"',
      "Components.button.base.custom",
    ],
    [
      "invalid-value-type",
      'button:\n  base:\n    padding:\n      sm: "1rem"',
      "Components.button.base.padding",
    ],
    ["invalid-value-type", 'button:\n  base: "primary"', "Components.button.base"],
    ["invalid-value-type", 'button:\n  variants: "primary"', "Components.button.variants"],
    [
      "invalid-value-type",
      'button:\n  variants:\n    intent: "primary"',
      "Components.button.variants.intent",
    ],
    [
      "invalid-value-type",
      'button:\n  variants:\n    intent:\n      primary: "solid"',
      "Components.button.variants.intent.primary",
    ],
  ];

  for (const [rule, yaml, path] of cases) {
    const severity =
      rule === "unknown-key" || rule === "unknown-component-property" ? "warning" : "error";
    assertDiagnostic(lint(withComponentsYaml(yaml)), rule, severity, path);
  }
});

test("schema validation covers iconography fields", () => {
  const cases: SeverityCase[] = [
    ["required-token", 'style: "outlined"', "error"],
    ["invalid-value-type", "library: 1", "error"],
    ["invalid-value-type", 'library:\n  name: "Lucide"', "error"],
    ["invalid-value-type", 'library: "Lucide"\nstrokeWidth: "thick"', "error"],
    ["invalid-dimension", 'library: "Lucide"\ngrid: 24', "error"],
    ["invalid-dimension", 'library: "Lucide"\nsize:\n  sm: 16', "error"],
    ["invalid-color", 'library: "Lucide"\ncolor: "red"', "error"],
    ["unknown-icon-style", 'library: "Lucide"\nstyle: "skeuomorphic"', "warning"],
  ];

  for (const [rule, yaml, severity] of cases) {
    assertDiagnostic(lint(withIconographyYaml(yaml)), rule, severity);
  }
});

test("schema validation covers motion fields", () => {
  const cases: SeverityCase[] = [
    ["invalid-value-type", 'duration: "fast"', "error"],
    ["invalid-time", 'duration:\n  fast: "fast"', "error"],
    ["invalid-easing", 'easing:\n  standard: "spring"', "error"],
    ["missing-reduced-motion", 'duration:\n  slow: "300ms"', "warning"],
    ["unknown-key", 'curve: "ease"', "warning"],
  ];

  for (const [rule, yaml, severity] of cases) {
    assertDiagnostic(lint(withMotionYaml(yaml)), rule, severity);
  }
});

test("schema validation covers theme declarations and themed values", () => {
  const cases: SourceCase[] = [
    ["invalid-theme-declaration", withMetadata(`themes: "light"`)],
    ["invalid-theme-name", withMetadata(`themes:\n  - 1`)],
    ["invalid-theme-name", withMetadata(`themes:\n  - "Light"`)],
    ["duplicate-theme", withMetadata(`themes:\n  - "light"\n  - "light"`)],
    ["invalid-default-theme", withMetadata(`themes:\n  - "light"\ndefaultTheme: 1`)],
    [
      "themed-value-type",
      withMetadata(
        `themes:\n  - "light"\n  - "dark"\ndefaultTheme: "light"`,
        replaceColorsYaml(
          `primary:\n  light:\n    nested: "#1A1C1E"\n  dark: "#F7F5F2"\nsurface:\n  light: "#F7F5F2"\n  dark: "#111111"\non-surface:\n  light: "#1A1C1E"\n  dark: "#F7F5F2"`,
        ),
      ),
    ],
  ];

  for (const [rule, source] of cases) {
    assertDiagnostic(lint(source), rule, "error");
  }
});

test("schema validation keeps clean optional sections valid", () => {
  const source = withMotionYaml(
    `duration:\n  fast: "150ms"\n  slow: "300ms"\neasing:\n  standard: "ease-out"\nreducedMotion:\n  slow: "100ms"`,
    withIconographyYaml(
      `library: "Lucide"\nstyle: "outlined"\nstrokeWidth: 1.5\ngrid: "24px"\nsize:\n  sm: "16px"\ncolor: "{colors.on-surface}"`,
      withComponentsYaml(
        `button:\n  base:\n    backgroundColor: "{colors.surface}"\n    textColor: "{colors.on-surface}"\n    radius: "{shapes.radius.md}"`,
        validDesignMd,
      ),
    ),
  );

  assert.equal(lint(source).valid, true);
});
