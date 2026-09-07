# DocuMind AI — Implementation Plan

Prepared: 7 September 2026. 

## Objective and baseline

Complete the release requirements in [PROJECT.md](PROJECT.md) by extending the existing React/Vite, Express, Prisma/PostgreSQL/pgvector and Cloudinary application. Authentication, uploads, basic ingestion, retrieval, streaming chat, history and Markdown/chart rendering already exist.

The supplied guide is the starting reference. The working tree also contains the newly applied CI workflow, Multer 2.x upgrade and `npm run check`; do not reimplement them. The last local check passed 27 tests, type checking, builds and Prisma validation. Hosted CI and live-provider behavior remain unverified.

Implementation has started with Phase 1. The remaining phases are proposed work; new infrastructure and schema fields there become available only when implemented. No production deployment has occurred.

## Phase 1 — Effective checks and reproducible development

**Priority:** P0. **Dependencies:** none.

**Status:** Implementation added: real lint, Node pin, container/Compose setup, isolated database runner and six integration cases, CI database/container jobs, dependency reports and updated skill/development guidance. Local lint, types, 27 existing tests, three runner safety tests, builds and Prisma validation pass. Docker/PostgreSQL are unavailable locally, so integration/container execution and hosted CI remain pending; the phase's runtime acceptance is not yet complete.

Work:

- Configure ESLint for maintained TypeScript/React code and add workspace lint scripts, excluding generated/build output. Resolve violations and retain `npm run check` as the entry point.
- Pin a consistent Prisma-compatible runtime across local instructions, CI and images; preserve locked installs.
- Add API/web Dockerfiles, `.dockerignore`, and a Compose database with pgvector. Configure SPA route fallback and the production web API origin/proxy.
- Add isolated database integration setup that applies committed migrations and synthetic fixtures. Mock Gemini/Cloudinary by default; tear down only the test database.
- Extend CI with PostgreSQL/pgvector integration checks and deliberate dependency review/scanning.
- Align `SKILL.md` with current paths, TypeScript/Prisma and actual commands. Synchronize `PROJECT_GUIDE.md` with the CI baseline during this phase.

Files: root/workspace `package.json`, new ESLint/container files, `.github/workflows/ci.yml`, `apps/api/src/test/`, `.env.example`, skills and developer documentation.

Done when:

- A fresh checkout reaches a migrated local database and running web/API through documented steps.
- A deliberate lint violation fails `npm run check`.
- Tests insert/query vectors against PostgreSQL/pgvector without paid-provider credentials.
- CI needs no stale generated/build output.

## Phase 2 — Production configuration and access boundaries

**Priority:** P0. **Dependencies:** Phase 1 test database.

Work:

- Reject missing/default production signing secrets and incomplete production Cloudinary configuration. Validate numeric limits/origins while supporting dummy unit-test configuration.
- Document browser/API origin topology and enforce an Origin/CSRF policy on cookie-authenticated refresh/logout. Verify production cookies in that topology.
- Test refresh rotation, replay, expiry, logout and concurrent refresh attempts against the database.
- Validate path/query identifiers before database calls. Map malformed JSON and multipart field/count/type/size failures to stable 4xx errors.
- Test two-user isolation for read/delete/retry/source/conversation/message access and selected-document filters.
- Introduce separate auth/upload/chat limits where needed and a shared rate-limit store when multiple API instances are used.

Files: `apps/api/src/config/env.ts`, `app.ts`, `middleware/`, auth/document/chat controllers, `packages/shared/src/index.ts`, API integration tests and `.env.example`.

Done when:

- Unsafe production configuration fails startup without secret disclosure.
- Foreign IDs and unauthorized cookie origins cannot access or mutate other users' sessions/data.
- At most one concurrent rotation of the same refresh token succeeds.
- Malformed identifiers and upload requests return controlled client errors.

## Phase 3 — Durable ingestion and document lifecycle

**Priority:** P0; largest reliability gap. **Dependencies:** Phases 1–2.

Proposed approach: BullMQ/Redis and a separate worker, reusing ingestion/storage interfaces. This is a planned dependency, not installed infrastructure. Resolve exact versions and library APIs during implementation.

Work:

- Persist dispatch intent with the document using a PostgreSQL outbox or equivalent recovery mechanism, preventing lost work between persistence and queue publication.
- Queue document/job IDs; workers download the private original. Do not queue PDF buffers or signed URLs.
- Add attempts, lease/heartbeat and job-generation metadata through a new migration. Fence stale workers so expired attempts cannot overwrite newer results.
- Claim atomically, retry transient failures with bounded backoff, and commit chunks idempotently. Bound concurrency, processing time, pages/chunks and memory.
- Recover abandoned `PENDING`/`PROCESSING` work and expose safe terminal errors and retries.
- Enforce document-count and byte quotas under concurrent uploads, including reservations and release after failures.
- Handle deletion of queued/active work with recoverable cleanup intent. Reconcile Cloudinary/database failures and prevent workers from recreating deleted content.
- Add worker startup/shutdown, queue monitoring and Compose configuration. Preserve upload response compatibility.

Files: document controller/storage service, ingestion service, proposed `apps/api/src/workers/` and queue modules, `prisma/schema.prisma`, new migrations, API scripts, Compose and integration tests.

Done when:

- An API restart between document persistence and publication does not lose accepted work.
- Killing a worker during embedding eventually yields `READY` or an explicit terminal `FAILED` result after recovery.
- Duplicate jobs yield one consistent chunk set; stale workers cannot commit over newer attempts.
- Deletion during processing cannot recreate files/chunks; failed cleanup is retried.
- Concurrent uploads respect quotas and failed reservations are released.

## Phase 4 — Citation provenance and dependable chat

