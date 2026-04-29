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
Deep dive on what a hybrid FileMaker app actually is and why it's powerful. The "multi-user Electron" analogy. Covers inherited security, secure backend via scripts, CORS-free network access, file system access, printing/PDF generation, offline support, and plugin SDK extensibility. This is the document to draw from when explaining the hybrid app concept to developers who know web tech but not FileMaker, or vice versa.

### [Data Flow](data-flow.md)
How data actually moves between FileMaker and a ProofKit WebViewer app at runtime. Includes a Mermaid diagram of the round-trip between the React app, FileMaker scripts, the database, and external systems. This is the document to draw from when developers ask "how does this actually work under the hood?" — pairs naturally with [Hybrid Apps](hyrid-apps.md).

### [Alternatives](alternatives.md)
How ProofKit compares to other ways of solving the same problem: hand-rolled WebViewers, pre-agentic FileMaker web frameworks, commercial tools, and leaving FileMaker entirely. Framed through the lens of agent-first design and closing the loop. This is the document to draw from when answering "why ProofKit and not X?" on the homepage, FAQ, or in sales conversations.

### [FAQ](faq-page.md)
Anticipated questions and clear answers. Covers: what ProofKit is, what it produces, framework vs. tools, relationship to previous versions, open source status, pricing (free), token costs, agentic editing of scripts/tables, end-user requirements, WebDirect support, debugging and guardrails, migration between versions, team workflow, and where to get help. This is the document to draw from for FAQ pages and support content.

### [What We Want FM Devs to Hear](what-want-fm-devs-to-feel.md)
Messaging strategy and positioning for the FileMaker community. The headline messages we want to land: you can code with agents in FileMaker, you can move in stages, and security comes built in. This is the document to consult when writing marketing copy, conference talks, or community posts.

### [Content Required for Launch](content-required-for-launch.md)
The launch content plan — what assets we need to produce and where they come from. Covers: a four-part getting started video series, a written getting started guide, a homepage redesign, an announcement blog post, a public FAQ page, and a technical requirements page. Each asset maps back to the source documents in this folder. This is the document to consult when planning production work and tracking what's done.

### [Technical Requirements](technical-requirements.md)
The hard requirements for ProofKit v2 at launch: FileMaker 22 or greater (with future releases tracking FileMaker 26), Claude Code and Claude Desktop as the tested AI environments, FileMaker Pro and Node.js (LTS) required for development, the runtime environments where deployed apps will run (Pro, Go, WebDirect), required developer background (web experience helpful but not required), and the ~30-minute time-to-first-deployed-app target. Also calls out what is explicitly out of scope for this release — agentic editing of scripts, tables, and layouts. This is the document to consult when answering "will this work for me?" questions or writing the public technical requirements page.

## How to Use This Library

1. **For landing pages**: Start with [Highlights](hilights.md) for the feature narrative, pull the "why" from [First Principles](first-principles.md), and use [What We Want FM Devs to Hear](what-want-fm-devs-to-feel.md) for tone and messaging guardrails.
2. **For documentation pages**: Start with [Hybrid Apps](hyrid-apps.md) and [Highlights](hilights.md) for conceptual content, [Data Flow](data-flow.md) for how the runtime fits together, and [FAQ](faq-page.md) for anticipated questions.
3. **For competitive / "why ProofKit?" content**: Use [Alternatives](alternatives.md), grounded in [First Principles](first-principles.md).
4. **For decision-making**: Consult [First Principles](first-principles.md) — it explains not just what we're building but what we're deliberately not building and why.
5. **For launch planning**: Consult [Content Required for Launch](content-required-for-launch.md) for the full list of assets to produce, their source documents, and how they relate to each other.

## Out of Scope for v2

Items we'd like to ship eventually but have triaged out of the v2 launch live in [v2-next/](../v2-next/index.md). Currently parked there: [examples and case studies](../v2-next/examples-and-case-studies.md).
