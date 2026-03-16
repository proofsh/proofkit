# ProofKit — Skill Spec

ProofKit is a monorepo of TypeScript tools for building web applications integrated with Claris FileMaker. It provides API clients for FileMaker's Data API and OData API, a type generator that produces TypeScript types and runtime validators from FileMaker schemas, a WebViewer bridge for running JS inside FileMaker, and a Better Auth adapter for self-hosted authentication backed by FileMaker.

## Domains

| Domain | Description | Skills |
| --- | --- | --- |
| Connecting to FileMaker | Setting up typed connections via Data API or OData, including auth, adapters, and type generation | typegen-setup, getting-started |
| Reading and Writing Data | Querying, creating, updating, and deleting FileMaker records through either API surface | fmdapi-client, fmodata-client, odata-query-optimization |
| Running in WebViewer | Executing JavaScript inside FileMaker WebViewer with script calls and local Data API access | webviewer-integration |
| Authenticating Users | Self-hosted authentication using Better Auth with FileMaker as the database backend | better-auth-setup |

## Skill Inventory

| Skill | Type | Domain | What it covers | Failure modes |
| --- | --- | --- | --- | --- |
| typegen-setup | core | connecting | Config, CLI, Data API + OData + FM HTTP modes, validators, generated file structure, env vars | 11 |
| fmdapi-client | core | data-access | DataApi factory, adapters, token stores, CRUD, find variants, scripts, validation | 6 |
| fmodata-client | core | data-access | FMServerConnection, schema/field builders, query builder, CRUD, relationships, batch, errors | 8 |
| webviewer-integration | core | webviewer | fmFetch, callFMScript, WebViewerAdapter, browser-only constraints, local mode perf | 6 |
| better-auth-setup | core | auth | FileMakerAdapter, migration CLI, OData prerequisites | 4 |
| getting-started | lifecycle | connecting | Prerequisites, env setup, first typegen run, first query | 3 |
| odata-query-optimization | core | data-access | defaultSelect, pagination, batching, entity IDs, null query perf, relationship perf, debugging | 6 |

## Failure Mode Inventory

### typegen-setup (11 failure modes)

| # | Mistake | Priority | Source | Cross-skill? |
| --- | --- | --- | --- | --- |
| 1 | Editing files in generated/ or client/ directories | CRITICAL | docs | — |
| 2 | Using old config file format from @proofgeist/fmdapi | HIGH | source + docs | — |
| 3 | Putting env var values instead of names in config | CRITICAL | docs | — |
| 4 | Not running typegen after FileMaker schema changes | HIGH | docs | — |
| 5 | Omitting type discriminator for OData config | HIGH | source + docs | — |
| 6 | Manually redefining types instead of using generated/inferred types | CRITICAL | maintainer | fmdapi-client, fmodata-client |
| 7 | Mixing Zod v3 and v4 in the same project | HIGH | maintainer | fmdapi-client, fmodata-client |
| 8 | Using FmHttpAdapter in production application code | CRITICAL | source | — |
| 9 | Setting standard FM env vars when using fmHttp mode | HIGH | source | — |
| 10 | Suggesting OttoFMS/FetchAdapter fallback when FM HTTP fails | HIGH | maintainer | — |
| 11 | FM HTTP WebViewer window closed or in Layout mode | HIGH | maintainer | — |

### fmdapi-client (6 failure modes)

| # | Mistake | Priority | Source | Cross-skill? |
| --- | --- | --- | --- | --- |
| 1 | Creating DataApi without an adapter wrapper | CRITICAL | docs + GitHub | — |
| 2 | Omitting token store in production (FetchAdapter) | CRITICAL | GitHub #18 + docs | — |
| 3 | Storing FM recordId as a persistent identifier | HIGH | docs | — |
| 4 | Assuming dynamic layout switching on a single client | HIGH | GitHub #99 + docs | — |
| 5 | Using wrong Otto API key format | MEDIUM | source | — |
| 6 | Using deprecated zodValidators option instead of schema | HIGH | source | — |

### fmodata-client (8 failure modes)

| # | Mistake | Priority | Source | Cross-skill? |
| --- | --- | --- | --- | --- |
| 1 | Forgetting to call .execute() on query builders | CRITICAL | docs | — |
| 2 | Ignoring the Result error field | CRITICAL | docs | — |
| 3 | Using Drizzle ORM query patterns instead of fmodata patterns | CRITICAL | maintainer + Drizzle docs | — |
| 4 | Using raw SQL/JS operators instead of OData filter functions | CRITICAL | docs | — |
| 5 | Container fields in select() calls | HIGH | source | — |
| 6 | Expecting batch operations to continue after first error | HIGH | docs | — |
| 7 | Script names with special characters via OData | MEDIUM | docs | — |
| 8 | Using defaultSelect "all" without understanding performance impact | MEDIUM | docs | odata-query-optimization |

### webviewer-integration (5 failure modes)

