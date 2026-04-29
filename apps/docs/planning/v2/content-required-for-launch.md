# Content Required for Launch

This document defines the content assets we need to produce before ProofKit v2 goes public. It covers video, documentation, landing pages, and blog content. Each section describes what the asset is, what it covers, and where it fits in the overall launch.

## Getting Started Video Series

A four-part video series that walks a new user through the happy path from zero to deployed. These videos serve double duty: they are the backbone of the **Getting Started Guide** in the documentation, and they are standalone assets that can be embedded into landing pages and marketing material.

### Video 1 — Download, Install, and Set Up

The simplest possible on-ramp. This video covers:

- Downloading and installing ProofKit
- Connecting it to a FileMaker file
- Getting the tool running and confirming the connection works

No coding, no project creation — just get the tool installed and talking to your file. The goal is to show that setup is fast and straightforward. This directly demonstrates the [First Principles — Meet Developers Where They Are](first-principles.md#2-meet-developers-where-they-are--in-their-editor-of-choice) principle — developers stay in their own editor.

### Video 2 — Explore Your Data in Chat Mode

Before building anything, show what you get for free just by having the tool installed. This video covers:

- Using chat mode to explore your FileMaker data
- Asking questions about your schema — tables, fields, layouts, relationships
- Generating charts and visualizations from your data on the fly

This is the "chat over your data" experience. No WebViewer project, no code — just a developer having a conversation with an agent that understands their FileMaker file. It demonstrates [Highlights — Gives Agents Direct Access to Your FileMaker File](hilights.md#1-gives-agents-direct-access-to-your-filemaker-file) in the most approachable way possible.

### Video 3 — Build a WebViewer Project with Claude Code

Now we build something. This video switches from chat mode to agentic coding and covers:

- Using Claude Code (not chat) to scaffold a new WebViewer project
- Getting the project running in a browser with live preview
- Building a UI that is connected to the FileMaker database
- Seeing the full write → test → fix loop in action

This is where the power of [closing the loop](first-principles.md#3-close-the-loop-for-agents) becomes visible — the agent writes code, sees the result, and iterates. The viewer gets to watch the agent self-correct its way to a working app.

### Video 4 — Deploy to Your FileMaker File

The final step: getting the finished app into the FileMaker file. This video covers:

- Bundling the web app for deployment
- Deploying the bundle into the FileMaker file
- Verifying the deployed app works inside a WebViewer

This demonstrates [Highlights — Automates Deployment Into Your FileMaker File](hilights.md#3-automates-deployment-into-your-filemaker-file) and closes the loop on the full developer workflow: install → explore → build → deploy.

## Getting Started Guide

A documentation page (or short series of pages) that mirrors the video series above. Each section corresponds to a video, with written steps, screenshots, and an embedded video. This is the primary entry point for new users in the docs.

The guide draws from the same material as the videos but is designed to be followable without watching them — a developer should be able to work through the guide with just the text and screenshots.

## Homepage Redesign

A complete redo of the current ProofKit homepage at proofkit.dev. The new homepage will be built from the content library in this folder:

- **Hero and value proposition** — drawn from [Highlights](hilights.md) and [What We Want FM Devs to Hear](what-want-fm-devs-to-feel.md)
- **Feature narrative** — drawn from [Highlights — What ProofKit Does Well](hilights.md#what-proofkit-does-well)
- **Hybrid app concept** — drawn from [Hybrid Apps](hyrid-apps.md)
- **FAQ section** — drawn from [FAQ](faq-page.md)
- **Embedded getting started videos** — from the video series above
- **Calls to action** — links to the Getting Started Guide, documentation, and GitHub

The homepage should convey the core messages from [What We Want FM Devs to Hear](what-want-fm-devs-to-feel.md): you can code with agents in FileMaker, you can move in stages, and security comes built in.

## Announcement Blog Post

A blog post published on the Proof website (proofgeist.com) announcing ProofKit v2 and linking to the proofkit.dev domain. This is the launch announcement — it should:

- Explain what ProofKit v2 is and what's new
- Highlight the key capabilities (agent-first development, feedback loops, deployment)
- Link to the proofkit.dev homepage and Getting Started Guide
- Position ProofKit within the broader story of where FileMaker development is heading

Tone and messaging should follow the guardrails in [What We Want FM Devs to Hear](what-want-fm-devs-to-feel.md).

## Documentation Pages

### FAQ Page

A public-facing FAQ page on proofkit.dev. Content is drawn from the internal [FAQ document](faq-page.md) in this folder, adapted for a public audience. Covers: what ProofKit is, what it produces, framework vs. tools, open source status, token costs, end-user requirements, WebDirect support, and other anticipated questions.

### Technical Requirements Page

A documentation page that details exactly what is required to use ProofKit. The internal source of truth is [Technical Requirements](technical-requirements.md) — the public page is adapted from that document. Covers:

- **FileMaker versions** — FileMaker 22 or greater, with future releases tied to FileMaker 26
- **AI coding environments** — Claude Code and Claude Desktop are tested at launch; broader MCP-compatible agents are the goal
- **Supported runtime platforms** — FileMaker Pro (macOS, Windows), FileMaker Go (iOS/iPadOS), WebDirect
- **Platform-specific notes** — any differences in capability or behavior across platforms (e.g., WebDirect refresh considerations noted in the [FAQ](faq-page.md))
- **What's out of scope** — agentic editing of scripts, tables, and layouts is not in this release

## Summary

| Asset | Type | Primary Source Documents |
|---|---|---|
| Video 1 — Install & Set Up | Video | — |
| Video 2 — Chat Mode | Video | [Highlights](hilights.md) |
| Video 3 — Build a WebViewer | Video | [First Principles](first-principles.md), [Highlights](hilights.md) |
| Video 4 — Deploy | Video | [Highlights](hilights.md) |
| Getting Started Guide | Docs | Videos 1–4 |
| Homepage Redesign | Web | All documents in this folder |
| Announcement Blog Post | Blog | [What We Want FM Devs to Hear](what-want-fm-devs-to-feel.md), [Highlights](hilights.md) |
| FAQ Page | Docs | [FAQ](faq-page.md) |
| Technical Requirements | Docs | [Technical Requirements](technical-requirements.md), [FAQ](faq-page.md) |
