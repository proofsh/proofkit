# Phase 01: AI-Friendly Docs — SEO, Sitemap & llms.txt Improvements

This phase makes the ProofKit documentation site discoverable and consumable by both search engines and AI agents. By the end, the docs will have proper SEO metadata (sitemap, robots.txt, OpenGraph tags), improved llms.txt endpoints, and a working agent-detection middleware that serves markdown to LLM crawlers. This is the highest-priority work because better discoverability directly impacts how well AI assistants can help users build with ProofKit.

## Tasks

- [x] Add SEO fundamentals to the Fumadocs site (`apps/docs/`):
  - Create `apps/docs/src/app/sitemap.ts` using Next.js App Router's built-in sitemap generation. Import `source` from `@/lib/source` and iterate `source.getPages()` to produce URLs rooted at `https://proofkit.proof.sh/docs/`. Include the llms.txt routes as well.
  - Create `apps/docs/src/app/robots.ts` using Next.js App Router's built-in robots generation. Allow all crawlers, point to the sitemap URL, and explicitly allow `/llms.txt`, `/llms-full.txt`, and `/llms/` paths.
  - Update `generateMetadata` in `apps/docs/src/app/docs/(docs)/[[...slug]]/page.tsx` to include OpenGraph metadata (`og:title`, `og:description`, `og:type: article`, `og:url`) using the page's title, description, and constructed URL. Use Next.js `Metadata` type's built-in `openGraph` field.
  - Add a root-level `metadata` export in `apps/docs/src/app/layout.tsx` with `metadataBase` set to `https://proofkit.proof.sh` so all relative OG URLs resolve correctly.

- [ ] Improve the llms.txt endpoints for better agent consumption:
  - In `apps/docs/src/app/llms.txt/route.ts`: fix the `"package"` field in `notify-intent.yml` — it still says `"with-changesets"` (template placeholder) instead of identifying the actual package. Note: this is in `.github/workflows/notify-intent.yml` line 59. Update the payload to dynamically determine the package name from the changed files, or use a static value like `"proofkit"`.
  - In the same llms.txt route, add a `## Getting Started` section that tells agents: "To scaffold a new ProofKit project, run `pnpm create proofkit` or `npx create-proofkit@latest`. For package-specific usage, see the per-package links below."
  - Add cache headers (`Cache-Control: public, max-age=3600, s-maxage=86400`) to all three llms.txt route responses so CDN can cache them.
  - In `apps/docs/src/app/llms/[package]/route.ts`, ensure the response includes a header comment pointing to the main llms.txt for context.

- [ ] Create agent-detection middleware for serving markdown to LLM crawlers:
  - Create `apps/docs/src/middleware.ts` that detects common AI/LLM user agents (e.g., `GPTBot`, `ChatGPT-User`, `Claude-Web`, `Anthropic`, `CCBot`, `Google-Extended`, `PerplexityBot`, `Bytespider`, and generic patterns like `bot` + `ai` in user-agent).
  - When an LLM agent is detected requesting a `/docs/` page, rewrite the request to the corresponding `/llms/` endpoint or serve the raw MDX content as plain text. The simplest approach: redirect detected agents to `/llms-full.txt` for root requests or `/llms/{package}` for package-specific requests by parsing the URL slug.
  - For non-agent requests, pass through normally.
  - Configure the middleware matcher in the export to only run on `/docs/:path*` routes to avoid affecting API routes or static assets.

- [ ] Audit and improve llms.txt content accuracy:
  - Read through each package's docs directory (`apps/docs/content/docs/{package}/`) and compare the descriptions in the llms.txt PACKAGES array against the actual content. Ensure package descriptions are accurate and helpful for an AI agent trying to understand what each package does.
  - Check that `apps/docs/src/app/llms/[package]/route.ts` correctly maps all 7 packages and that the content returned for each is complete (not truncating or missing pages).
  - Verify the `getLLMText()` function in `apps/docs/src/lib/get-llm-text.ts` properly strips frontmatter and produces clean markdown. Test edge cases: pages with code blocks, tables, links.

- [ ] Build and verify the docs site compiles with all changes:
  - Run `pnpm --filter @proofkit/docs build` to ensure no build errors from the new sitemap, robots, middleware, and metadata changes.
  - Run `pnpm run ci` from the repo root to validate lint, typecheck, and tests all pass.
  - If any issues arise, fix them before completing this task.
