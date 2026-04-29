# ProofKit v2 — Content Library Index

This folder contains the internal source-of-truth documents for ProofKit v2. These documents capture our thinking, positioning, and messaging. They are not meant to be published directly — they are the content library we draw from when designing landing pages, documentation, and marketing materials for the public site.

## Overview

ProofKit is a suite of tools that enables agentic development inside FileMaker. It lets developers use the AI coding agents they already have (Claude Code, Cursor, Codex, etc.) to build web apps that run inside FileMaker WebViewers — or as standalone web apps backed by FileMaker. The agent reads the FileMaker file, writes code, tests it in a real browser, fixes its own mistakes, and deploys the result. ProofKit provides the metadata access, feedback loops, opinionated stack, and deployment tooling that make this work.

The key themes across all documents:

- **Agent first** — everything is designed so coding agents can work effectively inside FileMaker
- **Close the loop** — agents need deterministic feedback to self-correct; ProofKit provides it
- **Hybrid apps** — WebViewer apps that combine modern web UI with FileMaker's platform-level capabilities (security, scripting, file system, printing)
- **Staged progression** — WebViewer → web app with FileMaker backend → off FileMaker entirely, if and when that makes sense
- **Meet developers where they are** — support existing editors rather than building a new one

## Documents

### [First Principles](first-principles.md)
The foundational "why" behind every design decision. Covers: Agent First, Meet Developers Where They Are, Close the Loop for Agents, Start Where the On-Ramp Is Easiest (WebViewers), Full Web Apps Are Coming, and Deployed Code Should Behave Like FileMaker Code. This is the document to consult when making scope or priority decisions.

### [Highlights](hilights.md)
The "what" — concrete capabilities and the value pitch. Covers why WebViewers matter (UI freedom, performance gains), what ProofKit does well (metadata access, feedback loops, automated deployment, opinionated stack, flexibility), and the before/after comparison. This is the document to draw from for feature-focused content and demos.

### [Hybrid Apps](hyrid-apps.md)
Deep dive on what a hybrid FileMaker app actually is and why it's powerful. The "multi-user Electron" analogy. Covers inherited security, secure backend via scripts, CORS-free network access, file system access, printing/PDF generation, and plugin SDK extensibility. This is the document to draw from when explaining the hybrid app concept to developers who know web tech but not FileMaker, or vice versa.

### [FAQ](faq-page.md)
Anticipated questions and clear answers. Covers: what ProofKit is, what it produces, framework vs. tools, relationship to previous versions, open source status, token costs, relationship to ProofChat, agentic editing of scripts/tables, end-user requirements, and WebDirect support. This is the document to draw from for FAQ pages and support content.

### [What We Want FM Devs to Hear](what-want-fm-devs-to-feel.md)
Messaging strategy and positioning for the FileMaker community. Split into "things we say out loud" (you can code with agents in FileMaker, move in stages, security matters) and "things we imply" (Proof services for complex projects, Proof can help you leave FileMaker if that's the right outcome). This is the document to consult when writing marketing copy, conference talks, or community posts.

## How to Use This Library

1. **For landing pages**: Start with [Highlights](hilights.md) for the feature narrative, pull the "why" from [First Principles](first-principles.md), and use [What We Want FM Devs to Hear](what-want-fm-devs-to-feel.md) for tone and messaging guardrails.
2. **For documentation pages**: Start with [Hybrid Apps](hyrid-apps.md) and [Highlights](hilights.md) for conceptual content, and [FAQ](faq-page.md) for anticipated questions.
3. **For decision-making**: Consult [First Principles](first-principles.md) — it explains not just what we're building but what we're deliberately not building and why.
