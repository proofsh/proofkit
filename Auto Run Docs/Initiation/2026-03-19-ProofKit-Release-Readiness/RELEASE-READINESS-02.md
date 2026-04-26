# Phase 02: Doc-Staleness Detection & Cross-Linking

This phase builds the automated doc-staleness detection system that runs during the release process. It also improves cross-linking between docs, SKILL.md files, and CLI help output so that AI agents and users can navigate between related resources. The goal is to ensure documentation never silently drifts from the actual package behavior.

## Tasks

- [ ] Build a doc-staleness detection script that compares package source changes against doc updates:
  - Create `scripts/check-doc-staleness.ts` (or `.mjs`) at the repo root.
  - The script should:
    1. For each package in `packages/*/`, get the most recent commit that touched `src/` files
    2. Get the most recent commit that touched the corresponding `apps/docs/content/docs/{package}/` directory
    3. If source was modified more recently than docs, flag it as potentially stale
    4. Also check if the package's SKILL.md was updated after the last source change
    5. Output a structured report (JSON or markdown) listing stale packages with: package name, days since last source change, days since last doc update, list of changed source files
  - Use `child_process.execSync` with `git log` commands — keep it simple, no external dependencies.
  - Add a `"check:docs"` script to root `package.json` that runs this script.
  - The script should exit with code 0 (always succeed) but print warnings prominently. It's advisory, not blocking.

- [ ] Integrate doc-staleness check into the release workflow:
  - In `.github/workflows/release.yml`, add a new job called `doc-review` that runs after the test jobs but before the release job.
  - The job should: checkout, setup Node, install deps, run `pnpm check:docs`.
  - Capture the output and post it as a PR comment (using `actions/github-script`) on the changeset version PR if one exists. This way maintainers see the staleness report before merging the release.
  - Make this job `continue-on-error: true` so it never blocks the release.

- [ ] Fix the `notify-intent.yml` placeholder issue:
  - In `.github/workflows/notify-intent.yml` line 59, the `"package"` field is `"with-changesets"` (a template placeholder from `intent setup`).
  - Change it to `"proofkit"` or dynamically determine it from the changed files path (e.g., extract the package name from the first changed file matching `packages/*/`).
  - Also update the comment block at the top of the file (lines 11-13) to remove the template variable references.

- [ ] Improve cross-linking between docs, skills, and CLI output:
  - In each package's main doc page (`apps/docs/content/docs/{package}/index.mdx`), add a "For AI Agents" callout or section at the bottom that points to the package's SKILL.md file location and the llms.txt per-package endpoint. Use a Fumadocs `Callout` component if available, or a simple blockquote.
  - In each SKILL.md file's `sources` frontmatter field, verify the doc URLs point to the correct pages on proofkit.proof.sh. Update any that are wrong or missing.
  - In the CLI's help output (check `packages/cli/src/` for the main command definitions), ensure the `--help` text mentions `https://proofkit.proof.sh/docs/cli` for full documentation.

- [ ] Write tests for the doc-staleness script:
  - Create `scripts/__tests__/check-doc-staleness.test.ts` (or co-locate with the script).
  - Test the core logic: parsing git log output, comparing dates, generating the report structure.
  - Mock `execSync` to provide controlled git log output rather than depending on actual git history.
  - Run `pnpm run ci` to confirm everything passes.

- [ ] Run full CI checks:
  - Run `pnpm run ci` from the repo root to validate lint, typecheck, and tests all pass with the new script, workflow changes, and cross-linking updates.
