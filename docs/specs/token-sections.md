# Token Sections

Each known section compiles to one token group. Section prose explains how to apply tokens. Section Token YAML contains machine-readable values.

## Metadata

`Metadata` is optional unless themes are used. If present, it must be the first H2 section after the H1.

Allowed keys:

- `themes`
- `defaultTheme`

```yaml
themes:
  - "light"
  - "dark"
defaultTheme: "light"
```

No `name`, `description`, or version fields are part of Metadata. The H1 is the design system name. Overview prose is the description.

## Overview

`Overview` is required and prose-only. It describes visual identity, audience, personality, and intended emotional response.

## Colors

`Colors` is required and must define at least one color token.

Color maps may nest. Leaves are color strings, token references, or themed values. Themed values require `Metadata` with declared themes.

```yaml
primary: "oklch(62% 0.18 250)"
surface:
  light: "#ffffff"
  dark: "#111111"
on-surface:
  light: "#1A1C1E"
  dark: "#F7F5F2"
neutral:
  "50": "#fafafa"
  "900": "#111111"
```

Recommended anchors:

- `primary`
- `surface`
- `on-surface`

Missing recommended anchors produce warnings, not errors.

## Typography

`Typography` is required.

Required keys:

- `baseFontSize`
- `text`

Optional keys:

- `fontFamily`
- `fontSize`
- `fontWeight`
- `lineHeight`
- `letterSpacing`
- `measure`

`text` must contain at least one text style. Each text style requires `fontFamily`, `fontSize`, and `lineHeight`.

```yaml
fontFamily:
  sans: "Inter, system-ui, sans-serif"
  mono: "SFMono-Regular, ui-monospace, monospace"
baseFontSize: "16px"
fontSize:
  "1": "0.875rem"
  "2": "1rem"
  "3": "1.5rem"
fontWeight:
  "1": 400
  "2": 700
lineHeight:
  "1": 1.15
  "2": 1.5
letterSpacing:
  "1": "-0.02em"
  "2": "0em"
measure:
  body: "38rem"
  heading: "28rem"
text:
  body:
    fontFamily: "{typography.fontFamily.sans}"
    fontSize: "{typography.fontSize.2}"
    lineHeight: "{typography.lineHeight.2}"
    fontWeight: "{typography.fontWeight.1}"
  heading:
    fontFamily: "{typography.fontFamily.sans}"
    fontSize: "{typography.fontSize.3}"
    lineHeight: "{typography.lineHeight.1}"
    fontWeight: "{typography.fontWeight.2}"
    letterSpacing: "{typography.letterSpacing.1}"
```

Primitive typography ramps are optional. Use them when several text styles share sizes, weights, line heights, or letter spacing values.

Text style fields:

- `fontFamily`
- `fontSize`
- `fontWeight`
- `lineHeight`
- `letterSpacing`
- `fontFeature`
- `fontVariation`

Recommended text anchors include `body` or `body-md`.

## Layout

`Layout` is required.

Required keys:

- `spacing`

Optional keys:

- `container`
- `grid`
- `breakpoint`

`spacing` must contain at least one dimension token. Spacing values are dimensions or numeric `0`; non-zero unitless numbers belong in other layout fields.

```yaml
spacing:
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
container:
  md: "64rem"
  lg: "80rem"
grid:
  columns: 12
  gutter: "{layout.spacing.lg}"
breakpoint:
  md: "48rem"
  lg: "64rem"
```

Recommended spacing anchors are `sm`, `md`, and `lg`. Quoted integer spacing scales such as `"0"`, `"1"`, and `"2"` are also valid anchors and do not produce missing-anchor warnings.

## Elevation

`Elevation` is required. It explains how hierarchy and depth work: shadows, borders, tonal contrast, overlays, or intentionally flat composition.

Token YAML is optional. If present, allowed keys are:

- `shadow`
- `zIndex`

```yaml
shadow:
  sm: "0 1px 2px rgb(0 0 0 / 0.08)"
  md: "0 8px 24px rgb(0 0 0 / 0.12)"
zIndex:
  base: 0
  dropdown: 100
  modal: 1000
```

Surface and layer colors belong in `Colors`, not `Elevation`.

## Shapes

`Shapes` is required.

Required keys:

- `radius`

Optional keys:

- `borderWidth`
- `borderStyle`

`radius` must contain at least one token. `borderStyle` values must be quoted CSS border-style keywords such as `solid`, `dashed`, `dotted`, `double`, or `none`.

```yaml
radius:
  none: 0
  sm: "0.25rem"
  md: "0.5rem"
  full: "9999px"
borderWidth:
  thin: "1px"
  thick: "2px"
borderStyle:
  default: "solid"
```

Recommended radius anchors are `none`, `sm`, `md`, and `full`.

## Components

`Components` is optional. It defines component-level design decisions for agents and linters. Components are not exported to CSS by default.

Each component has optional `base` and optional `variants`; at least one must be present. Variant axes are freeform.

```yaml
button:
  base:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    radius: "{shapes.radius.md}"
    padding: "{layout.spacing.md}"
  variants:
    intent:
      secondary:
        backgroundColor: "{colors.surface}"
        textColor: "{colors.on-surface}"
    state:
      hover:
        shadow: "{elevation.shadow.sm}"
```

Variant resolution merges `base` first, then selected variant values by axis. Compound variants are not part of the initial spec.

Known component properties:

- `backgroundColor`
- `textColor`
- `borderColor`
- `typography`
- `radius`
- `borderWidth`
- `borderStyle`
- `padding`
- `gap`
- `height`
- `width`
- `minHeight`
- `minWidth`
- `shadow`
- `zIndex`
- `transitionDuration`
- `transitionEasing`

Unknown component properties are preserved and produce warnings.

Flat legacy component maps are preserved by migration but produce warnings in the new format.

## Iconography

`Iconography` is optional. It gives agents and tooling enough context to choose consistent icons. It does not install icon libraries or generate SVGs.

Required keys:

- `library`

Optional keys:

- `style`
- `strokeWidth`
- `grid`
- `size`
- `color`

```yaml
library: "Lucide"
style: "outlined"
strokeWidth: 1.5
grid: "24px"
size:
  sm: "16px"
  md: "24px"
  lg: "32px"
color: "{colors.on-surface}"
```

Recommended style values are `outlined`, `filled`, `rounded`, `sharp`, and `duotone`. Unknown style values are preserved and produce warnings.

CSS exporters may emit icon size, stroke width, and color variables. `library` and `style` are implementation guidance.

## Motion

`Motion` is optional.

Allowed keys:

- `duration`
- `easing`
- `reducedMotion`

```yaml
duration:
  fast: "150ms"
  medium: "300ms"
  slow: "600ms"
easing:
  standard: "cubic-bezier(0.2, 0, 0, 1)"
  emphasized: "cubic-bezier(0.2, 0, 0, 1.5)"
reducedMotion:
  medium: "100ms"
  slow: "100ms"
```

Duration values are quoted CSS time strings or numeric `0`. Easing values are quoted CSS keywords or supported easing functions: `cubic-bezier(...)`, `linear(...)`, and `steps(...)`.

Durations greater than `200ms` should have same-key entries in `reducedMotion`.

## Do's and Don'ts

`Do's and Don'ts` is optional and prose/list-only.

```md
## Do's and Don'ts

- Do use one primary action per screen.
- Don't stack cards inside cards.
```
