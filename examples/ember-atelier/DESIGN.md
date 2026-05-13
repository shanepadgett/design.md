# Ember Atelier Design

## Overview

Ember Atelier is an editorial commerce identity for a small fashion house. It should feel warm, tactile, and curated: like a lookbook, a fitting room, and a handwritten note working together. Interfaces should use contrast and restraint so product imagery remains the hero.

## Colors

The palette layers linen, ink, copper, and wine. Scales exist for nuance in editorial surfaces and commerce states. Primary actions use wine tones, while copper supports highlights, dividers, and accent moments.

```yaml
linen:
  "50": "#FFF8F1"
  "100": "#F7E8D7"
  "200": "#E8D0B8"
ink:
  "700": "#4A2A21"
  "900": "#2C1712"
copper:
  "300": "#D99A6C"
  "500": "#B85C38"
  "800": "#5C2314"
wine:
  "500": "#9F2D55"
  "700": "#7A1F3D"
  "950": "#2A0715"
rose:
  "100": "#FFE4EC"
  "400": "#E85D88"
primary: "{colors.wine.700}"
on-primary: "#FFF4F7"
secondary: "{colors.copper.800}"
on-secondary: "{colors.linen.50}"
surface: "{colors.linen.50}"
on-surface: "{colors.ink.900}"
surface-raised: "#FFFFFF"
outline: "{colors.linen.200}"
accent: "{colors.copper.300}"
error: "#B42318"
on-error: "#FFFFFF"
```

## Typography

Typography pairs a high-contrast editorial serif with a quiet sans-serif for commerce details. Headlines should feel composed and literary; transactional text should remain crisp.

```yaml
fontFamily:
  display: "Fraunces, Georgia, serif"
  sans: "Inter, ui-sans-serif, system-ui, sans-serif"
baseFontSize: "16px"
measure:
  editorial: "62ch"
text:
  display:
    fontFamily: "{typography.fontFamily.display}"
    fontSize: "4rem"
    lineHeight: 0.95
    fontWeight: 600
    letterSpacing: "-0.05em"
  heading:
    fontFamily: "{typography.fontFamily.display}"
    fontSize: "2rem"
    lineHeight: 1.05
    fontWeight: 550
    letterSpacing: "-0.03em"
  body:
    fontFamily: "{typography.fontFamily.sans}"
    fontSize: "1rem"
    lineHeight: 1.65
    fontWeight: 400
  label:
    fontFamily: "{typography.fontFamily.sans}"
    fontSize: "0.75rem"
    lineHeight: 1.25
    fontWeight: 700
    letterSpacing: "0.12em"
```

## Layout

Layouts should feel gallery-like with generous breathing room. Commerce flows still align to a reliable grid so product cards, filters, and checkout content stay easy to compare.

```yaml
spacing:
  xs: "0.375rem"
  sm: "0.75rem"
  md: "1.25rem"
  lg: "2rem"
  xl: "3rem"
  editorial: "5rem"
container:
  narrow: "42rem"
  gallery: "76rem"
  showcase: "96rem"
grid:
  columns: 12
  gutter: "{layout.spacing.lg}"
breakpoint:
  sm: "40rem"
  md: "52rem"
  lg: "72rem"
```

## Elevation

Depth is soft and physical, like paper resting on a table. Shadows should be broad and quiet, never glossy.

```yaml
shadow:
  soft: "0 18px 60px rgb(44 23 18 / 0.14)"
  lifted: "0 28px 90px rgb(44 23 18 / 0.20)"
zIndex:
  base: 0
  popover: 30
  modal: 90
```

## Shapes

Shapes mix tailored cards with rounded purchase controls. Large image containers can have expressive corners, while form fields stay precise.

```yaml
radius:
  none: 0
  sm: "0.375rem"
  md: "1rem"
  lg: "1.75rem"
  full: "9999px"
borderWidth:
  hairline: "1px"
  statement: "2px"
borderStyle:
  default: "solid"
  editorial: "double"
```

## Components

Commerce components should feel curated but never fragile. Every action remains obvious, and every card gives product imagery room to breathe.

```yaml
product-card:
  base:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.on-surface}"
    borderColor: "{colors.outline}"
    radius: "{shapes.radius.lg}"
    padding: "{layout.spacing.md}"
    shadow: "{elevation.shadow.soft}"
editorial-cta:
  base:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    radius: "{shapes.radius.full}"
    padding: "{layout.spacing.md}"
    transitionDuration: "{motion.duration.medium}"
    transitionEasing: "{motion.easing.emphasized}"
  variants:
    tone:
      copper:
        backgroundColor: "{colors.secondary}"
        textColor: "{colors.on-secondary}"
filter-chip:
  base:
    backgroundColor: "{colors.linen.100}"
    textColor: "{colors.on-surface}"
    borderColor: "{colors.outline}"
    radius: "{shapes.radius.full}"
    padding: "{layout.spacing.sm}"
```

## Iconography

Icons should be sparse and jewelry-like. Use them to clarify commerce actions, not to decorate every label.

```yaml
library: "Lucide"
style: "rounded"
strokeWidth: 1.5
grid: "24px"
size:
  sm: "1rem"
  md: "1.25rem"
  lg: "1.5rem"
color: "{colors.on-surface}"
```

## Motion

Motion should feel like fabric settling: soft enough to be elegant, short enough to keep checkout fast. Reduced motion keeps state changes immediate.

```yaml
duration:
  fast: "140ms"
  medium: "260ms"
  slow: "420ms"
easing:
  standard: "cubic-bezier(0.2, 0, 0, 1)"
  emphasized: "cubic-bezier(0.16, 1, 0.3, 1)"
reducedMotion:
  medium: "100ms"
  slow: "100ms"
```

## Do's and Don'ts

- Do let photography and editorial headlines carry emotional weight.
- Do use copper as an accent, not as a replacement for action color.
- Don't crowd product cards with badges or decorative icons.
- Don't mix sharp editorial containers with unrelated playful shapes.
