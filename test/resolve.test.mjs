import assert from "node:assert/strict";
import test from "node:test";
import { lintDesignMd } from "../dist/index.js";
import {
  replaceColorsYaml,
  replaceTypographyYaml,
  validDesignMd,
  withComponentsYaml,
  withMetadata,
} from "./fixtures.mjs";

function lint(source, options = {}) {
  return lintDesignMd(source, { filePath: "DESIGN.md", ...options });
}

function yaml(...lines) {
  return lines.join("\n");
}

function assertDiagnostic(result, rule, severity, path) {
  assert.ok(
    result.diagnostics.some(
      (diagnostic) => diagnostic.rule === rule
        && diagnostic.severity === severity
        && (path === undefined || diagnostic.path === path),
    ),
    `Expected ${severity} diagnostic '${rule}'${path === undefined ? "" : ` at ${path}`}. Got: ${result.diagnostics.map((diagnostic) => `${diagnostic.rule}:${diagnostic.path ?? ""}`).join(", ")}`,
  );
}

function assertNoDiagnostic(result, rule) {
  assert.equal(
    result.diagnostics.some((diagnostic) => diagnostic.rule === rule),
    false,
    `Expected no diagnostic '${rule}'. Got: ${result.diagnostics.map((diagnostic) => diagnostic.rule).join(", ")}`,
  );
}

test("embedded token references validate missing and non-primitive paths", () => {
  const validReference = lint(replaceTypographyYaml(yaml(
    "fontFamily:",
    "  sans: \"Inter\"",
    "baseFontSize: \"16px\"",
    "text:",
    "  body:",
    "    fontFamily: \"Inter, {typography.fontFamily.sans}\"",
    "    fontSize: \"1rem\"",
    "    lineHeight: 1.5",
  )));

  assertNoDiagnostic(validReference, "missing-reference");
  assertNoDiagnostic(validReference, "non-primitive-reference");

  assertDiagnostic(
    lint(replaceTypographyYaml(yaml(
      "fontFamily:",
      "  sans: \"Inter\"",
      "baseFontSize: \"16px\"",
      "text:",
      "  body:",
      "    fontFamily: \"Inter, {typography.fontFamily.missing}\"",
      "    fontSize: \"1rem\"",
      "    lineHeight: 1.5",
    ))),
    "missing-reference",
    "error",
  );

  assertDiagnostic(
    lint(replaceTypographyYaml(yaml(
      "fontFamily:",
      "  sans: \"Inter\"",
      "baseFontSize: \"16px\"",
      "text:",
      "  body:",
      "    fontFamily: \"Inter, {typography.fontFamily}\"",
      "    fontSize: \"1rem\"",
      "    lineHeight: 1.5",
    ))),
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
    lint(validDesignMd.replace("Acme uses calm surfaces", "Use { colors.primary } while Acme uses calm surfaces")),
    "invalid-reference",
    "error",
  );
});

test("themes resolve references while non-metadata light dark maps stay nested tokens", () => {
  const themed = withMetadata(
    yaml("themes:", "  - \"light\"", "  - \"dark\"", "defaultTheme: \"light\""),
    replaceColorsYaml(yaml(
      "primary: \"{colors.surface}\"",
      "surface:",
      "  light: \"#FFFFFF\"",
      "  dark: \"#111111\"",
      "on-surface:",
      "  light: \"#111111\"",
      "  dark: \"#FFFFFF\"",
    )),
  );
  const themedResult = lint(themed);

  assert.equal(themedResult.designSystem.themes.join(","), "light,dark");
  assert.equal(themedResult.designSystem.defaultTheme, "light");
  assertNoDiagnostic(themedResult, "missing-reference");

  const nestedResult = lint(replaceColorsYaml(yaml(
    "primary: \"#1A1C1E\"",
    "surface:",
    "  light: \"#FFFFFF\"",
    "  dark: \"#111111\"",
    "on-surface:",
    "  light: \"#111111\"",
    "  dark: \"#FFFFFF\"",
  )));

  assert.equal(nestedResult.designSystem.tokens.has("colors.surface.light"), true);
  assert.equal(nestedResult.designSystem.tokens.has("colors.surface"), false);
});

