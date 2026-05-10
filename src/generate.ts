import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";

import type { EnvxConfig, RedactStrategy } from "./types.js";

const SENSITIVE_KEY_RE = /(SECRET|TOKEN|PASSWORD|PASS|PRIVATE|KEY)/i;

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_RE.test(key);
}

function normalizeKey(key: string): string {
  return key.trim();
}

function mergeKeys(params: {
  envFileKeys: Set<string>;
  scannedKeys: Set<string>;
  requiredKeys: string[];
}): string[] {
  const all = new Set<string>();

  for (const k of params.envFileKeys) all.add(k);
  for (const k of params.scannedKeys) all.add(k);
  for (const k of params.requiredKeys) all.add(k);

  return Array.from(all);
}

function formatValue(params: {
  key: string;
  rawValue: string | undefined;
  redactStrategy: RedactStrategy;
  keepValues: Set<string>;
  examples?: Record<string, string>;
}): string {
  const { key, rawValue, redactStrategy, keepValues, examples } = params;

  const example = examples?.[key];
  if (example !== undefined) return example;

  const mayKeep = keepValues.has(key) && !isSensitiveKey(key);

  if (mayKeep && rawValue !== undefined) return rawValue;

  if (redactStrategy === "placeholder") {
    if (isSensitiveKey(key)) return "<REDACTED>";
    return "<YOUR_VALUE>";
  }

  return "";
}

function readEnvFiles(params: { cwd: string; envFiles: string[] }): {
  keys: Set<string>;
  values: Map<string, string>;
} {
  const keys = new Set<string>();
  const values = new Map<string, string>();

  for (const rel of params.envFiles) {
    const abs = path.isAbsolute(rel) ? rel : path.resolve(params.cwd, rel);
    if (!fs.existsSync(abs)) continue;

    const raw = fs.readFileSync(abs, "utf8");
    const parsed = dotenv.parse(String(raw));

    for (const [k, v] of Object.entries(parsed)) {
      const key = normalizeKey(k);
      if (!key) continue;
      keys.add(key);
      values.set(key, v);
    }
  }

  return { keys, values };
}

export function generateEnvExample(params: {
  cwd: string;
  envFiles: string[];
  scannedKeys: Set<string>;
  config: EnvxConfig;
  keepValues: Set<string>;
  redactStrategy: string;
  sort: boolean;
  dedupe: boolean;
}): string {
  const { keys: envFileKeys, values } = readEnvFiles({
    cwd: params.cwd,
    envFiles: params.envFiles,
  });

  const required = params.config.required ?? [];
  const keys = mergeKeys({
    envFileKeys,
    scannedKeys: params.scannedKeys,
    requiredKeys: required,
  });

  const redactStrategy = (params.redactStrategy === "placeholder"
    ? "placeholder"
    : "empty") as RedactStrategy;

  const keepValuesMerged = new Set([
    ...(params.keepValues ?? []),
    ...(params.config.keepValues ?? []),
  ]);

  let finalKeys = keys.map(normalizeKey).filter(Boolean);
  if (params.dedupe) finalKeys = Array.from(new Set(finalKeys));
  if (params.sort) finalKeys.sort((a, b) => a.localeCompare(b));

  const lines: string[] = [];

  for (const key of finalKeys) {
    const desc = params.config.descriptions?.[key];
    if (desc) {
      lines.push(`# ${desc}`);
    }

    const rawValue = values.get(key);
    const value = formatValue({
      key,
      rawValue,
      redactStrategy,
      keepValues: keepValuesMerged,
      examples: params.config.examples,
    });

    lines.push(`${key}=${value}`);
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}
