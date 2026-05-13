import type { Diagnostic, SourceSpan } from "../diagnostics/types.js";
import {
  spanFromOffsets,
  type SourceFile,
  type SourceLine,
} from "../source/source-file.js";
import type { LegacyMap, LegacyValue } from "./types.js";

interface ParserState {
  sourceFile: SourceFile;
  lines: SourceLine[];
  index: number;
  diagnostics: Diagnostic[];
}

interface ParsedKeyValue {
  key: string;
  keySpan: SourceSpan;
  valueText: string;
  valueStartOffset: number;
  hasValue: boolean;
}

export interface ParsedLegacyYaml {
  root: LegacyMap;
  diagnostics: Diagnostic[];
}

export function parseLegacyYaml(
  sourceFile: SourceFile,
  lines: SourceLine[],
): ParsedLegacyYaml {
  const state: ParserState = {
    sourceFile,
    lines,
    index: 0,
    diagnostics: [],
  };

  skipBlankLines(state);
  const firstLine = currentLine(state);
  const root = parseMap(state, 0);

  while (currentLine(state) !== undefined) {
    const line = currentLine(state);
    if (line === undefined) {
      break;
    }

    if (line.text.trim().length > 0) {
      report(state, line, "legacy-yaml", "Unexpected content after legacy YAML map.");
    }

    state.index += 1;
  }

  if (root.entries.length === 0) {
    if (firstLine !== undefined) {
      report(state, firstLine, "legacy-yaml", "Legacy frontmatter must contain a map.");
    } else {
      state.diagnostics.push({
        severity: "error",
        rule: "legacy-yaml",
        message: "Legacy frontmatter must contain a map.",
      });
    }
  }

  return { root, diagnostics: state.diagnostics };
}

function parseMap(state: ParserState, indent: number): LegacyMap {
  const entries: LegacyMap["entries"] = [];
  const seenKeys = new Set<string>();
  const firstLine = currentLine(state);
  let endOffset = firstLine?.startOffset ?? 0;

  while (currentLine(state) !== undefined) {
    skipBlankLines(state);

    const line = currentLine(state);
    if (line === undefined) {
      break;
    }

    const trimmed = line.text.trim();
    const currentIndent = leadingSpaces(line.text);

    if (currentIndent < indent) {
      break;
    }

    if (currentIndent % 2 !== 0) {
      report(state, line, "legacy-yaml-indentation", "Legacy YAML indentation must use two spaces per level.");
    }

    if (currentIndent > indent) {
      report(state, line, "legacy-yaml-indentation", "Indentation may only increase after a key with no value.");
      endOffset = line.endOffset;
      state.index += 1;
      continue;
    }

    if (trimmed.startsWith("- ")) {
      report(state, line, "legacy-yaml-unsupported", "Legacy migration does not support YAML lists.");
      endOffset = line.endOffset;
      state.index += 1;
      continue;
    }

    if (trimmed.startsWith("#")) {
      report(state, line, "legacy-yaml-unsupported", "Legacy migration does not support YAML comments.");
      endOffset = line.endOffset;
      state.index += 1;
      continue;
    }

    const parsed = parseKeyValue(state, line, indent);
    endOffset = line.endOffset;
    state.index += 1;

    if (parsed === undefined) {
      continue;
    }

    if (seenKeys.has(parsed.key)) {
      state.diagnostics.push({
        severity: "error",
        rule: "legacy-yaml-duplicate-key",
        path: parsed.key,
        message: `Duplicate legacy key '${parsed.key}' in the same map.`,
        span: parsed.keySpan,
      });
    } else {
      seenKeys.add(parsed.key);
    }

    const value = parsed.hasValue
      ? parseScalarValue(state, parsed.valueText, parsed.valueStartOffset)
      : parseNestedMap(state, line, indent);

    entries.push({
      key: parsed.key,
      value,
      keySpan: parsed.keySpan,
    });

    if (typeof value !== "string" && typeof value !== "number") {
      endOffset = Math.max(endOffset, value.span?.end.offset ?? endOffset);
    }
  }

  const map: LegacyMap = {
    kind: "map",
    entries,
    span: spanFromOffsets(
      state.sourceFile,
      firstLine?.startOffset ?? endOffset,
      endOffset,
    ),
  };

  return map;
}