**Priority:** P1. **Dependencies:** Phase 2; coordinate deletion with Phase 3.

Work:

- Return authorized document ID/name and page range with citations; update API joins, web types and source links together.
- Define deleted-source behavior: remove source-derived excerpts and retain only minimal marker/tombstone metadata needed for “source deleted.” Decide whether filenames remain and document that privacy choice before the migration.
- Add bounded history or standalone-question rewriting for follow-ups. Prior messages are untrusted context; retrieve fresh evidence and preserve the original question.
- Add an overall generation deadline and cancellation through retrieval/generation where supported. Define partial-answer persistence and recover stale `STREAMING` records after restart.
- Prevent duplicate submissions/conflicting generations through request identifiers or equivalent guards. Avoid transparent retries after output has already streamed.
- Expose the rename endpoint in services/UI. Preserve drafts, selected-document history, Markdown/chart validation and route-change cancellation.

Files: chat/prompt/retrieval/AI modules, shared contracts, Prisma migrations if needed, `apps/web/src/types/api.ts`, `services/conversations.service.ts`, chat components.

Done when:

- Citations open the correct owned document/page and remain understandable after source deletion.
- Follow-ups resolve references without importing another conversation's context.
- Low-relevance/no-result questions retain the insufficient-information fallback.
- Stop, disconnect, duplicate submission and restart produce documented terminal states without duplicate completed answers.
- Existing SSE consumers and saved Markdown/chart answers continue working.

## Phase 5 — Usage and operational visibility

**Priority:** P1. **Dependencies:** Phases 2–4 contracts.

Work:

- Add request IDs and structured logs that redact cookies, authorization, signed URLs, prompts and document text.
- Extend the AI stream contract with provider usage/model metadata; populate token fields and add model/status metadata where necessary.
- Record ingestion stages, attempts, queue age, retrieval latency and chat outcomes. Keep word-based chunk estimates separate from provider tokens.
- Estimate cost only from recorded usage and versioned pricing configuration; unavailable usage remains unknown.
- Add readiness for required runtime dependencies, including an active queue. Do not perform paid generation on every probe.
- Add alerts/runbooks for stuck jobs, storage/generation failures and unavailable dependencies. Build dashboards later from reliable collected data.

Files: API middleware/app/server, AI/chat/ingestion modules, proposed logging/usage helpers, Prisma migrations if needed, operational documentation.

Done when:

- Requests can be traced through dispatch/worker/provider outcomes without sensitive log content.
- Reported usage is persisted; missing usage is not reported as zero cost.
- Queue/database outages produce correct readiness and actionable signals.

## Phase 6 — Browser coverage and measured RAG quality

**Priority:** P1 release gate. **Dependencies:** Phases 3–5; fixtures can begin in Phase 1.

Work:

- Add Playwright coverage with deterministic providers, a real test database and storage substitutes for login, upload, processing, cited answer, reload/history, rename and deletion.
- Include two-user isolation, keyboard/mobile navigation, failure/cancellation and expired-session flows.
- Create a versioned evaluation set, initially around 30–50 questions over synthetic/redistributable PDFs, with expected pages and unanswerable, follow-up, comparison and prompt-injection cases.
- Measure retrieval hit rate at k, citation support, refusal correctness, relevance and latency. Establish a baseline before setting thresholds; do not invent scores.
- Inspect vector query plans against the HNSW index. Tune chunking, k, context budget and similarity threshold one change at a time using a held-out subset.
- Add opt-in staging tests for actual Gemini/Cloudinary with capped requests, synthetic data and cleanup. Never expose provider secrets to untrusted fork PR jobs.
- Investigate the bundle warning and improve loading where measurements justify changes.

Files: proposed `tests/e2e/`, evaluation fixtures/scripts, Playwright configuration, API integration suites, retrieval/chunking configuration, web entry points and CI.

Done when:

- Deterministic browser journeys and two-user isolation pass in CI.
- An evaluation report records dataset/model/configuration, baseline results and measured changes.
- Live-provider smoke tests pass in an isolated environment with limits and cleanup.
- Core keyboard/mobile and citation/chart rendering checks pass.

## Phase 7 — Staging, release and portfolio delivery

**Priority:** P1 release gate. **Dependencies:** Phases 1–6.

Work:

- Select hosting compatible with a long-running API/worker, SSE, Redis, private storage and PostgreSQL/pgvector. Verify provider limits/cost at selection time.
- Build immutable artifacts; configure secrets, TLS, origins, cookies and proxy buffering/timeouts for SSE.
- Apply reviewed migrations once per release with `prisma migrate deploy`, not independently in every replica.
- Define backups/recovery and prefer backward-compatible migrations. Separate application rollback from data restoration.
- Deploy staging and verify health, synthetic PDF-to-answer flow, worker recovery and deletion before release.
- Publish a README with setup/tests, architecture, screenshots, demo link, evaluation results and limitations.

Done when:

- Staging passes the `PROJECT.md` release checklist through the actual deployment proxy.
- Migration/rollback procedures are rehearsed and monitoring detects worker/dependency failures.
- The public demo works and portfolio claims are supported by evidence.

## Execution order and scope

Next, run Phase 1 database/container acceptance on Docker-capable infrastructure or CI, then begin Phase 2 production configuration/access tests. Durable ingestion remains the next major feature after those checks.

Implement phases as reviewable configuration, behavior and documentation changes. Add migrations rather than rewriting applied history. Regenerate Prisma after schema changes and verify both fresh setup and upgrades against isolated databases.

OCR, extra file formats, hybrid search/reranking, dashboards, sharing, teams and alternate providers remain after the reliable core release. Plan them separately once evaluation and operational data establish their value.

The plan is dependency-ordered rather than a promised schedule. Re-estimate after Phase 1 exposes integration and hosting constraints.
