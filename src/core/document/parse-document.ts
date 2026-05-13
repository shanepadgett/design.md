import type { Diagnostic } from "../diagnostics/types.js";
import {
  createSourceFile,
  lineSpan,
  type SourceLine,
} from "../source/source-file.js";
import type { CodeFence, DesignDocument, DesignSection, Heading } from "./types.js";

export interface ParseDocumentOptions {
  filePath?: string;
}

export function parseDocument(
  source: string,
  options: ParseDocumentOptions = {},
): DesignDocument {
  const sourceFile = createSourceFile(source, options.filePath);
  const diagnostics: Diagnostic[] = [];
  const h1Headings: Heading[] = [];
  const sections: DesignSection[] = [];
  let currentSection: DesignSection | undefined;
  let activeFence: CodeFence | undefined;

  const firstContentLine = sourceFile.lines.find(
    (line) => line.text.trim().length > 0,
  );

  if (firstContentLine === undefined || !isH1Line(firstContentLine.text)) {
    const diagnostic: Diagnostic = {
      severity: "error",
      rule: "missing-title",
      message: "First non-blank line must be exactly one H1 title.",
    };

    if (firstContentLine !== undefined) {
      diagnostic.span = lineSpan(sourceFile, firstContentLine);
    }

    diagnostics.push(diagnostic);
  }

  if (firstContentLine !== undefined && firstContentLine.text.trim() === "---") {
    diagnostics.push({
      severity: "error",
      rule: "front-matter",
      message: "YAML front matter is not valid; use designmd migrate for legacy files.",
      span: lineSpan(sourceFile, firstContentLine),
    });
  }

  for (const line of sourceFile.lines) {
    const fenceInfo = parseFenceOpening(line.text);

    if (activeFence !== undefined) {
      if (isFenceClosing(line.text)) {
        activeFence.closingLine = line;
        activeFence = undefined;
      } else {
        activeFence.contentLines.push(line);
      }

      currentSection?.lines.push(line);
      continue;
    }

    if (fenceInfo !== undefined) {
      const fence: CodeFence = {
        info: fenceInfo,
        openingLine: line,
        contentLines: [],
      };

      currentSection?.fences.push(fence);
      currentSection?.lines.push(line);
      activeFence = fence;
      continue;
    }

    const heading = parseHeading(line);
    if (heading?.level === 1) {
      h1Headings.push(heading);

      if (h1Headings.length > 1) {
        diagnostics.push({
          severity: "error",
          rule: "multiple-title",
          message: "A DESIGN.md file must contain exactly one H1 title.",
          span: lineSpan(sourceFile, line),
        });
      }
    }

    if (heading?.level === 2) {
      currentSection = {
        heading,
        name: heading.text,
        lines: [],
        fences: [],
      };
      sections.push(currentSection);
      continue;
    }

    currentSection?.lines.push(line);
  }

  if (activeFence !== undefined) {
    diagnostics.push({
      severity: "error",
      rule: "unclosed-code-fence",
      message: "Code fence must be closed.",
      span: lineSpan(sourceFile, activeFence.openingLine),
    });
  }

  const document: DesignDocument = {
    sourceFile,
    h1Headings,
    sections,
    diagnostics,
  };

  const title = h1Headings[0];
  if (title !== undefined) {
    document.title = title;
  }

  return document;
}

export function sectionHasProseBeforeLine(
  section: DesignSection,
  beforeLineNumber?: number,
): boolean {
  let insideFence = false;

  for (const line of section.lines) {
    if (beforeLineNumber !== undefined && line.number >= beforeLineNumber) {
      break;
    }

    if (isFenceOpening(line.text) || isFenceClosing(line.text)) {
      insideFence = !insideFence;
      continue;
    }

    if (insideFence) {
      continue;
    }

    const trimmed = line.text.trim();
    if (trimmed.length > 0 && !trimmed.startsWith("#")) {
      return true;
    }
  }

  return false;
}

export function isFinalNonWhitespaceBlock(
  section: DesignSection,
  fence: CodeFence,
): boolean {
  const closingLineNumber = fence.closingLine?.number ?? fence.openingLine.number;

  return section.lines.every((line) => {
    if (line.number <= closingLineNumber) {
      return true;
    }

    return line.text.trim().length === 0;
  });
}

function parseHeading(line: SourceLine): Heading | undefined {
  const h1Match = /^# ([^#].*)$/.exec(line.text);
  if (h1Match?.[1] !== undefined) {
    return { level: 1, text: h1Match[1].trim(), line };
  }

  const h2Match = /^## ([^#].*)$/.exec(line.text);
  if (h2Match?.[1] !== undefined) {
    return { level: 2, text: h2Match[1].trim(), line };
  }

  return undefined;
}

function isH1Line(text: string): boolean {
  return /^# [^#].*$/.test(text);
}

function parseFenceOpening(text: string): string | undefined {
  const match = /^```([^`]*)$/.exec(text.trimEnd());
  if (match?.[1] === undefined) {
    return undefined;
  }

  return match[1].trim();
}

function isFenceOpening(text: string): boolean {
  return parseFenceOpening(text) !== undefined;
}

function isFenceClosing(text: string): boolean {
  return text.trimEnd() === "```";
}
