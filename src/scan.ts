import fs from "node:fs";

import fg from "fast-glob";

const ENV_KEY_RE = /^[A-Z][A-Z0-9_]*$/;

function addIfValid(set: Set<string>, candidate: string) {
  const key = candidate.trim();
  if (!key) return;
  if (!ENV_KEY_RE.test(key)) return;
  set.add(key);
}

const patterns = {
  jsTs: [
    /\bprocess\.env\.([A-Z][A-Z0-9_]*)\b/g,
    /\bprocess\.env\[\s*["'`]([A-Z][A-Z0-9_]*)["'`]\s*\]/g,
    /\bimport\.meta\.env\.([A-Z][A-Z0-9_]*)\b/g,
    /\bimport\.meta\.env\[\s*["'`]([A-Z][A-Z0-9_]*)["'`]\s*\]/g,
  ],
  python: [
    /\bos\.getenv\(\s*["'`]([A-Z][A-Z0-9_]*)["'`]\s*\)/g,
    /\bos\.environ\[\s*["'`]([A-Z][A-Z0-9_]*)["'`]\s*\]/g,
  ],
  dotnet: [
    /\bEnvironment\.GetEnvironmentVariable\(\s*["'`]([A-Z][A-Z0-9_]*)["'`]\s*\)/g,
  ],
};

function scanContentIntoKeys(content: string, keys: Set<string>) {
  for (const group of Object.values(patterns)) {
    for (const re of group) {
      for (const match of content.matchAll(re)) {
        const key = match[1];
        if (typeof key === "string") addIfValid(keys, key);
      }
    }
  }
}

export async function scanWorkspaceForEnvKeys(params: {
  cwd: string;
  ignore: string[];
  onlyChangedFiles?: string[];
}): Promise<Set<string>> {
  const keys = new Set<string>();

  const includeGlobs = [
    "**/*.js",
    "**/*.cjs",
    "**/*.mjs",
    "**/*.ts",
    "**/*.cts",
    "**/*.mts",
    "**/*.jsx",
    "**/*.tsx",
    "**/*.py",
    "**/*.cs",
    "**/*.fs",
    "**/*.vb",
  ];

  const files = params.onlyChangedFiles
    ? params.onlyChangedFiles
    : await fg(includeGlobs, {
        cwd: params.cwd,
        ignore: params.ignore,
        onlyFiles: true,
        dot: false,
        absolute: true,
        followSymbolicLinks: false,
      });

  for (const abs of files) {
    let content: string;
    try {
      content = fs.readFileSync(abs, "utf8");
    } catch {
      continue;
    }

    if (content.length > 2_000_000) continue;

    scanContentIntoKeys(content, keys);
  }

  return new Set(Array.from(keys).map((k) => k.toUpperCase()));
}
