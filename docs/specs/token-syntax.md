# Token Syntax

Normative token fences use the Markdown info string `yaml` for editor highlighting, but consumers only need to support DESIGN.md Token YAML: a strict YAML-compatible subset.

````md
```yaml
primary: "#1A1C1E"
```
````

## DESIGN.md Token YAML

Token YAML supports:

- maps
- nested maps by indentation
- scalar lists
- double-quoted strings
- numbers

Token YAML does not support full YAML.

Unsupported syntax includes:

- YAML front matter
- comments
- tabs for indentation
- anchors and aliases
- merge keys
- tags
- block scalars with `|` or `>`
- flow arrays and flow objects
- multiple YAML documents
- booleans and nulls
- single-quoted strings
- unquoted string values

## Indentation

Indentation must use two spaces per nesting level. Tabs are invalid. Indentation may only increase by one level at a time.

```yaml
neutral:
  "50": "#fafafa"
  "900": "#111111"
```

## Keys

Normal keys are unquoted. Double-quoted keys are allowed when needed. Numeric keys must be double-quoted.

```yaml
primary: "#1A1C1E"
neutral:
  "50": "#fafafa"
```

Keys must not be empty, contain `.`, `{`, or `}`, or have leading/trailing whitespace. Kebab-case keys and quoted numeric scale keys are recommended. Other valid string keys are accepted with warnings because they may be normalized during export.

Duplicate keys in the same map are errors.

## Values

Leaf values must be double-quoted strings or numbers.

```yaml
fontSize: "1rem"
fontWeight: 600
```

Strings support only `\"` and `\\` escapes. Empty leaf values are invalid. A key with no value must introduce a nested map or scalar list.

## Lists

Lists contain only double-quoted strings or numbers. Inline arrays are invalid.

```yaml
themes:
  - "light"
  - "dark"
```

## Token references

Token references use `{path.to.token}`. References may appear as a whole value or embedded inside a string.

```yaml
accent: "{colors.primary}"
focusRing: "0 0 0 3px {colors.focus}"
```

References are allowed in any token leaf. Missing references and reference cycles are errors. Embedded references must resolve to primitive token values.

Prose may also use `{path.to.token}`. Token references in prose are validated.

## Token paths

Token paths start with the compiled section group name:

- `colors`
- `typography`
- `layout`
- `elevation`
- `shapes`
- `components`
- `iconography`
- `motion`

Nested map keys become dot-separated path segments.

```yaml
neutral:
  "50": "#fafafa"
```

The token path is `{colors.neutral.50}`.

## Themes

Themes are declared in `Metadata`.

```yaml
themes:
  - "light"
  - "dark"
defaultTheme: "light"
```

Theme names must be unique kebab-case strings. `defaultTheme` must match one declared theme.

When themes are declared, any map whose keys exactly match all declared themes is a themed token value.

```yaml
surface:
  light: "#ffffff"
  dark: "#111111"
```

Scalar values apply to all themes. Partial theme maps are errors. Without `Metadata`, inline theme maps are not recognized as themes.

References to themed tokens omit theme names. `{colors.surface}` resolves according to active theme.

## Colors

Color strings support this subset:

- `#rgb`
- `#rgba`
- `#rrggbb`
- `#rrggbbaa`
- `rgb(...)`
- `rgba(...)`
- `hsl(...)`
- `hsla(...)`
- `oklab(...)`
- `oklch(...)`
- `color(display-p3 ...)`
- `transparent`

Other named CSS colors are invalid.

## Dimensions and numbers

Dimension fields accept quoted CSS length or percentage strings using known CSS units. Numeric `0` is allowed where a dimension is expected.

Unitless non-zero numbers are only valid where the section schema permits numbers, such as `fontWeight`, `lineHeight`, `zIndex`, grid columns, and icon stroke width.
