import type { Diagnostic } from "../diagnostics/types.js";
import type { SourceFile, SourceLine } from "../source/source-file.js";

export interface Heading {
  level: 1 | 2;
  text: string;
  line: SourceLine;
}

export interface CodeFence {
  info: string;
  openingLine: SourceLine;
  closingLine?: SourceLine;
  contentLines: SourceLine[];
}

export interface DesignSection {
  heading: Heading;
  name: string;
  lines: SourceLine[];
  fences: CodeFence[];
}

export interface DesignDocument {
  sourceFile: SourceFile;
  title?: Heading;
  h1Headings: Heading[];
  sections: DesignSection[];
  diagnostics: Diagnostic[];
}
