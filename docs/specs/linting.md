# Linting

The linter validates document structure, token syntax, section schemas, references, themes, accessibility checks, and export readiness.

## Severity

Diagnostics use only two severities:

- `error` fails default linting
- `warning` passes default linting but fails `--strict`

Summary data is separate from diagnostics. There is no `info` severity.

```json
{
  "valid": false,
  "diagnostics": [
    {
      "severity": "error",
      "rule": "missing-section",
      "path": "Typography",
      "message": "Missing required section."
    }
  ],
  "summary": {
    "errors": 1,
    "warnings": 0,
    "tokens": {
      "colors": 3,
      "typography": 2
    }
  }
}
```

## Document rules

Errors:

- missing H1 title
- multiple H1 titles
- YAML front matter in linted files
- missing required section
- duplicate known section
- missing required prose in a known section
- missing required token fence in a token-bearing section
- multiple `yaml` fences in a known token-bearing section
- normative token fence is not the final non-whitespace block in its section

Warnings:

- known sections out of canonical order

Unknown sections are allowed and ignored for section order. YAML fences outside known token-bearing sections are ignored silently.

## Token syntax rules

Errors:

- invalid DESIGN.md Token YAML syntax
- invalid indentation
- comments inside token fences
- unquoted string values
- single-quoted strings
- empty leaf values
- duplicate keys
- unsupported YAML features

Warnings:

- keys that are valid but not recommended kebab-case or numeric scale keys

## Schema rules

Errors:

- invalid value type for a known field
- required section token minimum not met
- invalid color syntax
- invalid dimension or time syntax
- invalid `borderStyle` keyword
- invalid theme name
- `defaultTheme` not found in `themes`
- partial theme map

Warnings:

- unknown keys in known token sections
- unknown component properties
- unknown icon style values
- missing recommended token anchors

Unknown keys and properties are preserved in the parsed result. Current exporters skip them and lint warns that they are not exported.

## Reference rules

Errors:

- token reference path does not exist
- token reference cycle
- embedded reference resolves to a non-primitive value

Token references in prose are validated too.

## Prose hard-coded value rule

Prose should not use hard-coded token-like values. The linter warns when prose outside code fences contains hard-coded:

- colors
- dimensions
- time values

Examples include `#ffffff`, `oklch(...)`, `16px`, `1rem`, and `300ms`.

Use token names or `{path.to.token}` references instead.

## Recommended anchors

Warnings are produced when common anchors are missing:

- Colors: `primary`, `surface`, `on-surface`
- Typography: `body` or `body-md`
- Layout spacing: `sm`, `md`, `lg`
- Shapes radius: `none`, `sm`, `md`, `full`

These anchors are recommendations, not requirements.

## Contrast checks

Contrast warnings use WCAG AA normal text threshold `4.5:1`.

The linter checks:

- semantic color pairs when both exist: `surface`/`on-surface`, `primary`/`on-primary`, `secondary`/`on-secondary`, `error`/`on-error`
- component `backgroundColor` and `textColor` pairs after base/variant merge

For themed systems, contrast is checked per theme.

Alpha colors are composited over same-theme `surface` or `background` when available. If no backdrop token is available, tools may skip that pair without producing normal-mode noise.

## Exit codes

Default linting exits with code `1` when errors exist and `0` otherwise.

`--strict` exits with code `1` when errors or warnings exist.

## CLI and library output

The CLI hides parsed design system output.

The library API returns parsed design system data with lint results so generators and agents can reuse one parse pass.
