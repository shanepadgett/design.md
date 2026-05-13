import type { CodeFence, DesignSection } from "../document/types.js";
import type { SectionDefinition } from "./registry.js";
import type { ParsedTokenYaml } from "../token-yaml/types.js";

export interface SectionTokenFence {
  section: DesignSection;
  definition: SectionDefinition;
  fence: CodeFence;
}

export interface ParsedSectionToken extends SectionTokenFence {
  parsed: ParsedTokenYaml;
}
