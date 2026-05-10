import fs from "node:fs";
import path from "node:path";

import type { EnvxConfig } from "./types.js";

export async function loadConfig(params: {
  cwd: string;
  explicitPath?: string;
}): Promise<EnvxConfig> {
  const { cwd, explicitPath } = params;

  const candidates = explicitPath
    ? [explicitPath]
    : [".envxrc.json", "envx.config.json"];

  for (const rel of candidates) {
    const abs = path.isAbsolute(rel) ? rel : path.resolve(cwd, rel);
    if (!fs.existsSync(abs)) continue;

    const raw = fs.readFileSync(abs, "utf8");
    const parsed = JSON.parse(raw) as EnvxConfig;
    return parsed;
  }

  return {};
}
