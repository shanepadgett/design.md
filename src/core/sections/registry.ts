export const requiredSectionNames = [
  "Overview",
  "Colors",
  "Typography",
  "Layout",
  "Elevation",
  "Shapes",
] as const;

export const canonicalKnownSectionNames = [
  "Metadata",
  ...requiredSectionNames,
  "Components",
  "Iconography",
  "Motion",
  "Do's and Don'ts",
] as const;

export type KnownSectionName = (typeof canonicalKnownSectionNames)[number];

export type TokenGroupName =
  | "metadata"
  | "colors"
  | "typography"
  | "layout"
  | "elevation"
  | "shapes"
  | "components"
  | "iconography"
  | "motion";

export interface SectionDefinition {
  name: KnownSectionName;
  group?: TokenGroupName;
  required: boolean;
  tokenFence: "none" | "optional" | "required";
  proseRequired: boolean;
}

export const sectionDefinitions: readonly SectionDefinition[] = [
  {
    name: "Metadata",
    group: "metadata",
    required: false,
    tokenFence: "required",
    proseRequired: false,
  },
  {
    name: "Overview",
    required: true,
    tokenFence: "none",
    proseRequired: true,
  },
  {
    name: "Colors",
    group: "colors",
    required: true,
    tokenFence: "required",
    proseRequired: true,
  },
  {
    name: "Typography",
    group: "typography",
    required: true,
    tokenFence: "required",
    proseRequired: true,
  },
  {
    name: "Layout",
    group: "layout",
    required: true,
    tokenFence: "required",
    proseRequired: true,
  },
  {
    name: "Elevation",
    group: "elevation",
    required: true,
    tokenFence: "optional",
    proseRequired: true,
  },
  {
    name: "Shapes",
    group: "shapes",
    required: true,
    tokenFence: "required",
    proseRequired: true,
  },
  {
    name: "Components",
    group: "components",
    required: false,
    tokenFence: "required",
    proseRequired: true,
  },
  {
    name: "Iconography",
    group: "iconography",
    required: false,
    tokenFence: "required",
    proseRequired: true,
  },
  {
    name: "Motion",
    group: "motion",
    required: false,
    tokenFence: "required",
    proseRequired: true,
  },
  {
    name: "Do's and Don'ts",
    required: false,
    tokenFence: "none",
    proseRequired: true,
  },
] as const;

const definitionsByName = new Map<KnownSectionName, SectionDefinition>(
  sectionDefinitions.map((definition) => [definition.name, definition]),
);

export function getSectionDefinition(name: string): SectionDefinition | undefined {
  return definitionsByName.get(name as KnownSectionName);
}

export function isKnownSectionName(name: string): name is KnownSectionName {
  return definitionsByName.has(name as KnownSectionName);
}

export function canonicalOrderIndex(name: KnownSectionName): number {
  return canonicalKnownSectionNames.indexOf(name);
}
