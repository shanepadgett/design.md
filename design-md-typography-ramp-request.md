# DESIGN.md Typography Ramp Request

## Problem

Current `@shanepadgett/design.md` typography supports semantic `text` styles, but does not allow first-class primitive typography ramps for sizes, weights, line heights, or letter spacing.

Current spec-clean shape requires repeated values inside text styles:

```yaml
fontFamily:
  sans: "DM Sans, system-ui, sans-serif"
baseFontSize: "14px"
text:
  body:
    fontFamily: "{typography.fontFamily.sans}"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
```

This creates magic numbers inside semantic text styles. If several text styles share one size, weight, rhythm, or tracking value, there is no spec-clean primitive token to reference.

## Requested addition

Allow optional primitive typography ramps under the `Typography` root:

```yaml
fontSize:
  "1": "11px"
  "2": "12px"
  "3": "14px"
  "4": "16px"
  "5": "18px"
  "6": "20px"
fontWeight:
  "1": 400
  "2": 500
  "3": 600
  "4": 700
lineHeight:
  "1": 1.1
  "2": 1.25
  "3": 1.5
  "4": 1.65
  "5": 1.75
letterSpacing:
  "1": "-0.02em"
  "2": "-0.01em"
  "3": "0em"
  "4": "0.01em"
  "5": "0.12em"
```

Then semantic text styles can compose those primitives:

```yaml
text:
  body:
    fontFamily: "{typography.fontFamily.sans}"
    fontSize: "{typography.fontSize.3}"
    fontWeight: "{typography.fontWeight.1}"
    lineHeight: "{typography.lineHeight.3}"
  title:
    fontFamily: "{typography.fontFamily.sans}"
    fontSize: "{typography.fontSize.6}"
    fontWeight: "{typography.fontWeight.3}"
    lineHeight: "{typography.lineHeight.2}"
    letterSpacing: "{typography.letterSpacing.2}"
```

## Why this helps

- Removes repeated magic numbers from semantic text styles.
- Lets agents reuse one primitive type scale consistently.
- Supports numeric naming for size, weight, rhythm, and tracking while keeping `text` styles semantic.
- Mirrors color architecture: primitive ramps plus semantic aliases.
- Keeps rich design systems clean without forcing fake numeric `text` styles.

## Suggested spec update

Add optional root keys to `Typography`:

```md
Typography: `baseFontSize`, `fontFamily`, `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing`, `text`, `measure`
```

Text style properties should allow references to these paths:

```yaml
fontSize: "{typography.fontSize.3}"
fontWeight: "{typography.fontWeight.2}"
lineHeight: "{typography.lineHeight.3}"
letterSpacing: "{typography.letterSpacing.1}"
```

Lint/export behavior should:

- treat these keys as known typography keys
- not warn on camelCase key style for these spec keys
- validate numeric scale keys when quoted
- resolve references from `text` styles to these primitives
- export primitives when typography export supports CSS variables

These ramps should be optional. Minimal design files should stay simple, while richer systems can avoid repeated typography values.
