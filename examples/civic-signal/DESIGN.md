# Civic Signal Design

## Metadata

```yaml
themes:
  - "light"
  - "dark"
defaultTheme: "light"
```

## Overview

Civic Signal is a public-service interface for dashboards, service status, permits, and resident alerts. It should feel calm, accountable, and fast to scan. Visual decisions favor clear hierarchy, generous whitespace, plain language, and dependable system patterns over novelty.

## Colors

The palette uses civic blue as the trust anchor, slate surfaces for long sessions, and explicit status colors for warnings or service interruptions. The light theme feels open and administrative. The dark theme supports operations rooms and low-light monitoring without changing semantic token names.

```yaml
blue:
  "100": "#E0F2FE"
  "300": "#7DD3FC"
  "700": "#075985"
  "900": "#05202E"
slate:
  "50": "#F8FAFC"
  "100": "#E2E8F0"
  "800": "#172033"
  "950": "#0B1020"
green:
  "600": "#047857"
  "950": "#022C22"
red:
  "100": "#FEE2E2"
  "700": "#B42318"
  "950": "#450A0A"
primary:
  light: "{colors.blue.700}"
  dark: "{colors.blue.300}"
on-primary:
  light: "#FFFFFF"
  dark: "{colors.blue.900}"
secondary:
  light: "{colors.green.600}"
  dark: "#86EFAC"
on-secondary:
  light: "#FFFFFF"
  dark: "{colors.green.950}"
surface:
  light: "{colors.slate.50}"
  dark: "{colors.slate.950}"
on-surface:
  light: "{colors.slate.800}"
  dark: "#E6EDF7"
surface-raised:
  light: "#FFFFFF"
  dark: "{colors.slate.800}"
outline:
  light: "{colors.slate.100}"
  dark: "#334155"
error:
  light: "{colors.red.700}"
  dark: "#FCA5A5"
on-error:
  light: "#FFFFFF"
  dark: "{colors.red.950}"
```

## Typography

Typography is optimized for dense civic information: readable body copy, compact labels, and direct page titles. The system prefers familiar sans-serif forms that do not call attention to themselves.

```yaml
fontFamily:
  sans: "Inter, ui-sans-serif, system-ui, sans-serif"
baseFontSize: "16px"
measure:
  prose: "68ch"
text:
  display:
    fontFamily: "{typography.fontFamily.sans}"
    fontSize: "2.5rem"
    lineHeight: 1.1
    fontWeight: 700
    letterSpacing: "-0.03em"
  heading:
    fontFamily: "{typography.fontFamily.sans}"
    fontSize: "1.5rem"
    lineHeight: 1.2
    fontWeight: 650
    letterSpacing: "-0.01em"
  body:
    fontFamily: "{typography.fontFamily.sans}"
    fontSize: "1rem"
    lineHeight: 1.6
    fontWeight: 400
  label:
    fontFamily: "{typography.fontFamily.sans}"
    fontSize: "0.8125rem"
    lineHeight: 1.3
    fontWeight: 650
    letterSpacing: "0.04em"
```

## Layout

Layouts should make public information easy to compare. Cards align to a steady grid, dense tables stay readable, and alert regions keep enough spacing to remain distinct without feeling promotional.

```yaml
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  section: "3rem"
container:
  content: "72rem"
  dashboard: "88rem"
grid:
  columns: 12
  gutter: "{layout.spacing.lg}"
breakpoint:
  sm: "40rem"
  md: "48rem"
  lg: "64rem"
  xl: "80rem"
```

## Elevation

Civic Signal is mostly flat. Separation comes from borders, surface color, and layout rhythm. Shadows are reserved for overlays that temporarily sit above the civic record.

```yaml
shadow:
  none: "none"
  overlay: "0 20px 48px rgb(15 23 42 / 0.18)"
zIndex:
  base: 0
  sticky: 20
  modal: 100
```

## Shapes

Shapes are modest and consistent. Corners should make cards approachable while preserving an institutional tone.

```yaml
radius:
  none: 0
  sm: "0.25rem"
  md: "0.5rem"
  lg: "0.75rem"
  full: "9999px"
borderWidth:
  thin: "1px"
  focus: "3px"
borderStyle:
  default: "solid"
```

## Components

Components use semantic color roles instead of one-off values. Status and action components keep text contrast high in both themes.

```yaml
alert-card:
  base:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.on-surface}"
    borderColor: "{colors.outline}"
    radius: "{shapes.radius.md}"
    padding: "{layout.spacing.lg}"
    gap: "{layout.spacing.md}"
service-button:
  base:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    radius: "{shapes.radius.sm}"
    padding: "{layout.spacing.md}"
    transitionDuration: "{motion.duration.fast}"
    transitionEasing: "{motion.easing.standard}"
  variants:
    intent:
      secondary:
        backgroundColor: "{colors.secondary}"
        textColor: "{colors.on-secondary}"
status-pill:
  base:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
    radius: "{shapes.radius.full}"
    padding: "{layout.spacing.sm}"
```

## Motion

Motion supports orientation and status changes without spectacle. Transitions should be quick, reversible, and easy to interrupt.

```yaml
duration:
  fast: "120ms"
  medium: "180ms"
easing:
  standard: "cubic-bezier(0.2, 0, 0, 1)"
  exit: "ease-in"
reducedMotion:
  fast: "0ms"
  medium: "0ms"
```

## Do's and Don'ts

- Do use semantic surface and status roles for every public-facing state.
- Do keep controls and messages visually calm even when content is urgent.
- Don't rely on color alone to communicate service status.
- Don't introduce decorative shadows into routine dashboard surfaces.
