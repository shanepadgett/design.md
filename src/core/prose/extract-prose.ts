import type { Diagnostic } from "../diagnostics/types.js";
import { parseDocument } from "../document/parse-document.js";
import type { CodeFence, DesignDocument, DesignSection } from "../document/types.js";

export interface DesignMdProseOptions {
  filePath?: string;
  section?: string;
  list?: boolean;
}

export interface DesignMdProseSection {
  name: string;
  prose: string;
}

export interface DesignMdProseResult {
  document: DesignDocument;
  diagnostics: Diagnostic[];
  sections: DesignMdProseSection[];
  output?: string;
}

export function extractDesignMdProse(
  source: string,
  options: DesignMdProseOptions = {},
): DesignMdProseResult {
  const document = parseDocument(source, options);
  const diagnostics: Diagnostic[] = [...document.diagnostics];
  let sections = document.sections;

  if (options.section !== undefined) {
    const section = document.sections.find((item) => item.name === options.section);
    if (section === undefined) {
      diagnostics.push({
        severity: "error",
        rule: "section-not-found",
        path: options.section,
        message: `Section '${options.section}' was not found.`,
      });
      sections = [];
    } else {
      sections = [section];
    }
  }

  const proseSections = sections.map((section) => ({
    name: section.name,
    prose: renderSectionProse(section),
  }));
  const result: DesignMdProseResult = {
    document,
    diagnostics,
    sections: proseSections,
  };

  if (!hasErrors(diagnostics)) {
    result.output = options.list
      ? renderSectionList(proseSections)
      : renderProseDocument(document, proseSections, options.section !== undefined);
  }

  return result;
}

function renderSectionList(sections: readonly DesignMdProseSection[]): string {
  return `${sections.map((section) => section.name).join("\n")}\n`;
}

function renderProseDocument(
  document: DesignDocument,
  sections: readonly DesignMdProseSection[],
  sectionOnly: boolean,
): string {
  const blocks: string[] = [];

  if (!sectionOnly && document.title !== undefined) {
    blocks.push(`# ${document.title.text}`);
  }

  for (const section of sections) {
    const block = [`## ${section.name}`];
    if (section.prose.length > 0) {
      block.push("", section.prose);
    }
    blocks.push(block.join("\n"));
  }

  return `${blocks.join("\n\n").trimEnd()}\n`;
}

function renderSectionProse(section: DesignSection): string {
  const yamlLineNumbers = new Set<number>();

  for (const fence of section.fences) {
    if (!isYamlFence(fence)) {
      continue;
    }

    yamlLineNumbers.add(fence.openingLine.number);
    for (const line of fence.contentLines) {
      yamlLineNumbers.add(line.number);
    }
    if (fence.closingLine !== undefined) {
      yamlLineNumbers.add(fence.closingLine.number);
    }
  }

  return trimBlankLines(
    section.lines.filter((line) => !yamlLineNumbers.has(line.number)).map((line) => line.text),
  ).join("\n");
}

function isYamlFence(fence: CodeFence): boolean {
  const info = fence.info.toLowerCase();
  return info === "yaml" || info.startsWith("yaml ");
}

function trimBlankLines(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;

  while (start < end && lines[start]?.trim().length === 0) {
    start += 1;
  }

  while (end > start && lines[end - 1]?.trim().length === 0) {
    end -= 1;
  }

  return lines.slice(start, end);
}

function hasErrors(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}