| # | Mistake | Priority | Source | Cross-skill? |
| --- | --- | --- | --- | --- |
| 1 | Importing @proofkit/webviewer in server-side code | CRITICAL | source + docs | — |
| 2 | fmFetch promise never resolves | CRITICAL | docs | — |
| 3 | Calling FM scripts before window.FileMaker is available | HIGH | docs | — |
| 4 | Using executeScript or containerUpload via WebViewerAdapter | HIGH | source | fmdapi-client |
| 5 | Accessing window.FileMaker directly instead of library functions | CRITICAL | maintainer | — |
| 6 | Not understanding single-threaded script execution in WebViewer local mode | HIGH | maintainer | fmodata-client |

### better-auth-setup (4 failure modes)

| # | Mistake | Priority | Source | Cross-skill? |
| --- | --- | --- | --- | --- |
| 1 | Using better-auth CLI directly instead of @proofkit/better-auth | CRITICAL | docs | — |
| 2 | Missing Full Access credentials for schema migration | HIGH | source + docs | — |
| 3 | Removing fields added by migration | HIGH | docs | — |
| 4 | Forgetting to re-run migration after adding plugins | HIGH | docs | — |

### getting-started (3 failure modes)

| # | Mistake | Priority | Source | Cross-skill? |
| --- | --- | --- | --- | --- |
| 1 | Missing fmrest or fmodata privilege on FM account | CRITICAL | docs | fmdapi-client, fmodata-client |
| 2 | FM_SERVER without https:// prefix | HIGH | docs | fmdapi-client, fmodata-client |
| 3 | Using npm instead of pnpm for create-proofkit | MEDIUM | GitHub #37 | — |

### odata-query-optimization (6 failure modes)

| # | Mistake | Priority | Source | Cross-skill? |
| --- | --- | --- | --- | --- |
| 1 | Not understanding default 1000 record limit | HIGH | source | fmodata-client |
| 2 | includeSpecialColumns with explicit select() | MEDIUM | docs | — |
| 3 | Entity IDs on tables without configured IDs | MEDIUM | source | — |
| 4 | Filtering on null fields causes severe performance degradation | HIGH | maintainer | fmodata-client |
| 5 | Overwhelming OData service during testing | HIGH | maintainer | — |
| 6 | Not testing relationship query performance | MEDIUM | maintainer | fmodata-client |

## Tensions

| Tension | Skills | Agent implication |
| --- | --- | --- |
| Type safety vs rapid prototyping | typegen-setup ↔ fmdapi-client ↔ fmodata-client | Agent might skip typegen to move fast, losing validation and creating schema drift |
| defaultSelect schema safety vs completeness | fmodata-client ↔ odata-query-optimization | Agent switches to "all" to fix missing data without understanding performance cost |
| WebViewer local mode vs server-based data access | webviewer-integration ↔ fmdapi-client ↔ fmodata-client | Agent uses listAll or TanStack Query retries in WebViewer local mode, overwhelming single-threaded FM script engine |

## Cross-References

| From | To | Reason |
| --- | --- | --- |
| typegen-setup | fmdapi-client | Typegen generates the layout clients used by fmdapi |
| typegen-setup | fmodata-client | Typegen generates fmTableOccurrence schemas for fmodata |
| fmodata-client | odata-query-optimization | Understanding optimization prevents performance issues |
| better-auth-setup | fmodata-client | Better Auth uses fmodata under the hood |
| webviewer-integration | fmdapi-client | WebViewerAdapter implements the fmdapi Adapter interface |
| getting-started | typegen-setup | Getting started always involves typegen first |
| fmdapi-client | fmodata-client | Understanding both helps developers choose the right API surface |

## Subsystems & Reference Candidates

| Skill | Subsystems | Reference candidates |
| --- | --- | --- |
| fmdapi-client | OttoAdapter, FetchAdapter | — |
| fmodata-client | — | Filter operators (>15), Error types (>10) |
| typegen-setup | — | — |
| webviewer-integration | — | — |
| better-auth-setup | — | — |
| getting-started | — | — |
| odata-query-optimization | — | — |

## Remaining Gaps

| Skill | Question | Status |
| --- | --- | --- |
| getting-started | Recommended path for new-to-JS developers vs experienced developers? | open |
| webviewer-integration | Most common deployment pitfalls for WebViewer apps? | open |

## Recommended Skill File Structure

- **Core skills:** typegen-setup, fmdapi-client, fmodata-client, webviewer-integration, better-auth-setup, odata-query-optimization
- **Lifecycle skills:** getting-started
- **Framework skills:** none (library is framework-agnostic)
- **Composition skills:** none identified
- **Reference files:** fmodata-client needs references/ for filter operators and error types

## Composition Opportunities

| Library | Integration points | Composition skill needed? |
| --- | --- | --- |
| Zod | Standard Schema validation in fmdapi + fmodata | No — covered within each skill |
| Better Auth | Uses fmodata as database backend | No — better-auth-setup skill covers this |
| Next.js | CLI generates Next.js projects | No — framework-agnostic patterns apply |
| OttoFMS | Proxy for both Data API and OData | No — covered within adapter documentation |
