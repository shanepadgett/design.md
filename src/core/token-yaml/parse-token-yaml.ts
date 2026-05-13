import type { Diagnostic, SourceSpan } from "../diagnostics/types.js";
import { spanFromOffsets, type SourceFile, type SourceLine } from "../source/source-file.js";
import type {
  ParsedTokenYaml,
  TokenList,
  TokenMap,
  TokenMapEntry,
  TokenNode,
  TokenScalar,
} from "./types.js";

interface ParserState {
  sourceFile: SourceFile;
  lines: SourceLine[];
  index: number;
  diagnostics: Diagnostic[];
}

interface IndentInfo {
  indent: number;
  valid: boolean;
}

interface ParsedKeyValue {
  key: string;
  quotedKey: boolean;
  keySpan: SourceSpan;
  valueText: string;
  valueStartOffset: number;
  hasValue: boolean;
}

export function parseTokenYaml(sourceFile: SourceFile, lines: SourceLine[]): ParsedTokenYaml {
  const state: ParserState = {
    sourceFile,
    lines,
    index: 0,
    diagnostics: [],
  };

  skipBlankLines(state);

  const firstLine = currentLine(state);
  if (firstLine !== undefined && textAfterIndent(firstLine).startsWith("- ")) {
    report(state, firstLine, "invalid-token-yaml", "Token YAML root must be a map.");
  }

  const parsed = parseBlock(state, 0);
  const root = parsed.kind === "map" ? parsed : emptyMap(state, firstLine);

  while (currentLine(state) !== undefined) {
    const line = currentLine(state);
    if (line === undefined) {
      break;
    }

    if (line.text.trim().length > 0) {
      report(state, line, "invalid-token-yaml", "Unexpected content after token map.");
    }

    state.index += 1;
  }

  return { root, diagnostics: state.diagnostics };
}

function parseBlock(state: ParserState, indent: number): TokenNode {
  skipBlankLines(state);

  const line = currentLine(state);
  if (line === undefined) {
    return emptyMap(state, undefined);
  }

  const indentInfo = inspectIndent(state, line);
  if (indentInfo.indent < indent) {
    return emptyMap(state, line);
  }

  if (indentInfo.indent > indent) {
    report(
      state,
      line,
      "invalid-indentation",
      "Indentation may only increase after a key with no value.",
    );
    state.index += 1;
    return emptyMap(state, line);
  }

  if (line.text.slice(indent).startsWith("- ")) {
    return parseList(state, indent);
  }

  return parseMap(state, indent);
}

function parseMap(state: ParserState, indent: number): TokenMap {
  const entries: TokenMapEntry[] = [];
  const seenKeys = new Set<string>();
  const firstLine = currentLine(state);
  let endOffset = firstLine?.startOffset ?? 0;

  while (currentLine(state) !== undefined) {
    skipBlankLines(state);

    const line = currentLine(state);
    if (line === undefined) {
      break;
    }

    const indentInfo = inspectIndent(state, line);
    if (indentInfo.indent < indent) {
      break;
    }

    if (indentInfo.indent > indent) {
      report(
        state,
        line,
        "invalid-indentation",
        "Indentation may only increase by one level at a time.",
      );
      endOffset = line.endOffset;
      state.index += 1;
      continue;
    }

    if (line.text.slice(indent).startsWith("- ")) {
      report(state, line, "invalid-token-yaml", "Map entries must use key-value syntax.");
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
        rule: "duplicate-key",
        message: `Duplicate key '${parsed.key}' in the same map.`,
        path: parsed.key,
        span: parsed.keySpan,
      });
    } else {
      seenKeys.add(parsed.key);
    }

    const value = parsed.hasValue
      ? parseScalarValue(state, parsed.valueText, parsed.valueStartOffset)
      : parseNestedValue(state, line, indent);

    entries.push({
      key: parsed.key,
      quotedKey: parsed.quotedKey,
      keySpan: parsed.keySpan,
      value,
    });

    endOffset = Math.max(endOffset, value.span.end.offset);
  }

  return {
    kind: "map",
    entries,
    span: spanFromOffsets(state.sourceFile, firstLine?.startOffset ?? endOffset, endOffset),
  };
}

function parseNestedValue(
  state: ParserState,
  parentLine: SourceLine,
  parentIndent: number,
): TokenNode {
  skipBlankLines(state);

  const nextLine = currentLine(state);
  if (nextLine === undefined) {
    report(
      state,
      parentLine,
      "empty-leaf-value",
      "A key with no value must introduce a nested map or list.",
    );
    return emptyMap(state, parentLine);
  }

  const nextIndent = inspectIndent(state, nextLine).indent;
  if (nextIndent <= parentIndent) {
    report(
      state,
      parentLine,
      "empty-leaf-value",
      "A key with no value must introduce a nested map or list.",
    );
    return emptyMap(state, parentLine);
  }

  if (nextIndent !== parentIndent + 2) {
    report(
      state,
      nextLine,
      "invalid-indentation",
      "Indentation must use exactly two spaces per nesting level.",
    );
  }

  return parseBlock(state, parentIndent + 2);
}

