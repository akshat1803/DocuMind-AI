---
name: frontend-scaffold
description: Extend DocuMind AI frontend features, Express API modules, shared contracts, and repository checks using this monorepo's conventions. Use for implementation work in this repository.
---

# DocuMind implementation

Read the relevant current feature before editing. [PROJECT.md](PROJECT.md) records product requirements; [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) orders remaining work; [DEVELOPMENT.md](DEVELOPMENT.md) contains executable setup and verification commands.

## Structure

- Web: React/Vite/TypeScript in `apps/web/src/features/`, API calls in `services/`, authentication in `context/AuthContext.tsx`, routes in `App.tsx`. Use existing `@/` imports and feature naming. Reuse Tailwind utilities and existing class helpers; preserve the current UI system.
- API: Express 4/TypeScript ES modules in `apps/api/src/modules/<feature>/`. Relative server imports use `.js` extensions. Route mounting and errors live in `app.ts`; process lifecycle lives in `server.ts`.
- Contracts: reuse Zod schemas/types in `packages/shared`; inspect consumers before changing an API envelope or SSE event.
- Persistence: Prisma/PostgreSQL/pgvector, with authenticated Cloudinary PDF storage. Add migrations instead of rewriting applied history. Regenerate `apps/api/src/generated/prisma/`; never hand-edit generated code.

## Feature invariants

- Derive ownership from authenticated `req.userId` and constrain database/vector queries by owner and selected documents. The browser route guard is not authorization.
- Access JWTs stay in browser memory. Refresh credentials are opaque random values, hashed at rest and rotated; they are not JWTs.
- Express 4 does not forward rejected async handlers automatically. Use the existing forwarding wrapper or controlled try/catch paths and preserve `{ error: { code, message } }` errors.
- Keep Gemini/storage secrets in the API. Preserve embedding-provider interfaces, 768-dimensional vector compatibility, page metadata, and untrusted-source handling.
- Ingestion currently runs inside the API; durable workers remain planned until implemented. Preserve explicit processing states and report runtime verification limits.
- Preserve `chunk`, `done`, and `error` SSE events, ownership checks on source URLs, and schema validation of chart JSON.

## Verification

- Use Node from `.node-version`, `npm ci`, then `npm run prisma:generate` on a clean checkout.
- `npm run check` runs real lint, type checking, tooling/unit tests, builds, and Prisma validation. Generated output is excluded from lint.
- Database changes require `npm run test:integration` against the dedicated local `TEST_DATABASE_URL` described in DEVELOPMENT.md. The runner creates a unique temporary database, applies migrations and cleans up that database. Never substitute a live `DATABASE_URL`.
- Docker/CI and integration checks need their actual runtime. Report checks not run instead of treating static configuration as runtime validation.
- Scope verification to the changed behavior and update affected documentation. Preserve unrelated working-tree changes.
