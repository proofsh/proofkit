---
"@proofkit/fmodata": patch
"@proofkit/better-auth": patch
---

Clean up dependencies that triggered `pnpm audit` advisories for consumers.

- `@proofkit/fmodata`: require `amazon-cognito-identity-js` ^6.3.22, which depends on patched `js-cookie` ^3.0.7 instead of 2.2.1.
- `@proofkit/better-auth`: move build-only tooling (`vite`, `@tanstack/vite-config`) to `devDependencies` so consumers no longer install `vite-plugin-dts`, `@microsoft/api-extractor`, and their vulnerable transitive dependencies. Bump runtime CLI dependencies (`c12`, `chalk`, `commander`, `fs-extra`) to their latest patched releases.
