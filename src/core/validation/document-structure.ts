import type { Diagnostic } from "../diagnostics/types.js";
import {
  isFinalNonWhitespaceBlock,
  sectionHasProseBeforeLine,
} from "../document/parse-document.js";
import type { DesignDocument, DesignSection } from "../document/types.js";
import { lineSpan } from "../source/source-file.js";
import type { SectionTokenFence } from "../sections/tokens.js";
import {
  canonicalOrderIndex,
  getSectionDefinition,
  requiredSectionNames,
} from "../sections/registry.js";

export interface DocumentStructureValidation {
  diagnostics: Diagnostic[];
  tokenFences: SectionTokenFence[];
}

export function validateDocumentStructure(
  document: DesignDocument,
): DocumentStructureValidation {
  const diagnostics: Diagnostic[] = [];
  const tokenFences: SectionTokenFence[] = [];
  const knownSections = document.sections.filter((section) =>
    getSectionDefinition(section.name) !== undefined
  );

  validateRequiredSections(document, diagnostics);
  validateDuplicateKnownSections(document, diagnostics);
  validateKnownSectionOrder(document, knownSections, diagnostics);
  validateMetadataPosition(document, diagnostics);

  for (const section of document.sections) {
    const definition = getSectionDefinition(section.name);
    if (definition === undefined) {
      continue;
    }

    const yamlFences = section.fences.filter((fence) => fence.info === "yaml");
    const firstYamlFence = yamlFences[0];

    if (definition.proseRequired) {
      const hasProse = sectionHasProseBeforeLine(
        section,
        firstYamlFence?.openingLine.number,
      );

      if (!hasProse) {
        diagnostics.push({
          severity: "error",
          rule: "missing-prose",
          path: section.name,
          message: `Section '${section.name}' must include prose before tokens.`,
          span: lineSpan(document.sourceFile, section.heading.line),
        });
      }
    }

    if (definition.tokenFence === "none") {
      continue;
    }

    if (yamlFences.length === 0) {
      if (definition.tokenFence === "required") {
        diagnostics.push({
          severity: "error",
          rule: "missing-token-fence",
          path: section.name,
          message: `Section '${section.name}' must include one final yaml token fence.`,
          span: lineSpan(document.sourceFile, section.heading.line),
        });
      }

      continue;
    }

    if (firstYamlFence === undefined) {
      continue;
    }

    if (yamlFences.length > 1) {
      diagnostics.push({
        severity: "error",
        rule: "multiple-token-fences",
        path: section.name,
        message: `Section '${section.name}' must not include multiple yaml token fences.`,
        span: lineSpan(document.sourceFile, yamlFences[1]?.openingLine ?? section.heading.line),
      });
    }

    if (!isFinalNonWhitespaceBlock(section, firstYamlFence)) {
      diagnostics.push({
        severity: "error",
        rule: "token-fence-placement",
        path: section.name,
        message: `The yaml token fence in '${section.name}' must be the final block in the section.`,
        span: lineSpan(document.sourceFile, firstYamlFence.openingLine),
      });
    }

    tokenFences.push({ section, definition, fence: firstYamlFence });
  }

  return { diagnostics, tokenFences };
}

function validateRequiredSections(
  document: DesignDocument,
  diagnostics: Diagnostic[],
): void {
  const sectionNames = new Set(document.sections.map((section) => section.name));

  for (const requiredName of requiredSectionNames) {
    if (!sectionNames.has(requiredName)) {
      const diagnostic: Diagnostic = {
        severity: "error",
        rule: "missing-section",
        path: requiredName,
        message: `Missing required section '${requiredName}'.`,
      };

      if (document.title !== undefined) {
        diagnostic.span = lineSpan(document.sourceFile, document.title.line);
      }

      diagnostics.push(diagnostic);
    }
  }
}

function validateDuplicateKnownSections(
  document: DesignDocument,
  diagnostics: Diagnostic[],
): void {
  const seen = new Set<string>();

  for (const section of document.sections) {
    if (getSectionDefinition(section.name) === undefined) {
      continue;
    }

    if (seen.has(section.name)) {
      diagnostics.push({
        severity: "error",
        rule: "duplicate-section",
        path: section.name,
        message: `Duplicate known section '${section.name}'.`,
        span: lineSpan(document.sourceFile, section.heading.line),
      });
    } else {
      seen.add(section.name);
    }
  }
}

function validateKnownSectionOrder(
  document: DesignDocument,
  knownSections: DesignSection[],
  diagnostics: Diagnostic[],
): void {
  let highestSeen = -1;

  for (const section of knownSections) {
    const definition = getSectionDefinition(section.name);
    if (definition === undefined) {
      continue;
    }

    const index = canonicalOrderIndex(definition.name);
    if (index < highestSeen) {
      diagnostics.push({
        severity: "warning",
        rule: "section-order",
        path: section.name,
        message: `Known section '${section.name}' should appear in canonical order.`,
        span: lineSpan(document.sourceFile, section.heading.line),
      });
    } else {
      highestSeen = index;
    }
  }
}

function validateMetadataPosition(
  document: DesignDocument,
  diagnostics: Diagnostic[],
): void {
  const metadata = document.sections.find((section) => section.name === "Metadata");
  if (metadata === undefined) {
    return;
  }

  if (document.sections[0] !== metadata) {
    diagnostics.push({
      severity: "error",
      rule: "metadata-position",
      path: "Metadata",
      message: "Metadata must be the first H2 section after the H1 title.",
      span: lineSpan(document.sourceFile, metadata.heading.line),
    });
  }
}
