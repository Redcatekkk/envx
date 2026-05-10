import { spawnSync } from "node:child_process";
import path from "node:path";

export function gitRoot(cwd: string): string | null {
  const res = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd,
    encoding: "utf8",
  });
  if (res.status !== 0) return null;
  return String(res.stdout).trim();
}

export function gitChangedFiles(params: {
  cwd: string;
  base: string;
}): string[] {
  const res = spawnSync(
    "git",
    ["diff", "--name-only", "--diff-filter=ACMRT", `${params.base}...HEAD`],
    { cwd: params.cwd, encoding: "utf8" },
  );

  if (res.status !== 0) return [];

  return String(res.stdout)
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((p) => path.resolve(params.cwd, p));
}

export function gitStagedFiles(cwd: string): string[] {
  const res = spawnSync("git", ["diff", "--cached", "--name-only"], {
    cwd,
    encoding: "utf8",
  });

  if (res.status !== 0) return [];

  return String(res.stdout)
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((p) => path.resolve(cwd, p));
}

export function isGitAvailable(cwd: string): boolean {
  const res = spawnSync("git", ["--version"], { cwd, encoding: "utf8" });
  return res.status === 0;
}
