# Exporting and Tooling

The CLI name documented by this spec is `designmd`.

## Commands

Core commands:

```bash
designmd lint DESIGN.md
designmd lint --strict DESIGN.md
designmd diff before.md after.md
designmd export --format css DESIGN.md
designmd export --format css-tailwind DESIGN.md
designmd migrate old-DESIGN.md > DESIGN.md
designmd migrate --write old-DESIGN.md
```

All commands should accept a file path. Standard input support may be added where useful.

## Library API

The preferred library API is functional:

```ts
parseDesignMd(source)
lintDesignMd(source)
exportDesignMd(source, { format: "css" })
diffDesignMd(before, after)
```

Exact TypeScript interfaces are implementation details until the parser and linter stabilize.

## CSS custom properties

Plain CSS export emits default theme tokens in `:root`.

```css
:root {
  --color-primary: #1A1C1E;
  --spacing-md: 1rem;
}
```

When themes are declared, the default theme emits to `:root`. Non-default themes emit to data-theme selectors.

```css
:root {
  --color-surface: #ffffff;
}

[data-theme="dark"] {
  --color-surface: #111111;
}
```

References become CSS custom property references when possible. Embedded references are replaced inside composite strings.

```yaml
shadow:
  focus-ring: "0 0 0 3px {colors.focus}"
```

```css
--shadow-focus-ring: 0 0 0 3px var(--color-focus);
```

## CSS variable names

Exporters use mapped names, not exact internal paths.

| Token path | CSS custom property |
| --- | --- |
| `colors.*` | `--color-*` |
| `typography.fontFamily.*` | `--font-*` |
| `typography.text.*.fontSize` | `--text-*` |
| `typography.text.*.lineHeight` | `--leading-*` |
| `typography.text.*.letterSpacing` | `--tracking-*` |
| `typography.text.*.fontWeight` | `--font-weight-*` |
| `layout.spacing.*` | `--spacing-*` |
| `layout.container.*` | `--container-*` |
| `layout.breakpoint.*` | `--breakpoint-*` |
| `shapes.radius.*` | `--radius-*` |
| `shapes.borderWidth.*` | `--border-width-*` |
| `elevation.shadow.*` | `--shadow-*` |
| `elevation.zIndex.*` | `--z-index-*` |
| `motion.duration.*` | `--duration-*` |
| `motion.easing.*` | `--ease-*` |
| `iconography.size.*` | `--icon-size-*` |
| `iconography.strokeWidth` | `--icon-stroke-width` |
| `iconography.color` | `--icon-color` |

Token keys that require normalization are preserved in parsing but may be slugified during export. The linter warns for such keys.

## Tailwind CSS export

`css-tailwind` emits Tailwind v4-compatible theme variables.

```css
@theme {
  --color-primary: #1A1C1E;
  --spacing-md: 1rem;
  --radius-md: 0.5rem;
}
```

Theme overrides may emit additional CSS variables under `[data-theme="..."]` selectors where Tailwind-compatible output permits.

## Components and iconography

Components are not exported to CSS by default. They are structured guidance for agents, linting, and diffing.

Iconography exports only CSS-like values such as size, stroke width, and color. `library` and `style` guide implementation and code generation; they do not install packages or generate SVGs.

## Unknown keys

Unknown keys in known sections are preserved in the parsed design system and skipped by current exporters. The linter warns that these keys are preserved but not exported.

## Migration

`designmd migrate` converts legacy frontmatter-based DESIGN.md files into section-local token fences.

Default behavior writes converted Markdown to stdout. `--write` may update the input file in place.

Migration preserves existing prose where possible and injects tokens into matching canonical sections. Missing required sections are created with placeholder prose.

Legacy mapping:

- `colors` -> `## Colors`
- `typography` -> `## Typography` under `text`
- `spacing` -> `## Layout` under `spacing`
- `rounded` -> `## Shapes` under `radius`
- `components` -> `## Components`

Legacy flat components are preserved as flat maps and produce warnings under the new linter. Migration does not infer variants.

The migration parser accepts a looser simple legacy YAML subset, including unquoted scalar strings. It outputs strict DESIGN.md Token YAML with double-quoted strings.
