# Document Structure

DESIGN.md is a Markdown document with a required title, required design sections, optional known sections, and optional unknown sections.

## Title

The first non-blank line must be exactly one H1 heading:

```md
# Acme Design
```

The H1 is the design system name. A valid file must contain exactly one H1. YAML front matter is not valid; legacy front matter is handled only by `designmd migrate`.

## Section levels

Only H2 headings define DESIGN.md sections. H3 and deeper headings are prose structure inside the current H2 section.

Known sections use exact names. Aliases are not valid in the new format.

## Required sections

These sections are required:

1. `Overview`
2. `Colors`
3. `Typography`
4. `Layout`
5. `Elevation`
6. `Shapes`

`Overview` is prose-only. `Elevation` requires prose and may include tokens. `Colors`, `Typography`, `Layout`, and `Shapes` require prose and one final token fence.

## Optional known sections

These sections are optional:

1. `Metadata`
2. `Components`
3. `Iconography`
4. `Motion`
5. `Do's and Don'ts`

If `Metadata` appears, it must be the first H2 section after the H1 and must contain one final token fence. `Metadata` is required when themes are used.

If `Components`, `Iconography`, or `Motion` appears, the section must include prose and one final token fence.

`Do's and Don'ts` is prose/list-only.

## Canonical order

Known sections should appear in this order:

1. `Metadata`
2. `Overview`
3. `Colors`
4. `Typography`
5. `Layout`
6. `Elevation`
7. `Shapes`
8. `Components`
9. `Iconography`
10. `Motion`
11. `Do's and Don'ts`

Missing required sections are errors. Duplicate known sections are errors. Known sections out of order produce warnings. Unknown sections are ignored for order checks.

## Unknown sections

Unknown H2 sections are allowed anywhere. Tools preserve them and do not treat them as design tokens.

Code fences, including `yaml` fences, are allowed in unknown sections and are ignored by token tooling.

## Token fence placement

Token-bearing sections use one normative `yaml` fence. The fence must be the final non-whitespace block in the section.

````md
## Colors

Use primary color only for the most important action.

```yaml
primary: "#1A1C1E"
```
````

Multiple `yaml` fences in a known token-bearing section are errors. Non-`yaml` code fences may appear before the final token fence when needed.

YAML fences outside known token-bearing sections are ignored silently.

## Prose requirements

Every recognized section that appears must include non-empty prose before any normative token fence. Prose explains design rationale and usage. Token fences provide machine-readable values.
