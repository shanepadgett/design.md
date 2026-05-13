# Contributing

## Local setup

This repo uses [mise](https://mise.jdx.dev/) to pin Node.js and run project
tasks.

```bash
mise install
npm install
```

## Common tasks

```bash
mise run build
mise run test
mise run check
```

`mise run check` runs formatting, linting, markdown linting, and TypeScript
checks.

## Direct npm scripts

```bash
npm run build
npm test
npm run typecheck
npm run lint:check
npm run format:check
npm run markdownlint:check
```

Use fix scripts when needed:

```bash
npm run format:fix
npm run lint:fix
npm run markdownlint:fix
```

## CLI during development

Build first, then run the local CLI:

```bash
npm run build
node dist/cli/main.js --help
node dist/cli/main.js lint examples/civic-signal/DESIGN.md
```
