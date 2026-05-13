<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/design-md-logo-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="assets/design-md-logo-light.png">
    <img alt="design.md" src="assets/design-md-logo-light.png" style="max-width: 520px; width: 80%;">
  </picture>
</p>

<p align="center">
Write design system notes and tokens in one Markdown file. Use <code>designmd</code> to lint
that file and export tokens to CSS.
</p>

## Run with npx

```bash
npx --yes @shanepadgett/design.md --help
```

## Validate a design file

```bash
npx --yes @shanepadgett/design.md lint DESIGN.md
```

Treat warnings as failures:

```bash
npx --yes @shanepadgett/design.md lint --strict DESIGN.md
```

## Export tokens

Export CSS custom properties:

```bash
npx --yes @shanepadgett/design.md export --format css --out design-tokens.css DESIGN.md
```

Export Tailwind-friendly CSS:

```bash
npx --yes @shanepadgett/design.md export --format css-tailwind --out theme.css DESIGN.md
```

Use `--force` to overwrite an existing output file.

## Migrate legacy files

Preview migration output:

```bash
npx --yes @shanepadgett/design.md migrate DESIGN.md
```

Update the file in place:

```bash
npx --yes @shanepadgett/design.md migrate --write DESIGN.md
```

## Print the spec

Print the full human-readable spec:

```bash
npx --yes @shanepadgett/design.md spec
```

Print the compact agent-oriented spec:

```bash
npx --yes @shanepadgett/design.md spec --agent
```

## Library API

```ts
import { exportDesignMd, lintDesignMd, parseDesignMd } from "@shanepadgett/design.md";
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
