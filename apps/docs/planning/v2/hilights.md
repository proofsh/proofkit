# ProofKit Highlights

ProofKit is the product of years of building FileMaker web applications — both for WebViewers and standalone browsers — and, more recently, of building those applications with AI coding agents. The release of **ProofKit MCP** brings everything we've learned into a single, opinionated toolkit that unlocks agentic coding for FileMaker.

## Why Build With WebViewers

Before talking about ProofKit, it's worth being clear about why WebViewers are such a powerful target for improving a FileMaker system in the first place. WebViewers are where we start because the on-ramp is easiest — see [First Principles — Start Where the On-Ramp Is Easiest](first-principles.md#4-start-where-the-on-ramp-is-easiest-webviewers). For a deeper look at what a WebViewer-based app actually gives you, see [Hybrid Apps](hyrid-apps.md).

### Break Free of FileMaker's Limited UI Canvas

Native FileMaker layouts give you a relatively small set of components. FileMaker developers are famously creative at squeezing more out of them, but you're still working inside hard limits. Modern UI patterns either look dated on a native layout or simply don't exist:

- Kanban boards
- Full-featured calendars
- Accordions and disclosure panels
- Data grids with sorting, filtering, and resizable columns
- Rich date and time pickers
- Charting and data visualization

With web technology in a WebViewer, **anything you can build on the web you can render on a FileMaker layout**. The UI ceiling effectively disappears.

### Reduce Calculation Load and Improve Performance

A lot of FileMaker UI behavior — show/hide, conditional formatting, enable/disable, filtered portals, sortable portal headers — is built with layout calculations, field calculations, or unstored calculations. These workarounds can put real strain on the database: unstored calculations may walk many records to produce a single visual effect, which gets slow fast.

A WebViewer UI can:

- Move presentation logic out of unstored calculations and into the browser, where it's cheap
- Implement filtering, sorting, and conditional rendering instantly on the client
- Reduce the work the FileMaker engine has to do to draw a screen

The result is often a layout — and a system — that performs better, not just looks better.

## Why ProofKit Exists

Coding agents need **deterministic feedback** to write code that works. Without it, you (the developer) end up doing the tedious work of copying metadata out of FileMaker, pasting errors back into your editor, and shepherding the agent through trial and error. Agents are actually better than humans at consuming this kind of structured information — provided they can get to it. ProofKit gives them that access. This is the "agent first" and "close the loop" principles in action — see [First Principles](first-principles.md#1-agent-first).

## What ProofKit Does Well

### 1. Gives Agents Direct Access to Your FileMaker File

Through the ProofKit MCP server, coding agents can explore your FileMaker file directly:

- List layouts and the fields on each layout
- Read tables and table fields
- Get script names
- Read value lists and value list items
- Access the metadata they need to generate code that actually fits your file

No more copy-paste of XML or DDR exports.

### 2. Closes the Loop Between Writing, Testing, and Fixing

Agents don't just write code — they verify it. ProofKit closes the loop with multiple feedback channels:

- **Linters and formatters** built in
- **Deterministic quality gates** that check validity
- **TypeScript and React** — well understood by LLMs
- **Type generators** so agents know the shape of your data
- **Embedded browsers** so agents can navigate the app, see the rendered UI, and read console errors

When something is broken — a missing field, a runtime error, a UI defect — the agent sees it and self-corrects. This is the critical unlock for agentic coding in FileMaker.

### 3. Automates Deployment Into Your FileMaker File

The MCP server bundles your HTML, optimizes it for FileMaker WebViewers, and deploys it into the file. In the current release, bundled artifacts are stored in a dedicated table/field; future releases will remove that requirement — see [First Principles — Deployed Code Should Behave Like FileMaker Code](first-principles.md#6-deployed-code-should-behave-like-filemaker-code). Either way, the deployment details are handled for you — no manual bundling, no manual placement.

### 4. Ships an Opinionated, Battle-Tested Stack

You don't have to choose a bundler, a framework, a UI library, a router, or a data layer. ProofKit comes with:

- **React + TypeScript** as the foundation
- **shadcn/ui** for beautiful, tweakable components
- **Dark and light mode** out of the box
- **Multi-page routing** so a single bundle can host customers, invoices, dashboards, detail views, etc., with sidebar or top navigation
- **TanStack Query** for intelligent caching and keeping the UI in sync with FileMaker server data — without hammering the server and without manual refreshes

Everything is integrated and known to work together.

### 5. Stays Flexible When You Need It

The happy path is the opinionated stack — fastest way to a working app, especially if you're newer to web development. But if you've already invested in a different stack (Svelte, Vue, etc.), ProofKit can accommodate it. We'll make alternative stacks easier over time.

## The Bottom Line

Without ProofKit, building an agentic FileMaker WebViewer app means:

- Hand-copying metadata from FileMaker into your editor
- Hand-copying errors back the other way
- Choosing and wiring up a bundler, framework, UI library, router, and data layer yourself
- Figuring out how to bundle and deploy HTML into your file correctly, every time

With ProofKit, the agent reads the file, writes the code, tests it in a real browser, fixes its own mistakes, and ships the result into your FileMaker file. You stay focused on the application — not the plumbing.

For common questions about what ProofKit is and how it fits, see the [FAQ](faq-page.md). For the advantages a hybrid WebViewer app gives you over a pure browser app, see [Hybrid Apps](hyrid-apps.md). For how these capabilities translate into launch content — videos, guides, and the homepage — see [Content Required for Launch](content-required-for-launch.md).
