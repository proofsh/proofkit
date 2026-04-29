# Tech Stack

This document inventories the pieces that make up a ProofKit-generated application — what gets installed, wired up, and operated for you when you set up a new project. It's a companion to [Highlights](hilights.md) (which explains *why* having an opinionated stack matters) and [Data Flow](data-flow.md) (which explains how those pieces talk to FileMaker at runtime).

The shape of the stack follows directly from [First Principles](first-principles.md): each choice is one that AI coding agents already understand deeply, that closes the feedback loop, and that meets developers where they are.

## The Core Framework

### React + TypeScript

The foundation of every ProofKit app. React is the most well-understood UI framework in LLM training data, which means agents write idiomatic React without prompting tricks. TypeScript adds the type information agents need to reason about your data and catch mistakes before they reach the browser.

### shadcn/ui + Tailwind CSS

The UI layer. shadcn/ui provides a library of accessible, beautifully designed components that get copied into your project (not installed as a black-box dependency), so the agent can read and modify them directly. Tailwind handles styling with utility classes — another pattern agents know cold. Dark and light mode work out of the box.

### Vite

The dev server and build tool. Fast hot-module reload during development, optimized bundles for deployment into the WebViewer.

## Client Infrastructure

### TanStack Query

The data-fetching and caching layer. Query keeps your UI in sync with FileMaker server data without hammering the server and without manual refreshes. It deduplicates requests, caches intelligently, retries on failure, and gives the agent a predictable pattern for any data interaction. This is what makes a WebViewer app feel as snappy as a native UI even though every read goes through a FileMaker script.

### TanStack Router

The routing layer. A single bundle can host customers, invoices, dashboards, detail views, and more, with sidebar or top navigation. Type-safe routes mean the agent can't link to a page that doesn't exist.

## The FileMaker Bridge

### ProofKit FMDAPI + TypeGen

Type-safe API clients generated from your FileMaker layouts. **TypeGen** reads your file's metadata and produces TypeScript types for every layout, field, and value list. **FMDAPI** uses those types to give the agent a fully typed client for the FileMaker Data API — so the agent knows the shape of every record it reads or writes. When the agent makes a typo or assumes a field that isn't there, TypeScript catches it at compile time, not at runtime in the WebViewer.

### FMFetch

A promise-based wrapper over the FileMaker WebViewer's script-callback primitives. WebViewers natively talk to FileMaker by calling a script and receiving a callback — a pattern that doesn't compose well with modern web code. FMFetch turns that into a `fetch`-shaped promise: the web code (and the agent writing it) can use the async/await idioms they already know, and FMFetch handles resolving the promise when the FileMaker script's callback fires.

## The Agent Feedback Loop

The framework pieces above are necessary but not sufficient. A ProofKit project also ships a deliberate set of guardrails that keep agents productive — see [Highlights — Closes the Loop](hilights.md#2-closes-the-loop-between-writing-testing-and-fixing) and [First Principles — Close the Loop for Agents](first-principles.md#3-close-the-loop-for-agents).

- **Skills** — instructions and patterns the agent loads automatically, so it knows the conventions of a ProofKit project without being told each time.
- **Deterministic tests** — the agent can run them and read the results, so a broken change surfaces immediately.
- **Linters and formatters** — pre-configured so style and obvious bugs are caught before they reach review.
- **Project setup** — a coherent baseline (folder structure, scripts, configs) so the agent never has to guess where something belongs.

Together these turn the project into something the agent can drive autonomously: write code, run tests, read errors, fix, repeat — without a human shepherding each step.

## Why These Choices

Three properties drove every selection:

1. **LLMs already know it.** React, TypeScript, Tailwind, TanStack — these are dense in training data. The agent writes them well on the first try.
2. **It closes the loop.** Each piece either generates feedback the agent can read (types, test output, lint errors) or makes feedback faster (Vite's HMR, TanStack Query's predictable cache).
3. **It composes.** Every piece was chosen knowing the others. You don't get a state-management library that fights the router or a UI kit that fights the styling system.

If you've already invested in a different stack — Svelte, Vue, a different router — ProofKit can accommodate it. The opinionated path is the fastest route to a working app, but it's not the only path. See [Highlights — Stays Flexible](hilights.md#5-stays-flexible-when-you-need-it).

## Related Documents

- [Highlights](hilights.md) — value proposition and the case for an opinionated stack
- [Data Flow](data-flow.md) — how these pieces talk to FileMaker at runtime
- [Hybrid Apps](hyrid-apps.md) — what you get from running this stack inside a WebViewer
- [Technical Requirements](technical-requirements.md) — the FileMaker, Node.js, and AI environment prerequisites for using the stack
- [First Principles](first-principles.md) — the reasoning behind these choices
