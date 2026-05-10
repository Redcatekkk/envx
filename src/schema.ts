import fs from "node:fs";
import path from "node:path";

import type { EnvxConfig } from "./types.js";
import { z } from "zod";

function envKeyToProp(key: string) {
  return key;
}

export function generateJsonSchema(params: {
  keys: string[];
  config: EnvxConfig;
}): object {
  const required = new Set(params.config.required ?? []);

  const properties: Record<string, any> = {};
  for (const key of params.keys) {
    const desc = params.config.descriptions?.[key];
    const example = params.config.examples?.[key];

    properties[envKeyToProp(key)] = {
      type: "string",
      ...(desc ? { description: desc } : {}),
      ...(example ? { examples: [example] } : {}),
    };
  }

  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    properties,
    required: Array.from(required).filter((k) => params.keys.includes(k)),
  };
}

export function generateZodSource(params: {
  keys: string[];
  config: EnvxConfig;
  outFileName?: string;
}): string {
  const required = new Set(params.config.required ?? []);

  const lines: string[] = [];
  lines.push('import { z } from "zod";');
  lines.push("");
  lines.push("export const envSchema = z.object({");

  for (const key of params.keys) {
    const isReq = required.has(key);
    const desc = params.config.descriptions?.[key];

    let expr = "z.string()";
    if (!isReq) expr += ".optional()";
    if (desc) expr += `.describe(${JSON.stringify(desc)})`;

    lines.push(`  ${JSON.stringify(key)}: ${expr},`);
  }

  lines.push("});");
  lines.push("");
  lines.push("export type Env = z.infer<typeof envSchema>;");

  return lines.join("\n") + "\n";
}

export function generateDts(params: { keys: string[] }): string {
  const lines: string[] = [];
  lines.push("declare global {");
  lines.push("  namespace NodeJS {");
  lines.push("    interface ProcessEnv {");
  for (const key of params.keys) {
    lines.push(`      ${key}?: string;`);
  }
  lines.push("    }");
  lines.push("  }");
  lines.push("}");
  lines.push("export {};");
  return lines.join("\n") + "\n";
}

export function writeSchemaOutputs(params: {
  cwd: string;
  keys: string[];
  config: EnvxConfig;
  outDir: string;
}) {
  const outDirAbs = path.isAbsolute(params.outDir)
    ? params.outDir
    : path.resolve(params.cwd, params.outDir);

  fs.mkdirSync(outDirAbs, { recursive: true });

  const schema = generateJsonSchema({ keys: params.keys, config: params.config });
  fs.writeFileSync(
    path.join(outDirAbs, "env.schema.json"),
    JSON.stringify(schema, null, 2) + "\n",
    "utf8",
  );

  fs.writeFileSync(
    path.join(outDirAbs, "env.zod.ts"),
    generateZodSource({ keys: params.keys, config: params.config }),
    "utf8",
  );

  fs.writeFileSync(
    path.join(outDirAbs, "env.d.ts"),
    generateDts({ keys: params.keys }),
    "utf8",
  );
}

// small runtime validator helper for people who want it
export function validateEnv(env: Record<string, string | undefined>, keys: string[], config: EnvxConfig) {
  const required = new Set(config.required ?? []);
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const key of keys) {
    shape[key] = required.has(key) ? z.string() : z.string().optional();
  }

  return z.object(shape).safeParse(env);
}