function parseList(state: ParserState, indent: number): TokenList {
  const items: TokenScalar[] = [];
  const firstLine = currentLine(state);
  let endOffset = firstLine?.startOffset ?? 0;

  while (currentLine(state) !== undefined) {
    skipBlankLines(state);

    const line = currentLine(state);
    if (line === undefined) {
      break;
    }

    const indentInfo = inspectIndent(state, line);
    if (indentInfo.indent < indent) {
      break;
    }

    if (indentInfo.indent !== indent || !line.text.slice(indent).startsWith("- ")) {
      break;
    }

    const valueStartOffset = line.startOffset + indent + 2;
    const valueText = line.text.slice(indent + 2).trimStart();
    const leadingSpaces = line.text.slice(indent + 2).length - valueText.length;
    items.push(parseScalarValue(state, valueText, valueStartOffset + leadingSpaces));

    endOffset = line.endOffset;
    state.index += 1;
  }

  return {
    kind: "list",
    items,
    span: spanFromOffsets(state.sourceFile, firstLine?.startOffset ?? endOffset, endOffset),
  };
}

function parseKeyValue(
  state: ParserState,
  line: SourceLine,
  indent: number,
): ParsedKeyValue | undefined {
  checkUnsupportedLineSyntax(state, line);

  const content = line.text.slice(indent);
  const colonIndex = findKeyColon(content);
  if (colonIndex === -1) {
    report(state, line, "invalid-token-yaml", "Map entries must contain ':'.");
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
  const valueStartOffset =
    line.startOffset + indent + colonIndex + 1 + (valueSource.length - valueText.length);

  return {
    key: parsedKey.key,
    quotedKey: parsedKey.quotedKey,
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
): { key: string; quotedKey: boolean; keySpan: SourceSpan } | undefined {
  const trimmed = source.trim();
  const keySpan = spanFromOffsets(state.sourceFile, startOffset, startOffset + source.length);

  if (trimmed.length === 0) {
    state.diagnostics.push({
      severity: "error",
      rule: "invalid-key",
      message: "Keys must not be empty.",
      span: keySpan,
    });
    return undefined;
  }

  let key = trimmed;
  let quotedKey = false;

  if (trimmed.startsWith('"')) {
    const parsed = parseQuotedText(trimmed, keySpan, state.diagnostics);
    if (parsed === undefined) {
      return undefined;
    }
    key = parsed;
    quotedKey = true;
  } else if (trimmed.startsWith("'")) {
    state.diagnostics.push({
      severity: "error",
      rule: "single-quoted-string",
      message: "Single-quoted keys are not supported; use double quotes when quoting keys.",
      span: keySpan,
    });
    return undefined;
  }

  if (source !== trimmed) {
    state.diagnostics.push({
      severity: "error",
      rule: "invalid-key",
      message: "Keys must not have leading or trailing whitespace.",
      span: keySpan,
    });
  }

  if (!quotedKey && /^-?\d+(?:\.\d+)?$/.test(key)) {
    state.diagnostics.push({
      severity: "error",
      rule: "numeric-key",
      message: "Numeric keys must be double-quoted.",
      span: keySpan,
    });
  }

  if (/[.{}]/.test(key)) {
    state.diagnostics.push({
      severity: "error",
      rule: "invalid-key",
      message: "Keys must not contain '.', '{', or '}'.",
      span: keySpan,
    });
  }

  return { key, quotedKey, keySpan };
}

function parseScalarValue(state: ParserState, source: string, startOffset: number): TokenScalar {
  const trimmed = source.trimEnd();
  const span = spanFromOffsets(state.sourceFile, startOffset, startOffset + trimmed.length);

  if (trimmed.length === 0) {
    state.diagnostics.push({
      severity: "error",
      rule: "empty-leaf-value",
      message: "Leaf values must not be empty.",
      span,
    });
    return { kind: "scalar", valueType: "string", value: "", raw: trimmed, span };
  }

  const commentIndex = findOutsideQuotes(trimmed, "#");
  if (commentIndex !== -1) {
    state.diagnostics.push({
      severity: "error",
      rule: "comments-unsupported",
      message: "Comments are not supported inside token fences.",
      span,
    });
  }

  if (trimmed.startsWith('"')) {
    const parsed = parseQuotedText(trimmed, span, state.diagnostics);
    return {
      kind: "scalar",
      valueType: "string",
      value: parsed ?? "",
      raw: trimmed,
      span,
    };
  }

  if (trimmed.startsWith("'")) {
    state.diagnostics.push({
      severity: "error",
      rule: "single-quoted-string",
      message: "Single-quoted strings are not supported; use double quotes.",
      span,
    });
    return { kind: "scalar", valueType: "string", value: "", raw: trimmed, span };
  }

  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(trimmed)) {
    return {
      kind: "scalar",
      valueType: "number",
      value: Number(trimmed),
      raw: trimmed,
      span,
    };
  }

  if (/^(?:true|false|null)$/i.test(trimmed)) {
    state.diagnostics.push({
      severity: "error",
      rule: "unsupported-scalar",
      message: "Booleans and null are not supported in Token YAML.",
      span,
    });
  } else if (isBlockScalarHeader(trimmed)) {
    state.diagnostics.push({
      severity: "error",
      rule: "unsupported-yaml-feature",
      message: "Block scalar values are not supported in Token YAML.",
      span,
    });
  } else if (isAnchorAliasOrTag(trimmed)) {
    state.diagnostics.push({
      severity: "error",
      rule: "unsupported-yaml-feature",
      message: "YAML anchors, aliases, and tags are not supported.",
      span,
    });
  } else if (/^[[{]/.test(trimmed)) {
    state.diagnostics.push({
      severity: "error",
      rule: "unsupported-yaml-feature",
      message: "Flow arrays and flow objects are not supported.",
      span,
    });
  } else {
    state.diagnostics.push({
      severity: "error",
      rule: "unquoted-string",
      message: "String values must be double-quoted.",
      span,
    });
  }

  return { kind: "scalar", valueType: "string", value: "", raw: trimmed, span };
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
          rule: "invalid-string",
          message: "Double-quoted strings must not have trailing content.",
          span,
        });
      }

      if (value.length === 0) {
        diagnostics.push({
          severity: "error",
          rule: "empty-leaf-value",
          message: "String values must not be empty.",
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
          rule: "invalid-string-escape",
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
    rule: "invalid-string",
    message: "Double-quoted strings must be closed.",
    span,
  });

  return undefined;
}

function inspectIndent(state: ParserState, line: SourceLine): IndentInfo {
  const tabIndex = line.text.indexOf("\t");
  if (tabIndex !== -1) {
    state.diagnostics.push({
      severity: "error",
      rule: "tabs-unsupported",
      message: "Tabs are not supported for indentation in Token YAML.",
      span: spanFromOffsets(
        state.sourceFile,
        line.startOffset + tabIndex,
        line.startOffset + tabIndex + 1,
      ),
    });
  }

  const spaces = /^ */.exec(line.text)?.[0].length ?? 0;
  const valid = spaces % 2 === 0;
  if (!valid) {
    report(
      state,
      line,
      "invalid-indentation",
      "Indentation must use two spaces per nesting level.",
    );
  }

  return { indent: spaces, valid };
}

function checkUnsupportedLineSyntax(state: ParserState, line: SourceLine): void {
  const trimmed = line.text.trim();

  if (trimmed.startsWith("#")) {
    report(state, line, "comments-unsupported", "Comments are not supported inside token fences.");
  }

  if (trimmed === "---" || trimmed === "...") {
    report(state, line, "unsupported-yaml-feature", "Multiple YAML documents are not supported.");
  }

  if (trimmed.startsWith("&") || trimmed.startsWith("*") || trimmed.startsWith("!")) {
    report(
      state,
      line,
      "unsupported-yaml-feature",
      "YAML anchors, aliases, and tags are not supported.",
    );
  }

  if (trimmed.startsWith("<<")) {
    report(state, line, "unsupported-yaml-feature", "YAML merge keys are not supported.");
  }
}

function findKeyColon(source: string): number {
  let insideQuotes = false;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === undefined) {
      continue;
    }

    if (escaped) {
      escaped = false;
      continue;
    }

    if (insideQuotes && character === "\\") {
      escaped = true;
      continue;
    }

    if (character === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (!insideQuotes && character === ":") {
      return index;
    }
  }

  return -1;
}

