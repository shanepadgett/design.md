# DESIGN.md agent spec

Use this to create or maintain `DESIGN.md` files. Start minimal. Add optional sections only when user intent or existing document requires them. Do not copy every snippet into every file.

## Required shape

- First non-blank line is exactly one `#` title.
- YAML front matter is invalid.
- Required sections: `Overview`, `Colors`, `Typography`, `Layout`, `Elevation`, `Shapes`.
- Optional known sections: `Metadata`, `Components`, `Iconography`, `Motion`, `Do's and Don'ts`.
- Canonical order: `Metadata`, `Overview`, `Colors`, `Typography`, `Layout`, `Elevation`, `Shapes`, `Components`, `Iconography`, `Motion`, `Do's and Don'ts`.
- Known token-bearing sections use prose first and exactly one final `yaml` fence.
- Prose explains design use. Avoid repeating hard-coded token values in prose.

## Minimal valid file

````md
# Acme Design

## Overview

Acme uses calm surfaces, clear hierarchy, and restrained depth.

## Colors

Use semantic roles for surfaces, text, and primary actions.

```yaml
primary: "#1A1C1E"
surface: "#F7F5F2"
on-surface: "#1A1C1E"
```

## Typography

Use a readable sans-serif stack and body style for interface text.

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

Use borders and tonal contrast for most hierarchy. Reserve shadows for overlays.

## Shapes

Use modest radius for controls and cards.

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

## Optional snippets

### Metadata and themes

Themes are optional. Omit `Metadata`, `themes`, and `defaultTheme` for single-theme systems. Use themes only when multiple named visual modes exist. Theme maps should be complete for each theme.

```yaml
themes:
  - "light"
  - "dark"
defaultTheme: "light"
```

Then put matching theme maps in token sections:

```yaml
surface:
  light: "#F7F5F2"
  dark: "#1A1C1E"
on-surface:
  light: "#1A1C1E"
  dark: "#F7F5F2"
```

### Components

Use components when reusable UI parts need tokenized design rules. Variants override base properties.

```yaml
button:
  base:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.text.body}"
    radius: "{shapes.radius.md}"
    padding: "{layout.spacing.md}"
  variants:
    intent:
      secondary:
        backgroundColor: "{colors.surface}"
        textColor: "{colors.on-surface}"
```

### Iconography

Use iconography when icon library, geometry, size, or stroke choices are part of identity.

```yaml
library: "lucide"
style: "outlined"
strokeWidth: 2
grid: "24px"
size:
  md: "1.25rem"
color: "{colors.on-surface}"
```

### Motion

Use motion when timing/easing choices affect product feel.

```yaml
duration:
  fast: "150ms"
  normal: "250ms"
easing:
  standard: "cubic-bezier(0.2, 0, 0, 1)"
reducedMotion:
  normal: "100ms"
```

### Do's and Don'ts

Use this prose-only section for product-specific design guidance.

```md
## Do's and Don'ts

- Do use one primary action per screen.
- Don't stack cards inside cards.
```

## Token YAML subset

Allowed inside token fences: nested maps by spaces, scalar lists, double-quoted strings, numbers. Forbidden: comments, tabs, YAML front matter, anchors/aliases, merge keys, tags, block scalars, flow arrays/objects, multiple YAML documents, booleans, null, single-quoted strings, unquoted string values, empty leaf values, duplicate keys.

References use quoted `{path.to.token}` strings. Section roots are `colors`, `typography`, `layout`, `elevation`, `shapes`, `components`, `iconography`, `motion`.

## Section key cheat sheet

- `Colors`: semantic color tokens like `primary`, `on-primary`, `surface`, `on-surface`, `secondary`, `error`.
- `Typography`: `baseFontSize`, `fontFamily`, optional primitive ramps `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing`, `text`, `measure`; text style keys include `fontFamily`, `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing`, `fontFeature`, `fontVariation`.
- `Layout`: `spacing`, `container`, `grid`, `breakpoint`.
- `Elevation`: `shadow`, `zIndex`.
- `Shapes`: `radius`, `borderWidth`, `borderStyle`.
- `Components`: component names with `base` and optional `variants`; properties include `backgroundColor`, `textColor`, `borderColor`, `typography`, `radius`, `borderWidth`, `borderStyle`, `padding`, `gap`, `height`, `width`, `minHeight`, `minWidth`, `shadow`, `zIndex`, `transitionDuration`, `transitionEasing`.
- `Iconography`: `library`, `style`, `strokeWidth`, `grid`, `size`, `color`.
- `Motion`: `duration`, `easing`, `reducedMotion`.

## Common mistakes

- Do not add front matter before title.
- Do not put Markdown after token fence in same known token-bearing section.
- Do not put comments inside `yaml` fences.
- Do not use unquoted or single-quoted strings.
- Do not add optional sections or comprehensive token sets unless useful for user goal.
