# DESIGN.md Specification

DESIGN.md is a Markdown format for describing visual identity to humans, agents, and tooling. Prose explains design intent. Final `yaml` fences inside known sections contain normative design tokens.

The recommended filename is `DESIGN.md`, but tools may lint any Markdown file passed explicitly.

## Spec documents

- [Document structure](./document-structure.md)
- [Token syntax](./token-syntax.md)
- [Token sections](./token-sections.md)
- [Linting](./linting.md)
- [Exporting and tooling](./exporting.md)
- [Agent-oriented compact spec](./agent.md)

Future work lives in [Future enhancements](../future.md).

## Minimal shape

````md
# Acme Design

## Overview

Acme uses calm surfaces, strong typographic contrast, and restrained depth.

## Colors

Use primary color for the main action. Use surface and on-surface roles for default page backgrounds and text.

```yaml
primary: "#1A1C1E"
surface: "#F7F5F2"
on-surface: "#1A1C1E"
```

## Typography

Use a clear sans-serif stack for interface text. Body text is optimized for long-form reading.

```yaml
fontFamily:
  sans: "Inter, system-ui, sans-serif"
baseFontSize: "16px"
text:
  body:
    fontFamily: "{typography.fontFamily.sans}"
    fontSize: "1rem"
    lineHeight: 1.5
```

## Layout

Use a compact spacing rhythm with centered content containers.

```yaml
spacing:
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
container:
  md: "64rem"
grid:
  columns: 12
  gutter: "{layout.spacing.lg}"
```

## Elevation

Use borders and tonal contrast for most hierarchy. Reserve shadows for floating overlays.

## Shapes

Use modest radius for controls and cards. Avoid mixing sharp and round geometry in one view.

```yaml
radius:
  none: 0
  sm: "0.25rem"
  md: "0.5rem"
  full: "9999px"
borderWidth:
  thin: "1px"
borderStyle:
  default: "solid"
```
````

## Core rules

- First non-blank line must be exactly one `#` title.
- YAML front matter is not valid in the new format.
- Required sections are `Overview`, `Colors`, `Typography`, `Layout`, `Elevation`, and `Shapes`.
- `Metadata`, `Components`, `Iconography`, `Motion`, and `Do's and Don'ts` are optional known sections.
- Token-bearing sections use prose first and one final `yaml` fence.
- The `yaml` fence uses DESIGN.md Token YAML, a strict YAML subset.
- Prose should describe how to design with tokens, not repeat hard-coded token values.