function findOutsideQuotes(source: string, needle: string): number {
  let insideQuotes = false;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === undefined) {
      continue;
    }

    if (escaped) {
      escaped = false;
      continue;
    }

    if (insideQuotes && character === "\\") {
      escaped = true;
      continue;
    }

    if (character === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (!insideQuotes && character === needle) {
      return index;
    }
  }

  return -1;
}

function currentLine(state: ParserState): SourceLine | undefined {
  return state.lines[state.index];
}

function skipBlankLines(state: ParserState): void {
  while (currentLine(state)?.text.trim().length === 0) {
    state.index += 1;
  }
}

function textAfterIndent(line: SourceLine): string {
  return line.text.slice(/^ */.exec(line.text)?.[0].length ?? 0);
}

function isBlockScalarHeader(value: string): boolean {
  return /^[|>][+-]?\d*$/.test(value);
}

function isAnchorAliasOrTag(value: string): boolean {
  return /^[&*!]/.test(value);
}

function emptyMap(state: ParserState, line: SourceLine | undefined): TokenMap {
  const offset = line?.startOffset ?? 0;

  return {
    kind: "map",
    entries: [],
    span: spanFromOffsets(state.sourceFile, offset, offset),
  };
}

function report(state: ParserState, line: SourceLine, rule: string, message: string): void {
  state.diagnostics.push({
    severity: "error",
    rule,
    message,
    span: spanFromOffsets(state.sourceFile, line.startOffset, line.startOffset + line.text.length),
  });
}
