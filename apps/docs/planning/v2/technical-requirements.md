# Technical Requirements

This document specifies the technical requirements for ProofKit v2 at launch — what versions of FileMaker are supported, which AI coding environments are tested and targeted, and what the deployed apps will run on. It also calls out what is explicitly *not* in scope for this release.

## FileMaker Version

**FileMaker 22 or greater** is required.

Future releases of ProofKit will be tied to the next major version of FileMaker — **FileMaker 26**. As FileMaker evolves, we will track the platform's release cadence so that ProofKit can take advantage of new FileMaker capabilities (especially around how deployed code lives in the file — see [First Principles — Deployed Code Should Behave Like FileMaker Code](first-principles.md#6-deployed-code-should-behave-like-filemaker-code)).

## AI Coding Environments

ProofKit v2 is **fully tested with Claude Code and Claude Desktop**. These are our launch targets.

In principle, ProofKit should also work with any agentic coding environment that supports MCP — Cursor, Codex, OpenCode, and others. Broad compatibility is an explicit goal, in line with [First Principles — Meet Developers Where They Are](first-principles.md#2-meet-developers-where-they-are--in-their-editor-of-choice). At launch, however, only Claude Code and Claude Desktop are formally supported and validated.

We expect to expand official support to more environments as we test them.

## Coding Environment (the Developer's Machine)

To **build** ProofKit apps, a developer needs:

- **FileMaker Pro** — required. The agentic coding workflow runs against an open FileMaker file in FileMaker Pro.
- **FileMaker Server** — *not* required. ProofKit works against any open FileMaker file, whether it lives locally or is hosted on a server.

In short: ProofKit needs an open file, not a particular hosting model.

## Runtime Environments (Where Deployed Apps Run)

Once an app is built and bundled into the FileMaker file, the resulting WebViewer app will run on:

- **FileMaker Pro** (macOS and Windows)
- **FileMaker Go** (iOS / iPadOS)
- **FileMaker WebDirect**

For WebDirect specifically, there are some additional considerations around window refresh behavior — see [FAQ — Does ProofKit work in WebDirect?](faq-page.md#does-proofkit-work-in-webdirect).

## What's Out of Scope for This Release

ProofKit v2 enables **agentic coding of WebViewer apps**. It does *not* enable agentic editing of other FileMaker elements:

- Scripts
- Tables and fields
- Layouts
- Value lists
- Other schema or design elements

These are on the roadmap. We are working with Claris on the underlying capabilities that would make some of these possible, and we may ship experimental features as those capabilities become available — see [FAQ — Can ProofKit enable agentic editing of scripts or tables?](faq-page.md#can-proofkit-enable-agentic-editing-of-scripts-or-tables). For now, the agent's writing scope is the WebViewer app itself.

## Summary

| Requirement | Value |
|---|---|
| FileMaker version | 22 or greater (next major version: 26) |
| Tested AI environments | Claude Code, Claude Desktop |
| Goal AI environments | Cursor, Codex, OpenCode, and other MCP-compatible agents |
| Required for development | FileMaker Pro |
| Required for hosting the file | None — local or server is fine |
| Deployed app runtimes | FileMaker Pro (macOS/Windows), FileMaker Go, FileMaker WebDirect |
| Agentic coding scope | WebViewer apps only (scripts, tables, layouts not yet supported) |
