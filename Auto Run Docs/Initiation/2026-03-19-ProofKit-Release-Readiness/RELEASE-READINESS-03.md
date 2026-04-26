# Phase 03: CLI Test Hardening & Agent-Friendly Output

This phase speeds up the `proofkit init` test suite, prepares the test infrastructure for upcoming new templates, and ensures CLI output includes guidance that helps AI agents use ProofKit correctly. The CLI is the primary entry point for new users (many of whom are non-developers working with AI assistants), so its output quality directly impacts the AI-assisted experience.

## Tasks

- [ ] Profile the existing CLI test suite to identify bottlenecks:
  - Run `pnpm --filter @proofkit/cli test` with timing output (e.g., `time` prefix or Vitest's `--reporter=verbose`) and record how long each test file takes.
  - Check `packages/cli/vitest.config.ts` — note that `fileParallelism: false` is currently set. Investigate which tests actually need sequential execution (shared state, filesystem conflicts) vs. which could safely run in parallel.
  - Look at the test-layer.ts and init-fixtures.ts helpers — check if tests share any mutable state that would prevent parallelization.
  - Document findings as comments in the vitest config file explaining why parallelism is disabled (if truly needed) or enable it if tests are safe to parallelize.

- [ ] Optimize test execution speed:
  - In test files that create filesystem artifacts (`executor.test.ts`, `integration.test.ts`, `init-scaffold-contract.test.ts`), ensure each test uses a unique temp directory (e.g., via `crypto.randomUUID()` or `Date.now()` suffix) so they don't conflict when run in parallel.
  - If tests are currently writing to a shared output directory, refactor to use isolated directories per test.
  - Try enabling `fileParallelism: true` in `vitest.config.ts` after ensuring isolation. If specific test files still need sequential execution, use Vitest's `test.sequential` or split them into a separate config.
  - Check if the `pnpm build` step in the test script (`"test": "pnpm build && vitest run"`) can be cached or skipped when source hasn't changed. Consider using `turbo` for caching the build step.

- [ ] Prepare test infrastructure for new templates:
  - Review the existing template test pattern in `init-scaffold-contract.test.ts` to understand how templates are validated (deterministic output checks).
  - Create a reusable test helper function (e.g., `createTemplateTestSuite(templateName, options)`) in `packages/cli/tests/test-utils.ts` or a new `template-test-helpers.ts` that:
    1. Sets up an isolated temp directory
    2. Runs the init scaffold for the given template
    3. Reads and returns the generated artifacts (package.json, config files, etc.)
    4. Provides assertion helpers for common checks (has correct dependencies, has correct scripts, config matches expected shape)
  - Refactor existing template tests to use this helper where it reduces duplication. Don't force it if the existing tests are already clean.

- [ ] Make CLI output more AI-agent-friendly:
  - In the post-init success message (find in `packages/cli/src/` — likely in the init command handler or executor), add a line pointing to docs: "Full documentation: https://proofkit.proof.sh/docs"
  - If there's a `--help` flag handler for the main `proofkit` command, ensure it includes the docs URL.
  - In error messages from the CLI, ensure they include enough context for an AI agent to diagnose the issue (e.g., "Missing required field X. See https://proofkit.proof.sh/docs/cli/reference for options.").
  - Review the AGENTS.md at the repo root — ensure it mentions the CLI and how to use it for project scaffolding.

- [ ] Run all tests and verify improvements:
  - Run `pnpm --filter @proofkit/cli test` and compare timing to the baseline recorded in the profiling task.
  - Run `pnpm run ci` from the repo root to validate everything passes.
  - If any test failures occur, fix them before completing this task.
