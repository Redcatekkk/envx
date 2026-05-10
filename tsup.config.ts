import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["cjs"],
  platform: "node",
  sourcemap: true,
  banner: {
    js: "#!/usr/bin/env node\n",
  },
});