function parseNestedMap(
  state: ParserState,
  parentLine: SourceLine,
  parentIndent: number,
): LegacyMap {
  skipBlankLines(state);

  const nextLine = currentLine(state);
  if (nextLine === undefined) {
    report(state, parentLine, "legacy-yaml-empty-value", "A key with no value must introduce a nested map.");
    return emptyMap(state, parentLine);
  }

  const nextIndent = leadingSpaces(nextLine.text);
  if (nextIndent <= parentIndent) {
    report(state, parentLine, "legacy-yaml-empty-value", "A key with no value must introduce a nested map.");
    return emptyMap(state, parentLine);
  }

  if (nextIndent !== parentIndent + 2) {
    report(state, nextLine, "legacy-yaml-indentation", "Legacy YAML indentation must use exactly two spaces per nesting level.");
  }

  return parseMap(state, parentIndent + 2);
}

function parseKeyValue(
  state: ParserState,
  line: SourceLine,
  indent: number,
): ParsedKeyValue | undefined {
  const content = line.text.slice(indent);
  const trimmed = content.trim();

  if (trimmed === "---" || trimmed === "...") {
    report(state, line, "legacy-yaml-unsupported", "Multiple YAML documents are not supported.");
    return undefined;
  }

  if (trimmed.startsWith("&") || trimmed.startsWith("*") || trimmed.startsWith("!") || trimmed.startsWith("<<")) {
    report(state, line, "legacy-yaml-unsupported", "YAML anchors, aliases, tags, and merge keys are not supported.");
    return undefined;
  }

  const colonIndex = findOutsideQuotes(content, ":");
  if (colonIndex === -1) {
    report(state, line, "legacy-yaml", "Legacy map entries must contain ':'.");
    return undefined;
  }

  const keySource = content.slice(0, colonIndex);
  const keyStartOffset = line.startOffset + indent;
  const parsedKey = parseKey(state, keySource, keyStartOffset);
  if (parsedKey === undefined) {
    return undefined;
  }

  const valueSource = content.slice(colonIndex + 1);
  const valueText = valueSource.trimStart();
  const valueStartOffset = line.startOffset
    + indent
    + colonIndex
    + 1
    + (valueSource.length - valueText.length);

  return {
    key: parsedKey.key,
    keySpan: parsedKey.keySpan,
    valueText,
    valueStartOffset,
    hasValue: valueText.length > 0,
  };
}

function parseKey(
  state: ParserState,
  source: string,
  startOffset: number,
): { key: string; keySpan: SourceSpan } | undefined {
  const trimmed = source.trim();
  const keySpan = spanFromOffsets(state.sourceFile, startOffset, startOffset + source.length);

  if (trimmed.length === 0) {
    state.diagnostics.push({
      severity: "error",
      rule: "legacy-yaml-key",
      message: "Legacy YAML keys must not be empty.",
      span: keySpan,
    });
    return undefined;
  }

  if (source !== trimmed) {
    state.diagnostics.push({
      severity: "error",
      rule: "legacy-yaml-key",
      message: "Legacy YAML keys must not have leading or trailing whitespace.",
      span: keySpan,
    });
  }

  if (trimmed.startsWith("'")) {
    state.diagnostics.push({
      severity: "error",
      rule: "legacy-yaml-unsupported",
      message: "Single-quoted keys are not supported by migration.",
      span: keySpan,
    });
    return undefined;
  }

  if (!trimmed.startsWith('"')) {
    return { key: trimmed, keySpan };
  }

  const key = parseQuotedText(trimmed, keySpan, state.diagnostics);
  if (key === undefined) {
    return undefined;
  }

  return { key, keySpan };
}

