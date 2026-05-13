import assert from "node:assert/strict";
import test from "node:test";
import { lintDesignMd } from "../dist/index.js";
import type { DesignMdLintOptions } from "../dist/index.js";
import { validateContrast } from "../dist/core/resolve/contrast.js";
import type { ResolvedToken, SourceSpan } from "../dist/index.js";
import {
  replaceColorsYaml,
  replaceTypographyYaml,
  validDesignMd,
  withComponentsYaml,
  withMetadata,
} from "./fixtures.ts";

type DiagnosticSeverity = "error" | "warning";
type DiagnosticResult = {
  diagnostics: Array<{ rule: string; severity: DiagnosticSeverity; path?: string }>;
};
type ContrastCase = [backgroundPath: string, foregroundPath: string, colors: string];
type TokenValue = ResolvedToken["value"];

const span: SourceSpan = {
  start: { line: 1, column: 1, offset: 0 },
  end: { line: 1, column: 1, offset: 0 },
};

function lint(source: string, options: DesignMdLintOptions = {}) {
  return lintDesignMd(source, { filePath: "DESIGN.md", ...options });
}

function yaml(...lines: string[]): string {
  return lines.join("\n");
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

function assertNoDiagnostic(result: DiagnosticResult, rule: string) {
  assert.equal(
    result.diagnostics.some((diagnostic) => diagnostic.rule === rule),
    false,
    `Expected no diagnostic '${rule}'. Got: ${result.diagnostics.map((diagnostic) => diagnostic.rule).join(", ")}`,
  );
}

function token(path: string, value: TokenValue): ResolvedToken {
  const group = path.split(".")[0];
  assert.ok(group !== undefined);

  return {
    path,
    group: group as ResolvedToken["group"],
    value,
    references: [],
    span,
  };
}

function contrast(tokens: ResolvedToken[], themes: string[] = []) {
  return validateContrast(new Map(tokens.map((item) => [item.path, item])), themes);
}

test("embedded token references validate missing and non-primitive paths", () => {
  const validReference = lint(
    replaceTypographyYaml(
      yaml(
        "fontFamily:",
        '  sans: "Inter"',
        'baseFontSize: "16px"',
        "text:",
        "  body:",
        '    fontFamily: "Inter, {typography.fontFamily.sans}"',
        '    fontSize: "1rem"',
        "    lineHeight: 1.5",
      ),
    ),
  );

  assertNoDiagnostic(validReference, "missing-reference");
  assertNoDiagnostic(validReference, "non-primitive-reference");

  assertDiagnostic(
    lint(
      replaceTypographyYaml(
        yaml(
          "fontFamily:",
          '  sans: "Inter"',
          'baseFontSize: "16px"',
          "text:",
          "  body:",
          '    fontFamily: "Inter, {typography.fontFamily.missing}"',
          '    fontSize: "1rem"',
          "    lineHeight: 1.5",
        ),
      ),
    ),
    "missing-reference",
    "error",
  );

  assertDiagnostic(
    lint(
      replaceTypographyYaml(
        yaml(
          "fontFamily:",
          '  sans: "Inter"',
          'baseFontSize: "16px"',
          "text:",
          "  body:",
          '    fontFamily: "Inter, {typography.fontFamily}"',
          '    fontSize: "1rem"',
          "    lineHeight: 1.5",
        ),
      ),
    ),
    "non-primitive-reference",
    "error",
  );
});

test("prose token references validate valid and invalid shapes", () => {
  const validReference = lint(
    validDesignMd.replace(
      "Acme uses calm surfaces and clear hierarchy.",
      "Acme uses {colors.primary} and calm surfaces.",
    ),
  );

  assertNoDiagnostic(validReference, "invalid-reference");
  assertNoDiagnostic(validReference, "missing-reference");

  assertDiagnostic(
    lint(validDesignMd.replace("Acme uses calm surfaces", "Use { } while Acme uses calm surfaces")),
    "invalid-reference",
    "error",
  );

  assertDiagnostic(
    lint(
      validDesignMd.replace(
        "Acme uses calm surfaces",
        "Use { colors.primary } while Acme uses calm surfaces",
      ),
    ),
    "invalid-reference",
    "error",
  );
});

test("themes resolve references while non-metadata light dark maps stay nested tokens", () => {
  const themed = withMetadata(
    yaml("themes:", '  - "light"', '  - "dark"', 'defaultTheme: "light"'),
    replaceColorsYaml(
      yaml(
        'primary: "{colors.surface}"',
        "surface:",
        '  light: "#FFFFFF"',
        '  dark: "#111111"',
        "on-surface:",
        '  light: "#111111"',
        '  dark: "#FFFFFF"',
      ),
    ),
  );
  const themedResult = lint(themed);

  assert.equal(themedResult.designSystem.themes.join(","), "light,dark");
  assert.equal(themedResult.designSystem.defaultTheme, "light");
  assertNoDiagnostic(themedResult, "missing-reference");

  const nestedResult = lint(
    replaceColorsYaml(
      yaml(
        'primary: "#1A1C1E"',
        "surface:",
        '  light: "#FFFFFF"',
        '  dark: "#111111"',
        "on-surface:",
        '  light: "#111111"',
        '  dark: "#FFFFFF"',
      ),
    ),
  );

  assert.equal(nestedResult.designSystem.tokens.has("colors.surface.light"), true);
  assert.equal(nestedResult.designSystem.tokens.has("colors.surface"), false);
});

test("hard-coded prose warnings cover colors, dimensions, times, and skip code fences", () => {
  for (const value of ["#ffffff", "oklch(62% 0.18 250)", "16px", "300ms"]) {
    assertDiagnostic(
      lint(
        validDesignMd.replace(
          "Acme uses calm surfaces",
          `Use ${value} while Acme uses calm surfaces`,
        ),
      ),
      "hard-coded-prose-value",
      "warning",
    );
  }

  const codeFence = lint(
    validDesignMd.replace(
      "Acme uses calm surfaces and clear hierarchy.",
      "Acme uses calm surfaces and clear hierarchy.\n\n```css\n.button { margin: 16px; color: #ffffff; transition: 300ms; }\n```",
    ),
  );

  assertNoDiagnostic(codeFence, "hard-coded-prose-value");
});

test("contrast checks every semantic color pair", () => {
  const cases: ContrastCase[] = [
    [
      "colors.surface",
      "colors.on-surface",
      yaml('primary: "#000000"', 'surface: "#777777"', 'on-surface: "#777777"'),
    ],
    [
      "colors.primary",
      "colors.on-primary",
      yaml(
        'primary: "#777777"',
        'on-primary: "#777777"',
        'surface: "#ffffff"',
        'on-surface: "#000000"',
      ),
    ],
    [
      "colors.secondary",
      "colors.on-secondary",
      yaml(
        'primary: "#000000"',
        'secondary: "#777777"',
        'on-secondary: "#777777"',
        'surface: "#ffffff"',
        'on-surface: "#000000"',
      ),
    ],
    [
      "colors.error",
      "colors.on-error",
      yaml(
        'primary: "#000000"',
        'error: "#777777"',
        'on-error: "#777777"',
        'surface: "#ffffff"',
        'on-surface: "#000000"',
      ),
    ],
  ];

  for (const [backgroundPath, foregroundPath, colors] of cases) {
    assertDiagnostic(
      lint(replaceColorsYaml(colors)),
      "contrast",
      "warning",
      `${backgroundPath}/${foregroundPath}`,
    );
  }
});

test("contrast checks component base pairs", () => {
  const source = withComponentsYaml(
    yaml(
      "button:",
      "  base:",
      '    backgroundColor: "{colors.surface}"',
      '    textColor: "{colors.surface}"',
    ),
  );

  assertDiagnostic(lint(source), "contrast", "warning", "Components.button.base");
});

test("contrast handles alpha compositing and skips alpha backgrounds without backdrop", () => {
  assertDiagnostic(
    lint(
      replaceColorsYaml(
        yaml(
          'primary: "#000000"',
          'on-primary: "rgba(255 255 255 / 0.3)"',
          'surface: "#ffffff"',
          'on-surface: "#000000"',
        ),
      ),
    ),
    "contrast",
    "warning",
    "colors.primary/colors.on-primary",
  );

  assertDiagnostic(
    lint(
      replaceColorsYaml(
        yaml(
          'primary: "rgba(255 255 255 / 0.5)"',
          'on-primary: "#ffffff"',
          'surface: "#ffffff"',
          'on-surface: "#000000"',
        ),
      ),
    ),
    "contrast",
    "warning",
    "colors.primary/colors.on-primary",
  );

  const skipped = lint(
    replaceColorsYaml(yaml('primary: "rgba(255 255 255 / 0.5)"', 'on-primary: "#ffffff"')),
  );
  assertNoDiagnostic(skipped, "contrast");
});

test("contrast parses supported color formats", () => {
  for (const surface of [
    "rgb(255 255 255)",
    "hsl(0 0% 100%)",
    "oklch(100% 0 0)",
    "color(display-p3 1 1 1)",
  ]) {
    const result = lint(
      replaceColorsYaml(
        yaml('primary: "#000000"', `surface: "${surface}"`, 'on-surface: "#000000"'),
      ),
    );

    assertNoDiagnostic(result, "invalid-color");
    assertNoDiagnostic(result, "contrast");
  }
});

test("contrast skips unresolved, cyclic, and non-color token values", () => {
  assert.equal(
    contrast([
      token("colors.surface", "{colors.on-surface}"),
      token("colors.on-surface", "{colors.surface}"),
    ]).length,
    0,
  );

  assert.equal(
    contrast([
      token("colors.surface", "rgb({colors.missing} 255 255)"),
      token("colors.on-surface", "#000000"),
    ]).length,
    0,
  );

  assert.equal(
    contrast([token("colors.surface", { light: "#ffffff" }), token("colors.on-surface", "#000000")])
      .length,
    0,
  );

  assert.equal(
    contrast([
      token("components.button.base.backgroundColor", "#ffffff"),
      token("components.button.base.padding", "1rem"),
    ]).length,
    0,
  );
});

test("contrast covers color parser variants and invalid forms", () => {
  const noDiagnostics = contrast([
    token("colors.surface", "rgb(100% 100% 100% / 50%)"),
    token("colors.background", "#000000"),
    token("colors.on-surface", "hsl(0.5turn 0% 0% / 100%)"),
    token("colors.primary", "oklab(100% 0 0 / 1)"),
    token("colors.on-primary", "#000000"),
    token("colors.secondary", "oklch(100% 0 3.14159rad)"),
    token("colors.on-secondary", "#000000"),
    token("colors.error", "color(display-p3 100% 100% 100% / 1)"),
    token("colors.on-error", "#000000"),
  ]);

  assert.equal(noDiagnostics.length, 0);

  assert.equal(
    contrast([
      token("colors.surface", "#ffff"),
      token("colors.on-surface", "not-a-color"),
      token("colors.primary", "rgb(255 nope 255)"),
      token("colors.on-primary", "#000000"),
      token("colors.secondary", "hsl(0 0 0)"),
      token("colors.on-secondary", "#000000"),
      token("colors.error", "color(srgb 1 1 1)"),
      token("colors.on-error", "#000000"),
    ]).length,
    0,
  );

  assert.equal(
    contrast([
      token("colors.surface", "oklab(100% 0)"),
      token("colors.on-surface", "#000000"),
      token("colors.primary", "oklch(100% nope 0)"),
      token("colors.on-primary", "#000000"),
      token("colors.secondary", "rgba(255 255 255 / nope)"),
      token("colors.on-secondary", "#000000"),
      token("colors.error", "color(display-p3 1 1 nope)"),
      token("colors.on-error", "#000000"),
    ]).length,
    0,
  );
});

test("contrast covers HSL hue sectors in component colors", () => {
  const tokens = [0, 60, 120, 180, 240, 300].flatMap((hue, index) => [
    token(`components.swatch${index}.base.backgroundColor`, `hsl(${hue} 100% 100%)`),
    token(`components.swatch${index}.base.textColor`, "#000000"),
  ]);

  assert.equal(contrast(tokens).length, 0);
});

test("lint API returns design system and accurate summary counts", () => {
  const validResult = lint(validDesignMd);
  assert.ok(Array.isArray(validResult.diagnostics));
  assert.equal(typeof validResult.summary.errors, "number");
  assert.ok(validResult.designSystem.tokens instanceof Map);
  assert.equal(validResult.designSystem.tokenCountByGroup.colors, 3);
  assert.equal(validResult.designSystem.tokenCountByGroup.layout, 3);

  const mixedResult = lint(
    replaceColorsYaml(
      yaml('primary: "red"', 'surface: "#ffffff"', 'on-surface: "#000000"'),
    ).replace("Acme uses calm surfaces", "Use 16px while Acme uses calm surfaces"),
  );

  assert.equal(mixedResult.summary.errors, 1);
  assert.equal(mixedResult.summary.warnings, 1);
});