test("hard-coded prose warnings cover colors, dimensions, times, and skip code fences", () => {
  for (const value of ["#ffffff", "oklch(62% 0.18 250)", "16px", "300ms"]) {
    assertDiagnostic(
      lint(validDesignMd.replace("Acme uses calm surfaces", `Use ${value} while Acme uses calm surfaces`)),
      "hard-coded-prose-value",
      "warning",
    );
  }

  const codeFence = lint(validDesignMd.replace(
    "Acme uses calm surfaces and clear hierarchy.",
    "Acme uses calm surfaces and clear hierarchy.\n\n```css\n.button { margin: 16px; color: #ffffff; transition: 300ms; }\n```",
  ));

  assertNoDiagnostic(codeFence, "hard-coded-prose-value");
});

test("contrast checks every semantic color pair", () => {
  const cases = [
    ["colors.surface", "colors.on-surface", yaml("primary: \"#000000\"", "surface: \"#777777\"", "on-surface: \"#777777\"")],
    ["colors.primary", "colors.on-primary", yaml("primary: \"#777777\"", "on-primary: \"#777777\"", "surface: \"#ffffff\"", "on-surface: \"#000000\"")],
    ["colors.secondary", "colors.on-secondary", yaml("primary: \"#000000\"", "secondary: \"#777777\"", "on-secondary: \"#777777\"", "surface: \"#ffffff\"", "on-surface: \"#000000\"")],
    ["colors.error", "colors.on-error", yaml("primary: \"#000000\"", "error: \"#777777\"", "on-error: \"#777777\"", "surface: \"#ffffff\"", "on-surface: \"#000000\"")],
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
  const source = withComponentsYaml(yaml(
    "button:",
    "  base:",
    "    backgroundColor: \"{colors.surface}\"",
    "    textColor: \"{colors.surface}\"",
  ));

  assertDiagnostic(lint(source), "contrast", "warning", "Components.button.base");
});

test("contrast handles alpha compositing and skips alpha backgrounds without backdrop", () => {
  assertDiagnostic(
    lint(replaceColorsYaml(yaml(
      "primary: \"#000000\"",
      "on-primary: \"rgba(255 255 255 / 0.3)\"",
      "surface: \"#ffffff\"",
      "on-surface: \"#000000\"",
    ))),
    "contrast",
    "warning",
    "colors.primary/colors.on-primary",
  );

  assertDiagnostic(
    lint(replaceColorsYaml(yaml(
      "primary: \"rgba(255 255 255 / 0.5)\"",
      "on-primary: \"#ffffff\"",
      "surface: \"#ffffff\"",
      "on-surface: \"#000000\"",
    ))),
    "contrast",
    "warning",
    "colors.primary/colors.on-primary",
  );

  const skipped = lint(replaceColorsYaml(yaml(
    "primary: \"rgba(255 255 255 / 0.5)\"",
    "on-primary: \"#ffffff\"",
  )));
  assertNoDiagnostic(skipped, "contrast");
});

test("contrast parses supported color formats", () => {
  for (const surface of [
    "rgb(255 255 255)",
    "hsl(0 0% 100%)",
    "oklch(100% 0 0)",
    "color(display-p3 1 1 1)",
  ]) {
    const result = lint(replaceColorsYaml(yaml(
      "primary: \"#000000\"",
      `surface: "${surface}"`,
      "on-surface: \"#000000\"",
    )));

    assertNoDiagnostic(result, "invalid-color");
    assertNoDiagnostic(result, "contrast");
  }
});

test("lint API returns design system and accurate summary counts", () => {
  const validResult = lint(validDesignMd);
  assert.ok(Array.isArray(validResult.diagnostics));
  assert.equal(typeof validResult.summary.errors, "number");
  assert.ok(validResult.designSystem.tokens instanceof Map);
  assert.equal(validResult.designSystem.tokenCountByGroup.colors, 3);
  assert.equal(validResult.designSystem.tokenCountByGroup.layout, 3);

  const mixedResult = lint(
    replaceColorsYaml(yaml(
      "primary: \"red\"",
      "surface: \"#ffffff\"",
      "on-surface: \"#000000\"",
    )).replace(
      "Acme uses calm surfaces",
      "Use 16px while Acme uses calm surfaces",
    ),
  );

  assert.equal(mixedResult.summary.errors, 1);
  assert.equal(mixedResult.summary.warnings, 1);
});
