# Hybrid Apps

## What Is a Hybrid App?

A hybrid app is a FileMaker application that uses web technology rendered inside WebViewers for some or all of its UI, while still leveraging the full power of the FileMaker platform underneath. It's not just a database with a web front end — it's a web app that inherits everything FileMaker can do. This is where ProofKit starts — see [First Principles — Start Where the On-Ramp Is Easiest](first-principles.md#4-start-where-the-on-ramp-is-easiest-webviewers).

The key unlock is simple: **a WebViewer app can call any FileMaker script.** Anything a FileMaker script can do, your web app can now do. This gives you the best of both worlds — you build your UI with the best tools for building UI, and you retain all of FileMaker's scripting, business logic, and platform-level access.

## Think of It as Multi-User Electron

If you're familiar with [Electron](https://www.electronjs.org/), a FileMaker hybrid app will feel familiar. Electron is the cross-platform application framework behind Slack, VS Code, Figma, Discord, and countless other desktop apps. Electron apps render web technology in a native shell and give that web code privileged access to the underlying machine — file system, network, native dialogs, OS integrations.

A FileMaker hybrid app does essentially the same thing: web UI in a shell, with privileged access to the host machine through FileMaker scripts.

The crucial difference: **a FileMaker hybrid app is multi-user by default.** Electron, on its own, is just a shell — if you want multiple users sharing data, you have to build that yourself: stand up a back-end database, write a syncing engine, handle conflicts, manage authentication, deploy and operate servers. FileMaker gives you all of that out of the box. Shared data, record locking, user accounts, permissions, server-side scripting — built in.

So a FileMaker hybrid app is, in effect, **Electron with a multi-user database, security model, and back end included.**

## Advantages Over Browser-Only Apps

### Inherited Security

When a user is logged into a FileMaker file, they bring their FileMaker permissions with them. A hybrid app inherits all of that:

- The user's privilege set controls what they can see and do
- You can read those permissions inside the WebViewer and use them to drive your app's own authorization logic
- No separate auth system to build or maintain — FileMaker's security model is your security model

### A Built-In Secure Back End

Because your web app can call FileMaker scripts, those scripts act as a secure back end:

- Scripts can read encrypted data and decrypt it without exposing secrets to browser code
- You can work with API keys, credentials, and sensitive business logic inside scripts — none of it reaches the client
- This is a significant advantage over a pure browser app, where secrets are notoriously hard to protect

### CORS-Free Network Access

FileMaker has its own implementation of cURL, which means network requests from scripts are not subject to browser CORS policies. You can:

- Call any external API without CORS restrictions
- Use FileMaker's native cURL or higher-level abstractions like `fetch` built on top of it
- Reach services and endpoints that a browser would block

### File System Access

FileMaker inherits the logged-in user's file system privileges on their Mac or Windows machine. A hybrid app can:

- Read and write files anywhere the user has access — documents, preferences, temp directories, desktop
- Open native file pickers to let users choose files, then pass those files back into the WebViewer
- Work with the file system in ways that browsers simply cannot

### Printing and PDF Generation

FileMaker's printing capabilities have always been a strength, and hybrid apps get them for free:

- Use FileMaker's page setup and print engine
- Print FileMaker layouts, including subsummary reports — something that remains genuinely difficult with web technologies alone
- Save layouts as PDFs
- Build multi-page PDFs by appending pages programmatically with FileMaker scripts
- Generate PNGs or PDFs from within the WebViewer (charts, visualizations, etc.), pass them out to a FileMaker script, place them in a global field on a layout, and then incorporate them into a larger PDF or print job

The round-trip between WebViewer-generated content and FileMaker's PDF/print engine is a powerful combination.

### Plugin SDK as an Escape Hatch

FileMaker's plugin SDK lets you write C/C++ extensions that can do virtually anything:

- Direct access to ports, Bluetooth, and hardware interfaces
- Network access beyond what browsers allow
- Integration with native OS capabilities

Some of these are technically possible from a browser, but many are not. And now that AI can help developers write FileMaker plugins, this escape hatch is becoming increasingly practical — it gives hybrid apps access to capabilities that would be extremely challenging from a standard web application.

## The Bottom Line

Hybrid apps let you build modern, rich UI with the best web technologies while retaining everything that makes FileMaker powerful: its security model, its scripting engine, its file system access, its printing and PDF capabilities, and its extensibility through plugins. You don't have to choose between a great UI and a capable platform — you get both.

For the concrete tools that make building hybrid apps fast and agent-friendly, see [Highlights — What ProofKit Does Well](hilights.md#what-proofkit-does-well). For the natural progression beyond hybrid apps to full web apps and beyond, see [First Principles — Full Web Apps Are Coming, Too](first-principles.md#5-full-web-apps-are-coming-too) and [FAQ — What does ProofKit produce?](faq-page.md#what-does-proofkit-produce--web-apps-for-filemaker-or-webviewer-apps)
