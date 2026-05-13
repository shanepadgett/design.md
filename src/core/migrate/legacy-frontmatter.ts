import type { Diagnostic } from "../diagnostics/types.js";
import {
  createSourceFile,
  lineSpan,
  type SourceFile,
  type SourceLine,
} from "../source/source-file.js";
import type { DesignMdMigrateOptions } from "./types.js";

export interface LegacyFrontmatter {
  sourceFile: SourceFile;
  contentLines: SourceLine[];
  body: string;
}

export interface LegacyFrontmatterResult {
  diagnostics: Diagnostic[];
  frontmatter?: LegacyFrontmatter;
}

export function extractLegacyFrontmatter(
  source: string,
  options: DesignMdMigrateOptions = {},
): LegacyFrontmatterResult {
  const sourceFile = createSourceFile(source, options.filePath);
  const diagnostics: Diagnostic[] = [];
  const firstLine = sourceFile.lines[0];

  if (firstLine === undefined || firstLine.text.trim() !== "---") {
    const diagnostic: Diagnostic = {
      severity: "error",
      rule: "legacy-frontmatter",
      message:
        "No legacy YAML frontmatter found. migrate only converts frontmatter-based DESIGN.md files.",
    };

    if (firstLine !== undefined) {
      diagnostic.span = lineSpan(sourceFile, firstLine);
    }

    diagnostics.push(diagnostic);
    return { diagnostics };
  }

  const closingIndex = sourceFile.lines.findIndex(
    (line, index) => index > 0 && line.text.trim() === "---",
  );

  if (closingIndex === -1) {
    diagnostics.push({
      severity: "error",
      rule: "legacy-frontmatter",
      message: "Legacy YAML frontmatter must be closed with '---'.",
      span: lineSpan(sourceFile, firstLine),
    });
    return { diagnostics };
  }

  const closingLine = sourceFile.lines[closingIndex];
  if (closingLine === undefined) {
    return { diagnostics };
  }

  const bodyStart =
    source.charCodeAt(closingLine.endOffset) === 10
      ? closingLine.endOffset + 1
      : closingLine.endOffset;

  return {
    diagnostics,
    frontmatter: {
      sourceFile,
      contentLines: sourceFile.lines.slice(1, closingIndex),
      body: source.slice(bodyStart),
    },
  };
}
