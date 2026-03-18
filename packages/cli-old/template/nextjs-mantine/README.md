# ProofKit NextJS Template

This is a [NextJS](https://nextjs.org/) project bootstrapped with `@proofkit/cli`. Learn more at [proofkit.dev](https://proofkit.dev)

## What's next? How do I make an app with this?

While this template is designed to be a minimal starting point, the proofkit CLI will guide you through adding additional features and pages.

To add new things to your project, simply run the `proofkit` script from the project's root directory.

e.g. `npm run proofkit` or `pnpm proofkit` etc.

For more information, see the full [ProofKit documentation](https://proofkit.dev).

## Project Structure

ProofKit projects have an opinionated structure to help you get started and some conventions must be maintained to ensure that the CLI can properly inject new features and components.

The `src` directory is the home for your application code. It is used for most things except for configuration and is organized as follows:

- `app` - NextJS app router, where your pages and routes are defined
- `components` - Shared components used throughout the app
- `server` - Code that connects to backend databases and services that should not be exposed in the browser

Anytime you see an `internal` folder, you should not modify any files inside. These files are maintained exclusively by the ProofKit CLI and changes to them may be overwritten.

Anytime you see a componet file that begins with `slot-`, you _may_ modify the content, but do not rename, remove, or move them. These are desigend to be customized, but are still used by the CLI to inject additional content. If a slot is not needed by your app, you can have the compoment return `null` or an empty fragment: `<></>`
