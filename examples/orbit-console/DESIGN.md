# Orbit Console Design

## Metadata

```yaml
themes:
  - "dark"
  - "light"
defaultTheme: "dark"
```

## Overview

Orbit Console is a mission-control identity for observability, automation, and developer operations. It should feel precise, luminous, and resilient. Interfaces should support dense information, rapid triage, and confident action under pressure.

## Colors

The palette uses deep space surfaces with cyan and violet signal colors. The dark theme is primary. The light theme keeps the same semantic roles for documentation, reports, and bright workspaces.

```yaml
nebula:
  "200": "#B8C7FF"
  "500": "#7C83FF"
  "900": "#101432"
cyan:
  "200": "#A5F3FC"
  "300": "#67E8F9"
  "700": "#0E7490"
violet:
  "300": "#C4B5FD"
  "500": "#8B5CF6"
  "700": "#6D28D9"
  "900": "#2E1065"
red:
  "300": "#FDA4AF"
  "500": "#F43F5E"
  "700": "#BE123C"
  "950": "#4C0519"
primary:
  dark: "{colors.cyan.300}"
  light: "{colors.cyan.700}"
on-primary:
  dark: "#03131A"
  light: "#FFFFFF"
secondary:
  dark: "{colors.violet.300}"
  light: "{colors.violet.700}"
on-secondary:
  dark: "{colors.violet.900}"
  light: "#FFFFFF"
surface:
  dark: "#050816"
  light: "#F5F8FF"
on-surface:
  dark: "#E5F0FF"
  light: "#111827"
surface-raised:
  dark: "{colors.nebula.900}"
  light: "#FFFFFF"
outline:
  dark: "#29325C"
  light: "#CAD5F7"
error:
  dark: "{colors.red.300}"
  light: "{colors.red.700}"
on-error:
  dark: "{colors.red.950}"
  light: "#FFFFFF"
```

## Typography

Typography supports scanning telemetry and command labels. The sans family carries product text; the mono family marks system values and compact controls.

```yaml
fontFamily:
  sans: "Inter, ui-sans-serif, system-ui, sans-serif"
  mono: "JetBrains Mono, ui-monospace, SFMono-Regular, monospace"
baseFontSize: "16px"
measure:
  console: "72ch"
text:
  display:
    fontFamily: "{typography.fontFamily.sans}"
    fontSize: "3rem"
    lineHeight: 1
    fontWeight: 760
    letterSpacing: "-0.04em"
  heading:
    fontFamily: "{typography.fontFamily.sans}"
    fontSize: "1.375rem"
    lineHeight: 1.15
    fontWeight: 700
    letterSpacing: "-0.02em"
  body:
    fontFamily: "{typography.fontFamily.sans}"
    fontSize: "0.9375rem"
    lineHeight: 1.55
    fontWeight: 400
  code:
    fontFamily: "{typography.fontFamily.mono}"
    fontSize: "0.8125rem"
    lineHeight: 1.45
    fontWeight: 500
    letterSpacing: "-0.01em"
```

## Layout

Orbit layouts are dense but ordered. Panels snap to a strong grid, status strips remain compact, and command areas reserve enough room for long system names.

```yaml
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.875rem"
  lg: "1.25rem"
  xl: "2rem"
container:
  panel: "72rem"
  operations: "104rem"
grid:
  columns: 12
  gutter: "{layout.spacing.md}"
breakpoint:
  sm: "40rem"
  md: "56rem"
  lg: "72rem"
  xl: "96rem"
```

## Elevation

Depth should feel like luminous glass and layered instruments. Shadows indicate active focus, floating command surfaces, and critical overlays.

```yaml
shadow:
  panel: "0 20px 70px rgb(0 0 0 / 0.38)"
  glow: "0 0 36px rgb(103 232 249 / 0.24)"
  modal: "0 32px 120px rgb(0 0 0 / 0.55)"
zIndex:
  base: 0
  dock: 40
  command: 80
  modal: 120
```

## Shapes

Shapes are engineered and compact. Panels have controlled rounding; controls use pill shapes only for active filters and command chips.

```yaml
radius:
  none: 0
  sm: "0.25rem"
  md: "0.625rem"
  lg: "1rem"
  full: "9999px"
borderWidth:
  hairline: "1px"
  active: "2px"
borderStyle:
  default: "solid"
```

## Components

Components should preserve contrast in dense operational states. Variants can intensify signal color but must keep text roles explicit.

```yaml
command-palette:
  base:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.on-surface}"
    borderColor: "{colors.outline}"
    radius: "{shapes.radius.lg}"
    padding: "{layout.spacing.lg}"
    shadow: "{elevation.shadow.modal}"
telemetry-card:
  base:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.on-surface}"
    borderColor: "{colors.outline}"
    radius: "{shapes.radius.md}"
    padding: "{layout.spacing.md}"
    shadow: "{elevation.shadow.panel}"
  variants:
    emphasis:
      live:
        backgroundColor: "{colors.primary}"
        textColor: "{colors.on-primary}"
        shadow: "{elevation.shadow.glow}"
signal-badge:
  base:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
    radius: "{shapes.radius.full}"
    padding: "{layout.spacing.sm}"
danger-button:
  base:
    backgroundColor: "{colors.error}"
    textColor: "{colors.on-error}"
    radius: "{shapes.radius.sm}"
    padding: "{layout.spacing.md}"
    transitionDuration: "{motion.duration.fast}"
    transitionEasing: "{motion.easing.snap}"
```

## Iconography

Icons should look technical and legible at small sizes. Prefer outline icons with consistent stroke and avoid filled pictograms except for critical status glyphs.

```yaml
library: "Lucide"
style: "outlined"
strokeWidth: 1.75
grid: "24px"
size:
  sm: "0.875rem"
  md: "1.125rem"
  lg: "1.5rem"
color: "{colors.on-surface}"
```

## Motion

Motion communicates system state. Fast transitions acknowledge interaction, medium transitions move panels, and slow transitions are reserved for mode changes with reduced-motion fallbacks.

```yaml
duration:
  fast: "110ms"
  medium: "240ms"
  slow: "520ms"
easing:
  standard: "cubic-bezier(0.2, 0, 0, 1)"
  snap: "cubic-bezier(0.16, 1, 0.3, 1)"
  exit: "ease-in"
reducedMotion:
  medium: "100ms"
  slow: "100ms"
```

## Do's and Don'ts

- Do keep dense panels aligned to the same rhythm even when data is urgent.
- Do reserve glow treatment for live focus, not static decoration.
- Don't make danger actions visually similar to primary operational commands.
- Don't use motion as the only signal that automation state changed.
