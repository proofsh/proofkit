# Data Flow

This document explains how data moves between FileMaker and a ProofKit WebViewer app at runtime. It's a companion to [Hybrid Apps](hyrid-apps.md) — that document explains *why* the hybrid model is powerful, this one explains *how* the pieces fit together.

> **Note:** The diagram below is a working draft. The shape is right, but the specific call names and flows may need refinement.

## The Round Trip

A ProofKit WebViewer app is a normal React app that happens to run inside a FileMaker WebViewer. The WebViewer hosts the HTML/JS bundle; the React app talks to FileMaker by calling FileMaker scripts and receiving structured data back.

```mermaid
flowchart LR
    User([User])

    subgraph FMFile["FileMaker File"]
        Script{{"FileMaker<br/>Scripts"}}
        WV["WebViewer<br/>(React App)"]
        HTML["html bundle"]
        DB[("FM Database")]
        Print["Printing, etc."]
        FS["File System"]
        APIs["External APIs"]

        HTML --> WV
        WV <--> Script
        Script <--> DB
        Script --> Print
        Script --> FS
        Script -->|"No CORS issues"| APIs
        WV --> APIs
    end

    User <--> WV
```

## The Pieces

- **The user** interacts with the WebViewer directly.
- **The WebViewer** hosts the bundled HTML/JS — the React app deployed by ProofKit. It uses TanStack Query to manage server state and trigger calls into FileMaker.
- **FileMaker scripts** are the secure back end and the hub of the diagram. Anything a script can do, the web app can now do — read/write the database, access the file system, print, generate PDFs, make network requests.
- **The database** enforces the user's privilege set. The script runs with the user's permissions, so authorization is inherited rather than re-implemented.
- **External APIs** can be reached two ways: directly from the WebViewer (subject to CORS, with any secrets exposed to the browser) or through a script (no CORS, secrets stay in FileMaker). The script path is the reason this architecture matters.

## Why This Matters

Two properties fall out of this architecture:

1. **Secrets stay in FileMaker.** API keys, credentials, and sensitive logic live inside scripts. Browser code never sees them.
2. **The web app inherits everything FileMaker can do.** Printing, file system access, native cURL, plugins — all reachable through a script call.

For deeper coverage of these advantages, see [Hybrid Apps — Advantages Over Browser-Only Apps](hyrid-apps.md#advantages-over-browser-only-apps).
