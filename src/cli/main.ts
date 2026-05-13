#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import process from "node:process";
import { runCli } from "./run.js";

process.exitCode = await runCli(process.argv.slice(2), {
  readFile: (filePath) => readFile(filePath, "utf8"),
  stdout: process.stdout,
  stderr: process.stderr,
});
