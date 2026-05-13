export const colorsYaml = `primary: "#1A1C1E"
surface: "#F7F5F2"
on-surface: "#1A1C1E"`;

export const typographyYaml = `fontFamily:
  sans: "Inter, system-ui, sans-serif"
baseFontSize: "16px"
text:
  body:
    fontFamily: "{typography.fontFamily.sans}"
    fontSize: "1rem"
    lineHeight: 1.5`;

export const layoutYaml = `spacing:
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"`;

export const shapesYaml = `radius:
  none: 0
  sm: "0.25rem"
  md: "0.5rem"
  full: "9999px"`;

export const validDesignMd = `# Acme Design

## Overview

Acme uses calm surfaces and clear hierarchy.

## Colors

Use primary for the main action. Use surface roles for page backgrounds and text.

${fence(colorsYaml)}

## Typography

Use a clear sans-serif stack for interface text.

${fence(typographyYaml)}

## Layout

Use a compact spacing rhythm with centered content containers.

${fence(layoutYaml)}

## Elevation

Use borders and tonal contrast for most hierarchy.

## Shapes

Use modest radius for controls and cards.

${fence(shapesYaml)}
`;

export function fence(yaml) {
  return `\`\`\`yaml\n${yaml.trimEnd()}\n\`\`\``;
}

export function replaceColorsYaml(yaml, source = validDesignMd) {
  return replaceYaml(source, colorsYaml, yaml);
}

export function replaceTypographyYaml(yaml, source = validDesignMd) {
  return replaceYaml(source, typographyYaml, yaml);
}

export function replaceLayoutYaml(yaml, source = validDesignMd) {
  return replaceYaml(source, layoutYaml, yaml);
}

export function replaceShapesYaml(yaml, source = validDesignMd) {
  return replaceYaml(source, shapesYaml, yaml);
}

export function withElevationYaml(yaml, source = validDesignMd) {
  return source.replace(
    "Use borders and tonal contrast for most hierarchy.\n\n## Shapes",
    `Use borders and tonal contrast for most hierarchy.\n\n${fence(yaml)}\n\n## Shapes`,
  );
}

export function withComponentsYaml(yaml, source = validDesignMd) {
  return appendTokenSection(source, "Components", "Components use semantic tokens.", yaml);
}

export function withIconographyYaml(yaml, source = validDesignMd) {
  return appendTokenSection(source, "Iconography", "Icons follow one visual style.", yaml);
}

export function withMotionYaml(yaml, source = validDesignMd) {
  return appendTokenSection(source, "Motion", "Motion reinforces hierarchy.", yaml);
}

export function withMetadata(yaml, source = validDesignMd) {
  return source.replace(
    "# Acme Design\n\n",
    `# Acme Design\n\n## Metadata\n\n${fence(yaml)}\n\n`,
  );
}

export function appendSection(source, section) {
  return `${source.trimEnd()}\n\n${section.trimEnd()}\n`;
}

function appendTokenSection(source, name, prose, yaml) {
  return appendSection(source, `## ${name}\n\n${prose}\n\n${fence(yaml)}`);
}

function replaceYaml(source, oldYaml, newYaml) {
  return source.replace(fence(oldYaml), fence(newYaml));
}
