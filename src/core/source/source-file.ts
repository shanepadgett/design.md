import type { SourcePosition, SourceSpan } from "../diagnostics/types.js";

export interface SourceLine {
  number: number;
  text: string;
  startOffset: number;
  endOffset: number;
}

export interface SourceFile {
  source: string;
  filePath?: string;
  lines: SourceLine[];
}

export function createSourceFile(source: string, filePath?: string): SourceFile {
  const lines: SourceLine[] = [];
  let lineStart = 0;
  let lineNumber = 1;

  for (let index = 0; index <= source.length; index += 1) {
    const isEnd = index === source.length;
    const isLineFeed = source.charCodeAt(index) === 10;

    if (!isEnd && !isLineFeed) {
      continue;
    }

    const rawEnd = isLineFeed ? index : source.length;
    const textEnd = rawEnd > lineStart && source.charCodeAt(rawEnd - 1) === 13
      ? rawEnd - 1
      : rawEnd;

    lines.push({
      number: lineNumber,
      text: source.slice(lineStart, textEnd),
      startOffset: lineStart,
      endOffset: rawEnd,
    });

    lineStart = index + 1;
    lineNumber += 1;
  }

  const sourceFile: SourceFile = { source, lines };
  if (filePath !== undefined) {
    sourceFile.filePath = filePath;
  }

  return sourceFile;
}

export function positionAt(sourceFile: SourceFile, offset: number): SourcePosition {
  const clampedOffset = Math.max(0, Math.min(offset, sourceFile.source.length));
  const line = findLine(sourceFile.lines, clampedOffset);

  return {
    line: line.number,
    column: clampedOffset - line.startOffset + 1,
    offset: clampedOffset,
  };
}

export function spanFromOffsets(
  sourceFile: SourceFile,
  startOffset: number,
  endOffset: number,
): SourceSpan {
  const span: SourceSpan = {
    start: positionAt(sourceFile, startOffset),
    end: positionAt(sourceFile, endOffset),
  };

  if (sourceFile.filePath !== undefined) {
    span.filePath = sourceFile.filePath;
  }

  return span;
}

export function lineSpan(sourceFile: SourceFile, line: SourceLine): SourceSpan {
  return spanFromOffsets(
    sourceFile,
    line.startOffset,
    line.startOffset + line.text.length,
  );
}

function findLine(lines: readonly SourceLine[], offset: number): SourceLine {
  let low = 0;
  let high = lines.length - 1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const line = lines[middle];

    if (line === undefined) {
      break;
    }

    if (offset < line.startOffset) {
      high = middle - 1;
    } else if (offset > line.endOffset) {
      low = middle + 1;
    } else {
      return line;
    }
  }

  const fallback = lines.at(-1);
  if (fallback === undefined) {
    return { number: 1, text: "", startOffset: 0, endOffset: 0 };
  }

  return fallback;
}
