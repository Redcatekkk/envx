# envx

Prevent **env drift** in PRs (and ship with confidence).

`envx` is a CLI that:

- gates pull requests when new env keys appear without documentation
- generates `.env.example` safely
- generates `env.schema.json`, `env.zod.ts`, and `env.d.ts`
- scans for common secret patterns (optionally staged-only)

> Replace `yourname` in the badge URLs after you publish.

[![CI](https://github.com/Redcatekkk/envx/actions/workflows/envx.yml/badge.svg)](https://github.com/yourname/envx/actions/workflows/envx.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Why this exists

Most `.env.example` generators stop at “dump some keys”. `envx` focuses on what breaks teams:

- PRs that introduce new `process.env.X` usages without updating docs
- missing runtime validation/types for env
- secrets accidentally ending up in commits

## Install

```bash
npm i -D envx
```

## Quickstart

```bash
# Interactive menu
npx envx ui

# Generate .env.example from code usage + .env
npx envx generate --scan

# Fail CI if PR introduces undocumented env keys
npx envx gate --base origin/main

# Generate schema/types into .envx/
npx envx schema --scan --out-dir .envx

# Scan staged files for common secret patterns
npx envx secrets --staged
```

## Interactive UI

```bash
npx envx ui
```

## Generate `.env.example`

```bash
npx envx generate --scan
```

Useful flags:

```bash
npx envx generate --scan --redact-strategy placeholder
npx envx generate --scan --keep-values PORT,NODE_ENV
```

## Gate PRs (env drift / undocumented keys)

```bash
npx envx gate --base origin/main
```

This fails if your PR introduces env keys in changed files that are not documented in `.envxrc.json` (or `envx.config.json`).

## Schema + types

```bash
npx envx schema --scan --out-dir .envx
```

Outputs:

- `.envx/env.schema.json`
- `.envx/env.zod.ts`
- `.envx/env.d.ts`

## Secrets scan

```bash
npx envx secrets
npx envx secrets --staged
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
npx envx init-action
```

This writes `.github/workflows/envx.yml` that runs:

- `envx gate`
- `envx check --scan`
- `envx secrets --staged`

---

MIT
