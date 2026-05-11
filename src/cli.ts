import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import chalk from "chalk";
import { Command } from "commander";
import gradient from "gradient-string";

import { loadConfig } from "./config.js";
import { generateEnvExample } from "./generate.js";
import { scanWorkspaceForEnvKeys } from "./scan.js";
import { checkGeneratedMatchesFile } from "./check.js";
import { runGate } from "./gate.js";
import { secretsCheck } from "./secrets.js";
import { writeSchemaOutputs } from "./schema.js";
import { runUi } from "./ui.js";
import { runDoctor } from "./doctor.js";

const DEFAULT_OUT_FILE = ".env.example";

function printBanner(enabled: boolean) {
  if (!enabled) return;
  const title = gradient("#00d2ff", "#3a7bd5")("envx");
  console.log(`${title} ${chalk.gray("— env drift gate + schema + secret guard")}`);
}

function parseCsvList(input?: string): string[] {
  if (!input) return [];
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseIgnoreList(input?: string): string[] {
  const defaults = [
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
  const extra = parseCsvList(input);
  return [...defaults, ...extra];
}

const program = new Command();
program
  .name("envx")
  .description("Prevent env drift in PRs, generate env schema/types, and guard against leaked secrets")
  .version(typeof __ENVX_VERSION__ === "string" ? __ENVX_VERSION__ : "0.0.0")
  .option("--no-banner", "Disable colorful banner output")
  .option("-C, --cwd <path>", "Working directory", process.cwd())
  .option("--config <path>", "Path to envx config (JSON)")
  .hook("preAction", () => {
    const opts = program.opts() as { banner: boolean };
    printBanner(Boolean(opts.banner));
  });

program
  .command("ui")
  .description("Interactive menu")
  .action(async () => {
    const rootOpts = program.opts() as { cwd: string };
    const cwd = path.resolve(rootOpts.cwd);

    const selection = await runUi({ cwd });
    if (!selection) return;

    // Execute by re-invoking the command handler via process args
    process.argv = [process.argv[0]!, process.argv[1]!, selection.command, ...selection.args, "-C", cwd];
    program.parse(process.argv);
  });

program
  .command("doctor")
  .description("Check your setup (node/git/config)")
  .action(() => {
    const rootOpts = program.opts() as { cwd: string; config?: string };
    const cwd = path.resolve(rootOpts.cwd);
    const code = runDoctor({ cwd, configPath: rootOpts.config });
    process.exit(code);
  });

program
  .command("generate")
  .description("Generate .env.example (from .env + optional scan)")
  .option("--from-env [files]", "Comma-separated .env files (default: .env)")
  .option("--scan", "Scan workspace source code for env key usage")
  .option("--out <file>", "Output file", DEFAULT_OUT_FILE)
  .option("--sort", "Sort keys alphabetically", true)
  .option("--dedupe", "Dedupe keys", true)
  .option("--keep-values <keys>", "Comma-separated keys that may keep values")
  .option("--redact-strategy <mode>", "empty | placeholder", "empty")
  .option("--ignore <globs>", "Extra ignore globs (comma-separated)")
  .action(async (options: {
    fromEnv?: string | boolean;
    scan?: boolean;
    out: string;
    sort?: boolean;
    dedupe?: boolean;
    keepValues?: string;
    redactStrategy: string;
    ignore?: string;
  }) => {
    const rootOpts = program.opts() as { cwd: string; config?: string };
    const cwd = path.resolve(rootOpts.cwd);

    const config = await loadConfig({ cwd, explicitPath: rootOpts.config });

    const envFiles = options.fromEnv === true || options.fromEnv === undefined
      ? [".env"]
      : parseCsvList(String(options.fromEnv));

    const ignore = parseIgnoreList(options.ignore);

    const scanKeys = options.scan
      ? await scanWorkspaceForEnvKeys({ cwd, ignore })
      : new Set<string>();

    const keepValues = new Set(parseCsvList(options.keepValues));

    const outPath = path.resolve(cwd, options.out);

    const content = generateEnvExample({
      cwd,
      envFiles,
      scannedKeys: scanKeys,
      config,
      keepValues,
      redactStrategy: options.redactStrategy,
      sort: Boolean(options.sort),
      dedupe: Boolean(options.dedupe),
    });

    fs.writeFileSync(outPath, content, "utf8");
    console.log(chalk.green(`Wrote ${path.relative(cwd, outPath)}`));
  });

program
  .command("check")
  .description("Fail if generated output differs from an existing .env.example")
  .option("--from-env [files]", "Comma-separated .env files (default: .env)")
  .option("--scan", "Scan workspace source code for env key usage")
  .option("--file <file>", "File to compare against", DEFAULT_OUT_FILE)
  .option("--keep-values <keys>", "Comma-separated keys that may keep values")
  .option("--redact-strategy <mode>", "empty | placeholder", "empty")
  .option("--ignore <globs>", "Extra ignore globs (comma-separated)")
  .action(async (options: {
    fromEnv?: string | boolean;
    scan?: boolean;
    file: string;
    keepValues?: string;
    redactStrategy: string;
    ignore?: string;
  }) => {
    const rootOpts = program.opts() as { cwd: string; config?: string };
    const cwd = path.resolve(rootOpts.cwd);

    const config = await loadConfig({ cwd, explicitPath: rootOpts.config });

    const envFiles = options.fromEnv === true || options.fromEnv === undefined
      ? [".env"]
      : parseCsvList(String(options.fromEnv));

    const ignore = parseIgnoreList(options.ignore);

    const scanKeys = options.scan
      ? await scanWorkspaceForEnvKeys({ cwd, ignore })
      : new Set<string>();

    const keepValues = new Set(parseCsvList(options.keepValues));

    const targetFile = path.resolve(cwd, options.file);

    const exitCode = checkGeneratedMatchesFile({
      cwd,
      envFiles,
      scannedKeys: scanKeys,
      config,
      keepValues,
      redactStrategy: options.redactStrategy,
      targetFile,
    });

    process.exit(exitCode);
  });

program
  .command("gate")
  .description("Fail PRs when new env keys appear without documentation")
  .option("--base <ref>", "Base ref", "origin/main")
  .option("--ignore <globs>", "Extra ignore globs (comma-separated)")
  .action(async (options: { base: string; ignore?: string }) => {
    const rootOpts = program.opts() as { cwd: string; config?: string };
    const cwd = path.resolve(rootOpts.cwd);

    const config = await loadConfig({ cwd, explicitPath: rootOpts.config });
    const ignore = parseIgnoreList(options.ignore);

    const res = await runGate({ cwd, base: options.base, config, ignore });
    if (!res.ok) {
      console.error(chalk.red(res.message));
      process.exit(res.exitCode);
    }

    console.log(chalk.green(res.message));
  });

program
  .command("schema")
  .description("Generate env.schema.json + env.zod.ts + env.d.ts")
  .option("--scan", "Scan workspace source code for env key usage")
  .option("--from-env [files]", "Comma-separated .env files (default: .env)")
  .option("--out-dir <dir>", "Output directory", ".envx")
  .option("--ignore <globs>", "Extra ignore globs (comma-separated)")
  .action(async (options: {
    scan?: boolean;
    fromEnv?: string | boolean;
    outDir: string;
    ignore?: string;
  }) => {
    const rootOpts = program.opts() as { cwd: string; config?: string };
    const cwd = path.resolve(rootOpts.cwd);

    const config = await loadConfig({ cwd, explicitPath: rootOpts.config });

    const envFiles = options.fromEnv === true || options.fromEnv === undefined
      ? [".env"]
      : parseCsvList(String(options.fromEnv));

    const ignore = parseIgnoreList(options.ignore);

    const scanKeys = options.scan
      ? await scanWorkspaceForEnvKeys({ cwd, ignore })
      : new Set<string>();

    // use generator's merge logic by generating content and extracting keys
    const content = generateEnvExample({
      cwd,
      envFiles,
      scannedKeys: scanKeys,
      config,
      keepValues: new Set<string>(),
      redactStrategy: config.redactStrategy ?? "empty",
      sort: true,
      dedupe: true,
    });

    const keys = content
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => l.split("=")[0]!)
      .filter(Boolean);

    writeSchemaOutputs({ cwd, keys, config, outDir: options.outDir });
    console.log(chalk.green(`Wrote schema outputs to ${options.outDir}`));
  });

program
  .command("secrets")
  .description("Scan for common secret patterns")
  .option("--staged", "Scan staged files only", false)
  .option("--ignore <globs>", "Extra ignore globs (comma-separated)")
  .action(async (options: { staged: boolean; ignore?: string }) => {
    const rootOpts = program.opts() as { cwd: string };
    const cwd = path.resolve(rootOpts.cwd);
    const ignore = parseIgnoreList(options.ignore);

    const code = await secretsCheck({ cwd, stagedOnly: Boolean(options.staged), ignore });
    process.exit(code);
  });

program
  .command("init-action")
  .description("Write a GitHub Actions workflow file")
  .option("--out <file>", "Output workflow file", ".github/workflows/envx.yml")
  .action((options: { out: string }) => {
    const rootOpts = program.opts() as { cwd: string };
    const cwd = path.resolve(rootOpts.cwd);
    const outPath = path.resolve(cwd, options.out);

    const dir = path.dirname(outPath);
    fs.mkdirSync(dir, { recursive: true });

    const workflow = `name: envx\n\non:\n  pull_request:\n  push:\n    branches: [main]\n\njobs:\n  envx:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n      - name: Install\n        run: npm ci\n      - name: Build\n        run: npm run build\n      - name: Gate (document new env keys)\n        run: npx @redcatekkk/envx gate --base origin/main\n      - name: Check .env.example\n        run: npx @redcatekkk/envx check --scan\n      - name: Secrets (staged)\n        run: npx @redcatekkk/envx secrets --staged\n`;

    fs.writeFileSync(outPath, workflow, "utf8");
    console.log(chalk.green(`Wrote ${path.relative(cwd, outPath)}`));
    console.log(chalk.gray("Next:"));
    console.log(chalk.gray("- Commit the workflow file"));
    console.log(chalk.gray("- Open a PR to see envx gate/check/secrets run"));
  });

program.parse();
