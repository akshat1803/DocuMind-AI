# DocuMind development and checks

## Prerequisites

- Node **24.18.0**, pinned in `.node-version`, package engines, CI and Node images.
- npm with workspace support and Docker Engine/Desktop with Compose v2 for local databases/containers.
- Gemini and Cloudinary credentials only for actual PDF ingestion and AI answers. Automated unit and database integration tests do not need them.

Use the existing `.env` if present; otherwise copy `.env.example`. Never commit credentials. The containers exclude all `.env` files from their build contexts.

## Native development with a local database

```bash
npm ci
docker compose up -d --wait postgres
```

Set these values in your local `.env` to use the new local database instead of a hosted database:

```dotenv
DATABASE_URL=postgresql://documind:documind_dev@127.0.0.1:5432/documind_dev
DIRECT_URL=postgresql://documind:documind_dev@127.0.0.1:5432/documind_dev
WEB_ORIGIN=http://localhost:5173
VITE_API_URL=
```

Then apply the committed migrations and build shared contracts:

```bash
npm run prisma:generate
npx prisma migrate deploy
npm run build --workspace=@documind/shared
```

Use `npm run prisma:migrate` when creating a new development migration after a schema change. Start each process in a separate terminal:

```bash
npm run dev --workspace=@documind/shared
npm run dev --workspace=@documind/api
npm run dev --workspace=@documind/web
```

Open `http://localhost:5173`. Vite forwards `/api` to the API on port 4000. Development data persists in the Compose `postgres-data` volume; stopping containers does not delete it.

## Full local container stack

```bash
docker compose --profile app up --build --wait web
```

Open `http://localhost:8080`. Compose starts pgvector, applies committed migrations through a one-shot migration container, starts the API when migration succeeds, and serves the SPA through nginx. Browser requests use same-origin `/api`; nginx disables response buffering for SSE and provides SPA route fallback. The API/database are addressed by Compose service names internally.

Compose intentionally uses development cookie behavior for local HTTP and fixed development database credentials. These are not production deployment settings. API/worker production hardening remains a later phase. Configure Gemini/Cloudinary values in the root `.env` before testing real uploads/chat; placeholders support startup and health checks only. The proxy currently accepts request bodies up to 21 MB for the default 20 MB file cap plus multipart overhead.

To stop the app while preserving development data:

```bash
docker compose --profile app down
```

Production API images run as the `node` user and use compiled output with production dependencies. The migration target retains Prisma CLI tooling. Production TLS, secrets, origins/cookies, migration release orchestration and rollback must be configured before deployment.

## Quality checks

```bash
npm run prisma:generate
npm run check
```

`check` runs ESLint over scripts/configuration and all maintained workspaces, then type checking, tooling/unit tests, production builds and Prisma validation. Warnings fail lint; generated Prisma files, dependencies, builds and coverage are excluded. Unit tests force dummy service configuration and do not fall back to a developer's live database credentials.

Focused commands: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:tooling`, `npm run build`, and `npm run prisma:validate`.

## Real database integration tests

Start the dedicated disposable pgvector service (port 5433, separate from development):

```bash
docker compose --profile test up -d --wait postgres-test
```

PowerShell:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://documind:documind_test@127.0.0.1:5433/documind_test'
npm run test:integration
```

Bash:

```bash
TEST_DATABASE_URL=postgresql://documind:documind_test@127.0.0.1:5433/documind_test npm run test:integration
```

Generate Prisma first if this is a clean checkout. The runner refuses missing, non-loopback, non-`documind_test`, or query-bearing connection URLs. It never reads `.env` or falls back to `DATABASE_URL`/`DIRECT_URL` to select the test server. The dedicated test role needs permission to create/drop databases and install pgvector.

Each run creates `documind_test_<random-id>`, applies committed Prisma migrations, runs six integration cases with synthetic fixtures and mocked AI/storage, and drops only that generated database in a `finally` block. A forcibly killed runner can leave a temporary database; the test server uses disposable tmpfs storage, so stopping/recreating that service clears it. The persistent development database is separate.

Coverage: extension/HNSW migration, cosine ranking/page metadata, owner/ready/selection filters, unique chunk constraints, real readiness/document API queries, and deletion cascades. These tests do not exercise live Gemini/Cloudinary or browser interactions.

Stop the test service:

```bash
docker compose --profile test stop postgres-test
```

## CI and dependency reports

CI has independent jobs for local checks, migrated pgvector integration tests, and container build/startup plus SPA/API-proxy smoke checks. All jobs use synthetic configuration. Container volumes are removed only on the ephemeral CI runner.

The dependency workflow uploads a production `npm audit` JSON report on dependency pull requests and weekly. It is informational while existing advisories are triaged; it is not a clean security bill or a blocking security gate. Dependabot proposes npm, GitHub Actions and Docker updates for review.

Configuration references: [typescript-eslint](https://typescript-eslint.io/getting-started/), [pgvector](https://github.com/pgvector/pgvector), [Compose startup conditions](https://docs.docker.com/compose/how-tos/startup-order/).
