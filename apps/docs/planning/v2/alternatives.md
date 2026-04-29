# Alternatives and How ProofKit Compares

A reasonable question from any first-time visitor: *why ProofKit, and not something else?* This document captures how we think about the alternatives a developer might consider, and where ProofKit fits among them.

The lens we apply is the one in [First Principles](first-principles.md), particularly **[Agent First](first-principles.md#1-agent-first)** and **[Close the Loop for Agents](first-principles.md#3-close-the-loop-for-agents)**. Most existing approaches were designed for a pre-agentic world — they solve the problem of "a human writing WebViewer code." ProofKit is designed for a different problem: "an agent writing WebViewer code, and a human supervising." That difference shapes everything.

## Hand-Rolled WebViewers

The most common approach today: a developer writes HTML/JS by hand, figures out the bundling, and pastes the output into a FileMaker container or text field.

This works, and many great apps have been built this way. What it doesn't do is close the loop for an agent. The agent has no direct access to your file's metadata, no automated way to deploy, no embedded browser to verify what it just wrote. Every iteration becomes a copy-paste cycle the developer has to drive. Pre-agentic approaches were built around the assumption that the human is the one iterating — that assumption no longer holds.

## Pre-Agentic FileMaker Web Frameworks

A handful of projects predate the current generation of coding agents. They typically provide a component library, a data-access pattern, and conventions for working inside a WebViewer. They were good answers to the problem they were designed for.

The problem they were designed for is no longer the most important problem. Once an agent can write the code, what matters is whether the toolchain gives the agent the metadata, feedback, and deterministic deployment it needs to iterate to a correct result. That's where ProofKit invests — and it's not where pre-agentic frameworks were aimed.

## Commercial Tools That Cover Similar Ground

A few commercial products overlap with parts of what ProofKit does — schema access, deployment helpers, scaffolding. The differences worth noting:

- **ProofKit is free.** See the [FAQ](faq-page.md#what-does-proofkit-cost). What you build with it is yours, and you don't need ProofKit installed to run the deployed apps.
- **ProofKit is agent-first by design.** The whole toolchain is shaped around closing the loop for a coding agent rather than presenting a UI for a human to drive.
- **ProofKit is open about what it's not.** We are explicit about what's in scope today and what isn't — see [Technical Requirements](technical-requirements.md#whats-out-of-scope-for-this-release).

## Leaving FileMaker Entirely

The other alternative on the table for many shops: rewrite the application from scratch in a modern stack — Next.js, Postgres, a hosted backend — and walk away from FileMaker.

This is sometimes the right answer. It is also the answer with the highest cost and the highest risk. People trying to leap straight from FileMaker to a custom AI-built stack are running into real walls: databases getting deleted, codebases collapsing four to six months in. You also throw away everything FileMaker gives you for free — security model, multi-user database, scripting engine, file system access, printing — and have to rebuild each piece. See [Hybrid Apps](hyrid-apps.md) for what that "free" really amounts to.

ProofKit's view: if leaving makes sense, leave — but do it in stages. Replace layouts with WebViewers first, then move to a separate web app with FileMaker as the backend, then if the economics still demand it, leave FileMaker. ProofKit is designed to support that whole path.

## The Bottom Line

The question isn't really "ProofKit vs. X." It's "what are you optimizing for?" If you want an agent to write WebViewer code well, with tight feedback loops and automated deployment, ProofKit is the toolchain built for that. If your needs are different — a hand-coded one-off, an existing investment in another framework — that's fine, and ProofKit can often accommodate alternative stacks anyway (see [Highlights — Stays Flexible When You Need It](hilights.md#5-stays-flexible-when-you-need-it)).
