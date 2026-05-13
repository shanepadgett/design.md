# design.md

## Development

This repo uses [mise](https://mise.jdx.dev/) to pin Node.js and run project
tasks.

```bash
mise install
npm install
mise run check
```

`mise run check` runs formatting, linting, and TypeScript checks in sequence.
Formatting and lint tasks apply safe fixes first, then report remaining issues.

Build CLI output with `mise run build`. Run tests with `mise run test`.
