#!/usr/bin/env node
import { access, readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { runCli } from "./run.js";

process.exitCode = await runCli(process.argv.slice(2), {
  fileExists: async (filePath) => {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  },
  readFile: (filePath) => readFile(filePath, "utf8"),
  writeFile: (filePath, content) => writeFile(filePath, content, "utf8"),
  stdout: process.stdout,
  stderr: process.stderr,
});
