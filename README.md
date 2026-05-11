# envx

Prevent **env drift** in PRs (and ship with confidence).

`envx` is a CLI that:

- gates pull requests when new env keys appear without documentation
- generates `.env.example` safely
- generates `env.schema.json`, `env.zod.ts`, and `env.d.ts`
- scans for common secret patterns (optionally staged-only)


[![CI](https://github.com/Redcatekkk/envx/actions/workflows/envx.yml/badge.svg)](https://github.com/Redcatekkk/envx/actions/workflows/envx.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Why this exists

Most `.env.example` generators stop at “dump some keys”. `envx` focuses on what breaks teams:

- PRs that introduce new `process.env.X` usages without updating docs
- missing runtime validation/types for env
- secrets accidentally ending up in commits

## Install

```bash
npm i -D @redcatekkk/envx
```

## Quickstart

```bash
# Interactive menu
npx @redcatekkk/envx ui

# Check your setup (node/git/config)
npx @redcatekkk/envx doctor

# Generate .env.example from code usage + .env
npx @redcatekkk/envx generate --scan

# Fail CI if PR introduces undocumented env keys
npx @redcatekkk/envx gate --base origin/main

# Generate schema/types into .envx/
npx @redcatekkk/envx schema --scan --out-dir .envx

# Scan staged files for common secret patterns
npx @redcatekkk/envx secrets --staged
```

## Interactive UI

```bash
npx @redcatekkk/envx ui
```

## Generate `.env.example`

```bash
npx @redcatekkk/envx generate --scan
```

Useful flags:

```bash
npx @redcatekkk/envx generate --scan --redact-strategy placeholder
npx @redcatekkk/envx generate --scan --keep-values PORT,NODE_ENV
```

## Gate PRs (env drift / undocumented keys)

```bash
npx @redcatekkk/envx gate --base origin/main
```

This fails if your PR introduces env keys in changed files that are not documented in `.envxrc.json` (or `envx.config.json`).

## Schema + types

```bash
npx @redcatekkk/envx schema --scan --out-dir .envx
```

Outputs:

- `.envx/env.schema.json`
- `.envx/env.zod.ts`
- `.envx/env.d.ts`

## Secrets scan

```bash
npx @redcatekkk/envx secrets
npx @redcatekkk/envx secrets --staged
```

## Config

Create `.envxrc.json` (or copy `.envxrc.example.json`):

```json
{
  "descriptions": {
    "DATABASE_URL": "Postgres connection string",
    "PORT": "Server port"
  },
  "required": ["DATABASE_URL"],
  "examples": {
    "PORT": "3000"
  }
}
```

## GitHub Action

```bash
npx @redcatekkk/envx init-action
```

This writes `.github/workflows/envx.yml` that runs:

- `envx gate`
- `envx check --scan`
- `envx secrets --staged`

---

MIT
