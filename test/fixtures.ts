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

export function fence(yaml: string): string {
  return `\`\`\`yaml\n${yaml.trimEnd()}\n\`\`\``;
}

export function replaceColorsYaml(yaml: string, source = validDesignMd): string {
  return replaceYaml(source, colorsYaml, yaml);
}

export function replaceTypographyYaml(yaml: string, source = validDesignMd): string {
  return replaceYaml(source, typographyYaml, yaml);
}

export function replaceLayoutYaml(yaml: string, source = validDesignMd): string {
  return replaceYaml(source, layoutYaml, yaml);
}

export function replaceShapesYaml(yaml: string, source = validDesignMd): string {
  return replaceYaml(source, shapesYaml, yaml);
}

export function withElevationYaml(yaml: string, source = validDesignMd): string {
  return source.replace(
    "Use borders and tonal contrast for most hierarchy.\n\n## Shapes",
    `Use borders and tonal contrast for most hierarchy.\n\n${fence(yaml)}\n\n## Shapes`,
  );
}

export function withComponentsYaml(yaml: string, source = validDesignMd): string {
  return appendTokenSection(source, "Components", "Components use semantic tokens.", yaml);
}

export function withIconographyYaml(yaml: string, source = validDesignMd): string {
  return appendTokenSection(source, "Iconography", "Icons follow one visual style.", yaml);
}

export function withMotionYaml(yaml: string, source = validDesignMd): string {
  return appendTokenSection(source, "Motion", "Motion reinforces hierarchy.", yaml);
}

export function withMetadata(yaml: string, source = validDesignMd): string {
  return source.replace("# Acme Design\n\n", `# Acme Design\n\n## Metadata\n\n${fence(yaml)}\n\n`);
}

export function appendSection(source: string, section: string): string {
  return `${source.trimEnd()}\n\n${section.trimEnd()}\n`;
}

function appendTokenSection(source: string, name: string, prose: string, yaml: string): string {
  return appendSection(source, `## ${name}\n\n${prose}\n\n${fence(yaml)}`);
}

function replaceYaml(source: string, oldYaml: string, newYaml: string): string {
  return source.replace(fence(oldYaml), fence(newYaml));
}
