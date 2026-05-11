import fs from "node:fs";
import path from "node:path";

import chalk from "chalk";

import { isGitAvailable, gitRoot } from "./git.js";

export function runDoctor(params: { cwd: string; configPath?: string }) {
  const checks: Array<{ name: string; ok: boolean; details?: string }> = [];

  const nodeOk = Number(process.versions.node.split(".")[0]) >= 18;
  checks.push({
    name: "Node.js >= 18",
    ok: nodeOk,
    details: process.versions.node,
  });

  const gitOk = isGitAvailable(params.cwd);
  checks.push({ name: "git available", ok: gitOk });

  const root = gitOk ? gitRoot(params.cwd) : null;
  checks.push({
    name: "git repo",
    ok: Boolean(root),
    details: root ? path.relative(params.cwd, root) || "." : "not a git repo",
  });

  const configCandidates = params.configPath
    ? [params.configPath]
    : [
        ".envxrc.json",
        "envx.config.json",
        ".envxrc.example.json",
        "envx.config.example.json",
      ];

  const foundConfig = configCandidates
    .map((p) => path.resolve(params.cwd, p))
    .find((p) => fs.existsSync(p));

  checks.push({
    name: "config file",
    ok: Boolean(foundConfig),
    details: foundConfig ? path.relative(params.cwd, foundConfig) : "not found (optional)",
  });

  const out: string[] = [];
  out.push(chalk.bold("envx doctor"));
  out.push("");

  for (const c of checks) {
    const mark = c.ok ? chalk.green("ok") : chalk.red("fail");
    const details = c.details ? chalk.gray(`(${c.details})`) : "";
    out.push(`${mark}  ${c.name} ${details}`.trimEnd());
  }

  out.push("");
  const allOk = checks.every((c) => c.ok || c.name === "config file");
  out.push(allOk ? chalk.green("Looks good.") : chalk.yellow("Some checks failed."));

  console.log(out.join("\n"));

  return allOk ? 0 : 1;
}
