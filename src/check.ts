import fs from "node:fs";
import path from "node:path";

import chalk from "chalk";
import { diffLines } from "diff";

import { generateEnvExample } from "./generate.js";
import type { EnvxConfig } from "./types.js";

export function checkGeneratedMatchesFile(params: {
  cwd: string;
  envFiles: string[];
  scannedKeys: Set<string>;
  config: EnvxConfig;
  keepValues: Set<string>;
  redactStrategy: string;
  targetFile: string;
}): number {
  const expected = generateEnvExample({
    cwd: params.cwd,
    envFiles: params.envFiles,
    scannedKeys: params.scannedKeys,
    config: params.config,
    keepValues: params.keepValues,
    redactStrategy: params.redactStrategy,
    sort: true,
    dedupe: true,
  });

  const rel = path.relative(params.cwd, params.targetFile);

  if (!fs.existsSync(params.targetFile)) {
    console.error(chalk.red(`Missing ${rel}. Run: envx generate --scan`));
    return 2;
  }

  const actual = fs.readFileSync(params.targetFile, "utf8");

  if (actual === expected) {
    console.log(chalk.green(`OK: ${rel} is up-to-date`));
    return 0;
  }

  console.error(chalk.red(`Out of date: ${rel}`));

  const diffs = diffLines(actual, expected);
  for (const part of diffs) {
    const color = part.added
      ? chalk.green
      : part.removed
        ? chalk.red
        : chalk.gray;

    const prefix = part.added ? "+" : part.removed ? "-" : " ";
    const lines = part.value.split("\n");
    for (const line of lines) {
      if (line === "") continue;
      console.error(color(`${prefix}${line}`));
    }
  }

  console.error(chalk.yellow("\nRun: envx generate --scan"));
  return 1;
}
