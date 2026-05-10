import chalk from "chalk";
import prompts from "prompts";

export async function runUi(params: {
  cwd: string;
}): Promise<{ command: string; args: string[] } | null> {
  // Keep it simple: choose a command + return args for caller to execute.
  // This avoids building a full Ink TUI and keeps deps small.

  const res = await prompts([
    {
      type: "select",
      name: "cmd",
      message: "What do you want to run?",
      choices: [
        { title: "Generate .env.example", value: "generate" },
        { title: "Gate (PR env drift / documentation)", value: "gate" },
        { title: "Generate schema/types (env.schema.json / env.zod.ts / env.d.ts)", value: "schema" },
        { title: "Secrets check", value: "secrets" },
        { title: "Init GitHub Action", value: "init-action" },
      ],
    },
  ]);

  if (!res.cmd) return null;

  if (res.cmd === "generate") {
    const opts = await prompts([
      { type: "toggle", name: "scan", message: "Scan code for env usage?", initial: true, active: "yes", inactive: "no" },
      { type: "text", name: "out", message: "Output file", initial: ".env.example" },
    ]);
    return {
      command: "generate",
      args: [opts.scan ? "--scan" : "", "--out", String(opts.out)].filter(Boolean),
    };
  }

  if (res.cmd === "gate") {
    const opts = await prompts([
      { type: "text", name: "base", message: "Base ref", initial: "origin/main" },
    ]);
    return { command: "gate", args: ["--base", String(opts.base)] };
  }

  if (res.cmd === "schema") {
    const opts = await prompts([
      { type: "toggle", name: "scan", message: "Scan code for env usage?", initial: true, active: "yes", inactive: "no" },
      { type: "text", name: "outDir", message: "Output directory", initial: ".envx" },
    ]);

    return {
      command: "schema",
      args: [opts.scan ? "--scan" : "", "--out-dir", String(opts.outDir)].filter(Boolean),
    };
  }

  if (res.cmd === "secrets") {
    const opts = await prompts([
      { type: "toggle", name: "staged", message: "Scan staged files only?", initial: true, active: "yes", inactive: "no" },
    ]);

    return {
      command: "secrets",
      args: [opts.staged ? "--staged" : ""].filter(Boolean),
    };
  }

  if (res.cmd === "init-action") {
    return { command: "init-action", args: [] };
  }

  // eslint-disable-next-line no-console
  console.log(chalk.red("Unknown selection"));
  return null;
}
