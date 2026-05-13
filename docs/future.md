# Future Enhancements

This document tracks agreed future work that is outside the initial spec/docs pass.

## Spec versioning

Add explicit spec versioning when the format needs compatibility guarantees.

Open decisions:

- where documents declare spec version
- how multiple spec schemas live side-by-side
- how lint selects a spec version
- whether migration commands support version-to-version upgrades

Current direction: keep current implementation validating the current format only. Shape code so multi-version validation can be added later.

## DTCG import/export

Add Design Tokens Community Group interoperability after core parsing, linting, and CSS export are stable.

Likely work:

- export DESIGN.md tokens to DTCG `tokens.json`
- import DTCG `tokens.json` into a draft DESIGN.md
- document unsupported fields and lossy mappings
- handle themes and nested groups deliberately

## Figma import path

Explore Figma Variables import after DTCG support exists.

Likely path:

1. Figma Variables
2. DTCG-compatible token JSON
3. DESIGN.md draft

Direct Figma plugin work is deferred.

## Identity-based examples

Create an `examples/` folder with three realistic identity-based DESIGN.md files.

Examples should not be generic schema fixtures. Each should express a strong visual identity and show how prose and tokens work together.

The three examples should collectively cover:

- light/dark themes
- nested color scales
- structured components
- iconography
- motion
- flat elevation and shadow-based elevation
- varied typography and shape language

Specific identities are undecided.

## Component CSS export

Components are not exported to CSS by default in the initial spec. Future work may add component variable export.

Open questions:

- variable naming for base and variant values
- variant selector strategy
- whether export should be opt-in only
- how to avoid bloated CSS output

## Icon manifests

Iconography currently guides agents and exports only CSS-like icon values. Future work may add icon manifests.

Possible manifest goals:

- map semantic icon names to library imports
- support multiple icon libraries
- support SVG path manifests
- support brand logos separately from UI icons

## Advanced component variants

Initial components support `base` plus simple variant axes. Future work may add:

- slots/anatomy
- compound variants
- default variants
- required variant axes
- component state inheritance rules

## Advanced layout

Initial layout supports one simple grid. Future work may add:

- named grids
- responsive grid definitions
- density modes
- safe area tokens
- media/content aspect ratio tokens

## Color and accessibility enhancements

Initial color support targets a known modern CSS color subset with sRGB conversion for contrast.

Future work may add:

- additional CSS color functions
- `color-mix(...)`
- relative color syntax
- `light-dark(...)`
- APCA contrast checks
- typography-aware contrast thresholds
- stricter alpha/backdrop modeling

## Spec bundling

The split spec docs are easier to maintain. Future tooling may add:

```bash
designmd spec
```

This command can print a bundled Markdown or JSON version for agents and tools.

## Migration improvements

Initial migration converts legacy frontmatter files conservatively. Future migration work may add:

- richer old-to-new component conversion
- alias heading conversion reports
- auto-fixes for hard-coded prose values
- safer `--write` backups
- migration dry-run summaries

## Implementation principles

The initial parser should keep the token syntax small and deterministic. A zero-dependency Token YAML parser remains a project goal, but it is an implementation principle rather than a normative file-format rule.
