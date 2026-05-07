# Contributing to ProofKit

## Getting Started

### Prerequisites

- Node.js 22
- pnpm (managed via corepack)
- [Doppler CLI](https://docs.doppler.com/docs/install-cli) for secrets management

### Setup

1. Clone the repository and install dependencies:

```bash
git clone https://github.com/proofsh/proofkit.git
cd proofkit
corepack enable
nvm use
pnpm install
```

2. Install and configure Doppler:

```bash
# Install Doppler CLI
brew install dopplerhq/cli/doppler  # macOS
# or: curl -Ls https://cli.doppler.com/install.sh | sh  # Linux

# Login to Doppler
doppler login

# Setup project (select proofkit project, dev config)
doppler setup
```

### Running Checks

`pnpm ci` mirrors the shared PR workflow gates:

```bash
pnpm ci
```

That runs:

- lint
- skill version check
- typecheck
- deterministic tests
- build

`pnpm ci:release` mirrors the extra release-gating checks run on `main`:

```bash
pnpm ci:release
```

That adds:

- CLI external integration smoke tests
- `@proofkit/fmodata` e2e

Those release-only checks need secrets loaded the same way CI does. Use `varlock run -- pnpm ci:release` when needed.

### Running Tests

Some test scripts use secret injection:

```bash
# Run all deterministic tests
pnpm test

# Run specific package tests
pnpm --filter @proofkit/fmodata test
pnpm --filter @proofkit/fmodata test:e2e
```

### Building

```bash
pnpm build
```

### Linting and Formatting

```bash
pnpm lint
pnpm format
```

## Development Workflow

1. Create a new branch for your feature or fix
2. Make your changes
3. Run `pnpm ci`
4. Run `pnpm ci:release` if touching release-path code or CI-only integrations
5. Submit a pull request

## Code Style

This project uses [Ultracite](https://github.com/proofsh/ultracite) for linting and formatting. Run `pnpm dlx ultracite fix` to auto-fix issues before committing.
