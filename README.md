# ProofKit Monorepo

ProofKit is a collection of TypeScript tools and libraries for building modern web applications, with a focus on seamless integration with Claris FileMaker. It includes CLI utilities, API clients, type generators, and other resources to help scaffold and develop TypeScript projects. ProofKit aims to make web development easier for beginners and more efficient for experienced developers by providing an opinionated project structure, code-mod scripts, and a suite of libraries to help you build, extend, and maintain your apps over time. This monorepo is where the ProofKit tools are developed and maintained.

- **Documentation:** [proofkit.proof.sh](https://proofkit.proof.sh)
- **Community Forum:** [Ottomatic Community – ProofKit Category](https://community.ottomatic.cloud/c/proofkit/13)

---

## Packages

This monorepo includes the following core packages:

- [`@proofkit/cli`](./packages/cli): Interactive CLI to scaffold and manage TypeScript projects that connect with FileMaker.
- [`@proofkit/fmdapi`](./packages/fmdapi): TypeScript client for the FileMaker Data API. [Docs](https://proofkit.proof.sh/docs/fmdapi)
- [`@proofkit/webviewer`](./packages/webviewer): Utility for interacting with the FileMaker WebViewer. [Docs](https://proofkit.proof.sh/docs/webviewer)
- [`@proofkit/typegen`](./packages/typegen): Generate TypeScript types and validation schemas from FileMaker layouts.
- [`@proofkit/create-proofkit`](./packages/create-proofkit): Alias package for quickly starting new ProofKit projects.

## Documentation & Community

For all setup, usage, and advanced guides, please visit the [official documentation site](https://proofkit.proof.sh).

For questions, support, and discussion, join the [Ottomatic Community](https://community.ottomatic.cloud/c/proofkit/13) in the **ProofKit** category.

## Monorepo Structure

- **Apps:** Example and demo applications are in `/apps` (e.g., documentation site).
- **Packages:** All core libraries and utilities are in `/packages`.
- **Shared Configs:** TypeScript, ESLint, and Prettier configurations are shared across the repo.
- **Tooling:** Uses [pnpm](https://pnpm.io/), [Turborepo](https://turbo.build/), and [Changesets](https://github.com/changesets/changesets) for efficient monorepo management and automated releases.

## AI Agent Integration

If you use an AI coding agent, run `npx @tanstack/intent@latest install` to load ProofKit skills into your agent for better code generation.

## Contributing

We welcome contributions! Please open issues or pull requests on [GitHub](https://github.com/proofsh/proofkit). For questions, join the [community forum](https://community.ottomatic.cloud/c/proofkit/13) in the **ProofKit** category.

## License

See [LICENSE.md](./LICENSE.md) for details.
