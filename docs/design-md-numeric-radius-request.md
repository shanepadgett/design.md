# DESIGN.md Numeric Radius Request

## Problem

Current `@shanepadgett/design.md` lint recommends named radius anchors such as `none`, `sm`, and `md`:

```text
warning missing-anchor Shapes.radius: Shapes.radius should define recommended anchors: none, sm, md.
```

That warning fires even when a design system intentionally uses a numeric radius scale:

```yaml
radius:
  "0": 0
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  full: "9999px"
```

For radius, numeric keys often work better than `sm`, `md`, and `lg` because radius is a scale. The meaning of “small” and “medium” varies by component family, while scale steps stay stable.

## Requested linter change

Allow numeric radius scales as first-class valid radius anchors. If `shapes.radius` includes quoted numeric keys, do not warn that `none`, `sm`, and `md` are missing.

Suggested behavior:

- Treat quoted integer keys as valid radius scale keys.
- Treat `"0"` or `none` as valid zero-radius anchors.
- Treat `full` as valid special radius anchor for pills and circles.
- Do not emit `missing-anchor` for `none`, `sm`, or `md` when a numeric scale is present.
- Optionally warn only when radius has neither named anchors nor numeric scale keys.

## Why this helps

- Numeric radius scales align with numeric spacing and typography primitives.
- Numbers communicate progression better than vague size names.
- `sm`, `md`, and `lg` become ambiguous across spacing, radius, type, shadow, and component sizes.
- Numeric scales support utility-first CSS without forcing alias tokens.
- `full` remains useful because it is a distinct shape behavior, not one step in the scale.

## Example accepted shape

```yaml
radius:
  "0": 0
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  full: "9999px"
borderWidth:
  "0": "0px"
  "1": "1px"
  "2": "2px"
borderStyle:
  solid: "solid"
  dashed: "dashed"
```

## Suggested rule update

Current rule seems to assume `none`, `sm`, and `md` are recommended anchors for all radius systems. New rule should be conditional:

```text
If Shapes.radius has no numeric scale keys and lacks none/sm/md, emit missing-anchor.
If Shapes.radius has numeric scale keys, treat scale as intentional and do not warn.
```

Named radius anchors can remain valid for minimal files, but numeric radius should be supported by default without warnings.