function parseScalarValue(
  state: ParserState,
  source: string,
  startOffset: number,
): LegacyValue {
  const trimmed = source.trimEnd();
  const span = spanFromOffsets(state.sourceFile, startOffset, startOffset + trimmed.length);

  if (trimmed.length === 0) {
    state.diagnostics.push({
      severity: "error",
      rule: "legacy-yaml-empty-value",
      message: "Legacy scalar values must not be empty.",
      span,
    });
    return "";
  }

  if (findOutsideQuotes(trimmed, "#") !== -1) {
    state.diagnostics.push({
      severity: "error",
      rule: "legacy-yaml-unsupported",
      message: "Legacy migration does not support YAML comments.",
      span,
    });
  }

  if (trimmed.startsWith('"')) {
    return parseQuotedText(trimmed, span, state.diagnostics) ?? "";
  }

  if (trimmed.startsWith("'")) {
    state.diagnostics.push({
      severity: "error",
      rule: "legacy-yaml-unsupported",
      message: "Single-quoted strings are not supported by migration.",
      span,
    });
    return "";
  }

  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  if (/^(?:true|false|null)$/i.test(trimmed)) {
    state.diagnostics.push({
      severity: "error",
      rule: "legacy-yaml-unsupported",
      message: "Booleans and null are not supported by migration.",
      span,
    });
  } else if (/^[>|]/.test(trimmed)) {
    state.diagnostics.push({
      severity: "error",
      rule: "legacy-yaml-unsupported",
      message: "Block scalar values are not supported by migration.",
      span,
    });
  } else if (/^[&*!]/.test(trimmed)) {
    state.diagnostics.push({
      severity: "error",
      rule: "legacy-yaml-unsupported",
      message: "YAML anchors, aliases, and tags are not supported by migration.",
      span,
    });
  } else if (/^[\[{]/.test(trimmed)) {
    state.diagnostics.push({
      severity: "error",
      rule: "legacy-yaml-unsupported",
      message: "Flow arrays and objects are not supported by migration.",
      span,
    });
  }

  return trimmed;
}

function parseQuotedText(
  source: string,
  span: SourceSpan,
  diagnostics: Diagnostic[],
): string | undefined {
  let value = "";
  let index = 1;

  while (index < source.length) {
    const character = source[index];
    if (character === undefined) {
      break;
    }

    if (character === '"') {
      if (source.slice(index + 1).trim().length > 0) {
        diagnostics.push({
          severity: "error",
          rule: "legacy-yaml-string",
          message: "Double-quoted strings must not have trailing content.",
          span,
        });
      }

      return value;
    }

    if (character === "\\") {
      const nextCharacter = source[index + 1];
      if (nextCharacter !== '"' && nextCharacter !== "\\") {
        diagnostics.push({
          severity: "error",
          rule: "legacy-yaml-string",
          message: 'Only \\" and \\\\ escapes are supported in strings.',
          span,
        });
        index += 1;
        continue;
      }

      value += nextCharacter;
      index += 2;
      continue;
    }

    value += character;
    index += 1;
  }

  diagnostics.push({
    severity: "error",
    rule: "legacy-yaml-string",
    message: "Double-quoted strings must be closed.",
    span,
  });

  return undefined;
}

function emptyMap(state: ParserState, line: SourceLine): LegacyMap {
  return {
    kind: "map",
    entries: [],
    span: spanFromOffsets(state.sourceFile, line.startOffset, line.startOffset),
  };
}

function skipBlankLines(state: ParserState): void {
  while (currentLine(state)?.text.trim().length === 0) {
    state.index += 1;
  }
}

function currentLine(state: ParserState): SourceLine | undefined {
  return state.lines[state.index];
}

function leadingSpaces(text: string): number {
  return /^ */.exec(text)?.[0].length ?? 0;
}

function findOutsideQuotes(source: string, character: string): number {
  let insideQuote = false;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];
    if (current === undefined) {
      continue;
    }

    if (escaped) {
      escaped = false;
      continue;
    }

    if (current === "\\") {
      escaped = true;
      continue;
    }

    if (current === '"') {
      insideQuote = !insideQuote;
      continue;
    }

    if (!insideQuote && current === character) {
      return index;
    }
  }

  return -1;
}

function report(
  state: ParserState,
  line: SourceLine,
  rule: string,
  message: string,
): void {
  state.diagnostics.push({
    severity: "error",
    rule,
    message,
    span: spanFromOffsets(
      state.sourceFile,
      line.startOffset,
      line.startOffset + line.text.length,
    ),
  });
}
