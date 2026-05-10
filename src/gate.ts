import path from "node:path";

import chalk from "chalk";

import type { EnvxConfig, GateResult } from "./types.js";
import { gitChangedFiles, gitRoot, isGitAvailable } from "./git.js";
import { scanWorkspaceForEnvKeys } from "./scan.js";

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

export async function runGate(params: {
  cwd: string;
  base: string;
  config: EnvxConfig;
  ignore?: string[];
}): Promise<GateResult> {
  if (!isGitAvailable(params.cwd)) {
    return {
      ok: false,
      exitCode: 3,
      message: "git not available; envx gate requires git",
    };
  }

  const repoRoot = gitRoot(params.cwd);
  if (!repoRoot) {
    return {
      ok: false,
      exitCode: 3,
      message: "Not a git repository (no git root found)",
    };
  }

  const changed = gitChangedFiles({ cwd: repoRoot, base: params.base });
  if (changed.length === 0) {
    return { ok: true, exitCode: 0, message: "No changed files detected" };
  }

  const ignore = params.ignore ?? defaultIgnore();

  const keys = await scanWorkspaceForEnvKeys({
    cwd: repoRoot,
    ignore,
    onlyChangedFiles: changed,
  });

  if (keys.size === 0) {
    return { ok: true, exitCode: 0, message: "No env keys detected in changes" };
  }

  const undocumented: string[] = [];
  for (const key of keys) {
    const hasDesc = Boolean(params.config.descriptions?.[key]);
    const isRequired = params.config.required?.includes(key) ?? false;

    // Require at least description OR explicitly listed as required.
    if (!hasDesc && !isRequired) undocumented.push(key);
  }

  if (undocumented.length > 0) {
    const relConfig = path.relative(repoRoot, path.resolve(repoRoot, ".envxrc.json"));
    return {
      ok: false,
      exitCode: 1,
      message:
        `Undocumented env keys introduced in this PR:\n` +
        undocumented
          .sort((a, b) => a.localeCompare(b))
          .map((k) => `- ${k}`)
          .join("\n") +
        `\n\nAdd descriptions in ${relConfig} (or envx.config.json).`,
    };
  }

  return {
    ok: true,
    exitCode: 0,
    message: chalk.green("Gate OK"),
  };
}
