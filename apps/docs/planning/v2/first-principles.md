# First Principles

These are the principles that guide what we build, what we don't build, and where we focus our effort. They explain not just what ProofKit is today, but why it is shaped the way it is.

## 1. Agent First

Our number one focus is creating systems that **coding agents can work with effectively inside FileMaker.** Everything else flows from this.

The most important feature ProofKit brings is the ability for agents to write FileMaker WebViewer applications well — to read the file, generate code that fits, deploy it, and verify the result. For the concrete capabilities this enables, see [ProofKit Highlights — What ProofKit Does Well](hilights.md#what-proofkit-does-well).

A direct consequence of "agent first" is what we are *not* building, at least for now: **our own coding editor or agent.** The first thing we're doing is enabling whatever coding agent people are already using to code effectively inside FileMaker. (See also: [FAQ — Is ProofKit a framework or a collection of tools?](faq-page.md#is-proofkit-a-framework-or-a-collection-of-tools))

## 2. Meet Developers Where They Are — In Their Editor of Choice

People will have a coding editor they prefer, and the ecosystem incentives push hard in that direction:

- **Subscriptions lock in tools.** If a developer has a Claude Code Max subscription, they're going to use Claude Code rather than reach for an editor that requires them to bring their own API key and pay per token.
- **The leading agents are genuinely good.** Claude Code, Cursor, Codex, OpenCode, and others all have deep, sophisticated understanding of how to write code. Reproducing a custom editor that competes with them — and that's also tailored to FileMaker — would be a massive undertaking.
- **Editors are integrated with broader workflows.** Developers' editors are wired into their other tools and habits. Asking them to switch is asking a lot.

So we strongly believe the first move is to **support the coding editors developers are already using**, not to build a new one. It's the most flexible way forward and the fastest way to deliver value. This is also a core part of our public messaging — see [What We Want FM Devs to Hear — You can code with agents in FileMaker](what-want-fm-devs-to-feel.md#you-can-code-with-agents-in-filemaker).

## 3. Close the Loop for Agents

This is the practical corollary of "agent first." An agent without feedback is an agent that hallucinates. An agent *with* good feedback can iterate its way to a correct solution.

Closing the loop means: when an agent attempts a task and gets it wrong, the system provides clear, actionable feedback so it can fix its own mistakes.

In ProofKit, this shows up as:

- **Strong browser automation**, so agents can drive the actual UI, read console errors, take screenshots, and verify behavior end to end.
- **Tools that return useful errors.** When something fails, the error message is designed to tell the agent what went wrong and what to try next — not just that something failed.
- **Deterministic feedback channels** wherever possible: linters, type checks, validators that produce consistent, machine-readable signals.

Iteration is where the real power of agentic coding comes from. Closing the loop is what makes iteration possible. For the specific feedback channels ProofKit provides, see [Highlights — Closes the Loop Between Writing, Testing, and Fixing](hilights.md#2-closes-the-loop-between-writing-testing-and-fixing).

## 4. Start Where the On-Ramp Is Easiest: WebViewers

FileMaker WebViewers are the easiest entry point into this space, and that's where we're starting.

When you build a WebViewer app, a lot of hard problems are already solved for you:

- **Security** is inherited from FileMaker
- **The database** is already there
- **Deployment** is just bundling code into the file
- **Auth, multi-user access, permissions** — all handled

This connects directly to our concept of **hybrid apps** (see [hyrid-apps.md](hyrid-apps.md)). A WebViewer app is a hybrid app, and hybrid apps are uniquely powerful — combining modern web UI with FileMaker's platform-level capabilities. That's a great place to start, and a great place to stay for a large class of applications.

## 5. Full Web Apps Are Coming, Too

WebViewers are the starting point, not the ceiling. Work is already underway to make ProofKit equally good at building **full web apps backed by FileMaker** — apps that run in a regular browser and talk to FileMaker over OData, the Data API, or other server-side technologies.

These capabilities aren't surfaced yet, but we're building toward them. The natural progression is: WebViewer → web app with a FileMaker back end → eventually moving off FileMaker entirely if and when that makes sense for the customer. ProofKit is designed to support that whole path. This progression is also central to our messaging — see [What We Want FM Devs to Hear](what-want-fm-devs-to-feel.md#you-can-code-with-agents-in-filemaker) and [FAQ — What does ProofKit produce?](faq-page.md#what-does-proofkit-produce--web-apps-for-filemaker-or-webviewer-apps)

## 6. Deployed Code Should Behave Like FileMaker Code

A guiding goal: the HTML and JavaScript we deploy into a FileMaker app should **live in the FileMaker file the way other FileMaker assets live in the file** — as part of the schema and catalog, not as data sitting in a record.

In the currently shipping version of FileMaker (as of this writing), this isn't fully possible — bundled artifacts are stored in a dedicated table/field. That works, but it's not where this kind of code belongs. Deployed code should be a first-class part of the file's structure, version-controlled, inspectable, and managed alongside scripts, layouts, and tables.

We're working actively to improve this, both in ProofKit and in conversation with Claris. Future releases will move bundled output out of data records and into the file schema itself, so HTML code behaves like the other code in your FileMaker app.

## The Through-Line

Each of these principles points the same direction: **make it as easy as possible for agents and the developers who use them to build great applications inside FileMaker, using the tools they already have, with feedback loops tight enough to actually iterate to a working result.** Everything we build is in service of that.
