# ProofKit FAQ

## What is ProofKit?

ProofKit is an opinionated suite of tools that enables agentic development inside FileMaker. Its core purpose is to let developers use AI agents (Claude Code, Cursor, Codex, etc.) to build web apps that run inside FileMaker WebViewers — or that use FileMaker as a backend.

It bundles our opinions on the modern web stack — TypeScript, React, Tailwind, shadcn/ui, Vite or Next.js — so you don't have to make those decisions yourself. It includes AI skills that teach the agent how to pull data from a FileMaker backend, whether that's via a FileMaker script (when running in a WebViewer), OData, or the Data API. For the full stack details, see [Highlights — Ships an Opinionated, Battle-Tested Stack](hilights.md#4-ships-an-opinionated-battle-tested-stack).

Two technical pieces make agentic coding in FileMaker actually work:

1. The agent can read metadata from the FileMaker file — field names, script names, layout names, etc.
2. The agent can inspect the WebViewer output, read errors, take screenshots, and self-correct. Closing that feedback loop is what makes the whole thing viable.

These are direct expressions of the [Agent First](first-principles.md#1-agent-first) and [Close the Loop](first-principles.md#3-close-the-loop-for-agents) principles.

## What does ProofKit produce — web apps for FileMaker, or WebViewer apps?

Both. We're starting with a focus on WebViewers, but we see a natural progression: WebViewer → web app with FileMaker backend → eventually moving off FileMaker entirely if that makes sense for the customer. As Eric Luce put it: it's always a web app, it's just that sometimes the web app is running inside a WebViewer. For why we start with WebViewers, see [First Principles — Start Where the On-Ramp Is Easiest](first-principles.md#4-start-where-the-on-ramp-is-easiest-webviewers). For what makes a WebViewer app uniquely powerful, see [Hybrid Apps](hyrid-apps.md).

## Is ProofKit a framework or a collection of tools?

It's a collection of tools. The primary goal is to enable agentic development in FileMaker, and ProofKit is the toolset that makes that happen. See [First Principles](first-principles.md) for what guides what we build and what we don't.

## Is the new ProofKit replacing proofkit.dev?

It's both a replacement and an expansion. ProofKit started before agents were really a thing — this new version is ProofKit, but with agents. We're consolidating everything under one brand: no more ProofKit MCP vs. ProofKit AI vs. ProofKit dev. It's all just ProofKit. The new release will include an MCP server, command-line capabilities, and support for everything the previous version supported.

## Is ProofKit going to remain open source?

The proofkit.dev website and the public GitHub repo will remain open source. The MCP server and other components we want to maintain in closed source will live in a separate repo.

## What does ProofKit cost?

**ProofKit is free.** It's a tool — like a hammer. Apps you build with ProofKit are yours. You can do whatever you want with them. You don't need ProofKit installed to run the apps you build with it; the deployed bundle is just HTML and JavaScript living in your FileMaker file.

The cost you do pay is for the AI agent itself (Claude Code subscription, OpenAI API usage, etc.) — that's between you and your AI provider, not us.

## Is token cost a real concern?

Yes. AI inference is currently being heavily subsidized by Anthropic, OpenAI, and others — we're paying a fraction of what it actually costs to run. That will eventually have to correct. We hope that competition from open source and local models will keep the prices within a range were the value is clear.

## What happens when the agent generates bad code?

ProofKit ships with a lot of guardrails specifically to keep agents on track — see [First Principles — Close the Loop for Agents](first-principles.md#3-close-the-loop-for-agents) and [Highlights — Closes the Loop Between Writing, Testing, and Fixing](hilights.md#2-closes-the-loop-between-writing-testing-and-fixing). Linters, type checks, type generators from your FileMaker schema, and an embedded browser that lets the agent see runtime errors all combine to let the agent self-correct most mistakes without you intervening.

When you do need to dig in yourself, the project includes the standard web devtools — including TanStack Query devtools — so you can inspect state and network calls just like in any modern web project.

To be clear: ProofKit doesn't make you a senior engineer. It gets you started on your coding journey, and if you're already advanced it makes you more productive.

## Can I migrate apps built with an older version of ProofKit to v2?

The deployed apps themselves are just HTML and JavaScript living in your FileMaker file — they will continue to work as-is. There's nothing to migrate on the runtime side.

What changes between versions is the **developer tooling** — the MCP server, CLI, and skills you use to build new apps or modify existing ones. Future Claris releases may unlock new ProofKit features that depend on newer FileMaker versions, but older deployed apps will continue to run.

## How does multi-developer / team workflow work?

For the **FileMaker file** itself, ProofKit doesn't change anything. FileMaker has never had a shared development model that doesn't involve developers working against a shared file hosted on a server. That's still how it works. It may be solved in the future, but it isn't yet.

For the **web code**, you have all the normal options. The ProofKit project is just a web project — you can put it on GitHub, use branches and pull requests, run CI, and follow whatever SDLC your team prefers.

## Where do I get help?

The community lives at [community.proof.sh](https://community.proof.sh). That's the place for questions, sharing what you've built, and getting unstuck.

## Can ProofKit enable agentic editing of scripts or tables

This release is targeted at building UI components. We want to be able to support scripts and other FileMaker elements, but it's challenging. We are working with Claris to suggest ways that this might get easier. We may enable some experimental features to try these types of operations if we can. For the full scope of what's in and out of this release, see [Technical Requirements — What's Out of Scope for This Release](technical-requirements.md#whats-out-of-scope-for-this-release).

## Do the users of my ProofKit coded app need to have proofkit installed?

No. What get's installed is just for developer mode. After the application is built and bundled into your application, all they need is FileMaker

## Does Proofkit work in WebDirect.

You will need FileMaker Pro to agentically code your FileMaker application. Once the application is bundled and deployed into FileMaker, it will work in WebDirect, but there are some special things you will need to do do make sure that refreshing the windows doesn't disrupt your users.  We will have more information on that soon. For the full list of supported runtime environments and FileMaker version requirements, see [Technical Requirements](technical-requirements.md).
