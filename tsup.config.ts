import { defineConfig } from "tsup";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.resolve(here, "package.json"), "utf8")) as {
  version?: string;
};

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["cjs"],
  platform: "node",
  sourcemap: true,
  banner: {
    js: "#!/usr/bin/env node\n",
  },
  define: {
    __ENVX_VERSION__: JSON.stringify(pkg.version ?? "0.0.0"),
  },
});
