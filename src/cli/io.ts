export interface Writable {
  write(message: string): unknown;
}

export interface CommandIO {
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, content: string): Promise<void>;
  fileExists(filePath: string): Promise<boolean>;
  stdout: Writable;
  stderr: Writable;
}
