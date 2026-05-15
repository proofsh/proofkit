In all interactions and commit messages, be extremely concise and sacrifice grammar for sake of concision.

Use GitHub CLI for GitHub work.

Always run `pnpm run ci` from repo root after task done and before committing.
When editing package code, add a changeset file with fixes. No changeset needed for CI/format-only changes.

# Project Overview

ProofKit is a monorepo of TypeScript tools and libraries for building web applications integrated with Claris FileMaker. Docs: https://proofkit.dev

## Commands

```bash
pnpm build
pnpm dev
pnpm test
pnpm lint
pnpm format
pnpm run ci

pnpm --filter @proofkit/fmdapi build
pnpm --filter @proofkit/cli test

pnpm dlx ultracite fix
pnpm dlx ultracite check
pnpm knip
pnpm sherif
```

## Package Install

Use `pnpm --filter` for package deps. Do not install to workspace root unless asked.

```bash
pnpm --filter @proofkit/fmdapi add zod
```

## Structure

```text
packages/
  fmdapi/
  fmodata/
  typegen/
  webviewer/
  cli/
  better-auth/
  registry/
  create-proofkit/
apps/
  docs/
```

## Architecture

- Build: TypeScript -> Vite -> publint
- Error handling: custom errors + `neverthrow` Result pattern in `fmodata`
- Codegen: `ts-morph` in `typegen` and `cli`
- CLI: Commander + `@clack/prompts`
- ORM: Drizzle-inspired field builders in `fmodata`

## TypeScript

- Strict mode
- `noUncheckedIndexedAccess`
- `useUnknownInCatchVariables`
- Path aliases: `@proofkit/*` -> `packages/*/src`

## Code Standards

Use Ultracite. Prefer accessible, performant, type-safe, maintainable code.

- Prefer `unknown` over `any`
- Prefer `for...of`
- Always await promises
- Throw `Error` objects
- Remove debug logs
- Prefer early returns
- Use semantic HTML and ARIA where relevant
- Add `rel="noopener"` with `target="_blank"`
- Avoid `eval`, raw cookie assignment, unsafe HTML
- Use Next `<Image>` where relevant
- React 19+: use ref as prop instead of `forwardRef`
