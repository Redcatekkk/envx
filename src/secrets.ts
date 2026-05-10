import fs from "node:fs";
import path from "node:path";

import chalk from "chalk";
import fg from "fast-glob";

import { gitStagedFiles } from "./git.js";

type SecretFinding = {
  file: string;
  rule: string;
  match: string;
};

const RULES: Array<{ rule: string; re: RegExp }> = [
  { rule: "AWS Access Key", re: /\bAKIA[0-9A-Z]{16}\b/g },
  { rule: "AWS Secret Key", re: /\baws(.{0,20})?secret(.{0,20})?[0-9a-zA-Z/+]{40}\b/gi },
  { rule: "GitHub Token", re: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g },
  { rule: "Slack Token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { rule: "Private Key", re: /-----BEGIN (RSA|DSA|EC|OPENSSH|PGP) PRIVATE KEY-----/g },
  { rule: "Stripe Secret Key", re: /\bsk_(live|test)_[0-9a-zA-Z]{16,}\b/g },
];

function defaultIgnore(): string[] {
  return [
    "**/node_modules/**",
    "**/.git/**",
    "**/dist/**",
    "**/build/**",
    "**/.next/**",
    "**/.turbo/**",
    "**/coverage/**",
    "**/.venv/**",
    "**/venv/**",
  ];
}

function scanFileForSecrets(absPath: string): SecretFinding[] {
  let content: string;
  try {
    content = fs.readFileSync(absPath, "utf8");
  } catch {
    return [];
  }

  if (content.length > 3_000_000) return [];

  const findings: SecretFinding[] = [];
  for (const { rule, re } of RULES) {
    for (const m of content.matchAll(re)) {
      findings.push({ file: absPath, rule, match: String(m[0]).slice(0, 120) });
      if (findings.length > 50) return findings;
    }
  }
  return findings;
}

export async function secretsCheck(params: {
  cwd: string;
  stagedOnly: boolean;
  ignore?: string[];
}): Promise<number> {
  const ignore = params.ignore ?? defaultIgnore();

  const files = params.stagedOnly
    ? gitStagedFiles(params.cwd)
    : await fg(["**/*"], {
        cwd: params.cwd,
        ignore,
        onlyFiles: true,
        dot: true,
        absolute: true,
        followSymbolicLinks: false,
      });

  const findings: SecretFinding[] = [];
  for (const abs of files) {
    const ext = path.extname(abs).toLowerCase();
    // Skip obvious binaries
    if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".zip", ".exe", ".dll"].includes(ext)) continue;
    findings.push(...scanFileForSecrets(abs));
    if (findings.length > 50) break;
  }

  if (findings.length === 0) {
    console.log(chalk.green("No secret patterns detected"));
    return 0;
  }

  console.error(chalk.red(`Potential secrets detected (${findings.length})`));
  for (const f of findings.slice(0, 50)) {
    console.error(`${chalk.yellow(f.rule)}: ${path.relative(params.cwd, f.file)} :: ${chalk.gray(f.match)}`);
  }

  return 2;
}
