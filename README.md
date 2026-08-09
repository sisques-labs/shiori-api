# Shiori API

**Shiori (栞)** — Japanese for "bookmark" — is an open-source Retrieval-Augmented
Generation (RAG) platform. This repository, `shiori-api`, is its backend
service.

The project is bootstrapped from
[`sisques-labs/nestjs-template`](https://github.com/sisques-labs/nestjs-template):
**DDD + CQRS + Hexagonal** architecture, TypeORM/PostgreSQL, optional Kafka
event forwarding, REST (Swagger) + GraphQL (Apollo) transports, structured
logging (`@sisques-labs/nestjs-kit` + Winston), OpenTelemetry traces + metrics,
an MCP endpoint, health checks, and production-ready CI/CD workflows.

The full RAG pipeline — **ingest → chunk → embed → retrieve** — is
implemented end to end across four bounded contexts under
`src/contexts/`:

| Context | README | Owns |
|---------|--------|------|
| [`knowledge-bases`](src/contexts/knowledge-bases/README.md) | tenant root: create/manage a Knowledge Base, its API key, and its embedding model config |
| [`documents`](src/contexts/documents/README.md) | ingest text/Markdown documents, async chunking pipeline |
| [`embeddings`](src/contexts/embeddings/README.md) | embedding model registry, vector generation/storage (pgvector), similarity search, re-embedding |
| [`retrieval`](src/contexts/retrieval/README.md) | tenant-scoped semantic search — query orchestration + transport over `embeddings` |

`knowledge-bases` is the tenant root every other context scopes its data to
via a per-Knowledge-Base API key; see its README for the auth flow and the
reusable tenancy mechanism (`src/core/tenancy/`) it introduces. See the
`architecture` skill in `.claude/skills/architecture/SKILL.md` for the layer
rules every context must follow.

## What's included

| Area | Where | Notes |
|------|-------|-------|
| Config + env validation | `src/core/config/` | Zod-validated env vars, CORS origin resolution |
| Health checks | `src/core/health/` | `GET /api/health/live` (liveness), `GET /api/health/ready` (DB ping via `@nestjs/terminus`) |
| Logging | `src/support/logging/` | Winston via `@sisques-labs/nestjs-kit`, JSON file + console transports |
| Kafka event forwarding | `@sisques-labs/nestjs-kit/messaging` (wired in `src/core/core.module.ts`); `src/core/messaging/` keeps only the app-local, auto-generated aggregate→topic map | Opt-in (`KAFKA_ENABLED`), no-op when disabled |
| Async job queues | `src/core/` + BullMQ/Redis | Backs `documents`' chunking pipeline and `embeddings`' embed/re-embed pipelines |
| OpenTelemetry | `src/telemetry.ts` (bootstrap), `src/core/observability/` (CQRS spans+metrics) | Traces + metrics exported via OTLP to a collector; disabled until `OTEL_EXPORTER_OTLP_ENDPOINT` is set. Auto-instruments HTTP/Express, GraphQL, Postgres, Kafka; CQRS command/query buses get spans + duration/count metrics. `docker-compose.yml` ships a local collector + Jaeger UI (`:16686`) + Prometheus UI (`:9090`) |
| MCP (Model Context Protocol) | `@sisques-labs/nestjs-kit/mcp` (wired in `src/core/core.module.ts`) | `POST /api/mcp`, per-request server, tool auto-discovery |
| REST + GraphQL | `src/main.ts`, `src/core/core.module.ts` | Swagger at `/docs`, Apollo GraphQL at `/graphql` |
| Database | `src/database/`, TypeORM, pgvector | Postgres + pgvector (`pgvector/pgvector:pg18`); migrations in `src/database/migrations/` |
| CI/CD | `.github/workflows/` | `ci.yml` (lint+test+build+e2e+integration), `docker.yml` (PR smoke build), `release.yml` / `release-train.yml` |
| Dev workflow | `AGENTS.md`, `.claude/`, `openspec/` | Architecture skill, OpenSpec propose/apply/archive skills, project conventions in `openspec/config.yaml` |

## Local development

```bash
pnpm install
pnpm test:db:up      # Postgres (pgvector) on localhost:5434 (dev) — see docker-compose.yml
pnpm dev              # nest start --watch
```

| Script | Description |
|--------|-------------|
| `pnpm dev` / `pnpm debug` / `pnpm prod` | Run the app (watch / debug / prod) |
| `pnpm lint` | ESLint with `--fix` |
| `pnpm test` / `pnpm test:cov` | Unit tests (Jest, co-located `*.spec.ts`) |
| `pnpm test:e2e` | E2E tests against a real Postgres (`docker-compose.test.yml`) |
| `pnpm test:integration` | Integration tests (persistence boundaries) |
| `pnpm migration:generate` / `:run` / `:revert` | TypeORM migrations |
| `pnpm gen:topics` / `:check` | Regenerate/verify the Kafka aggregate→module map |

Husky runs `pnpm gen:topics` + `lint-staged` on **pre-commit**, and
`pnpm build && pnpm test:changed` on **pre-push**.

See `.env.example` for every environment variable this service reads —
including the `documents`/`embeddings`/`retrieval` guardrail vars (max
content length, max chunks, embeddings endpoint, `topK` defaults) documented
in each context's own README.

## Quickstart

Every request below (other than creating the Knowledge Base) is
authenticated with the `x-api-key` header returned by the first call. See
Swagger at `/docs` for the full request/response shapes.

```bash
BASE_URL=http://localhost:3000/api/v1

# 1. Create a Knowledge Base (tenant) — no auth required, returns the API key once
curl -s -X POST "$BASE_URL/knowledge-bases" \
  -H 'Content-Type: application/json' \
  -d '{"name": "My Docs", "embeddingModel": "text-embedding-3-small"}'
# => { "id": "...", "name": "My Docs", "apiKey": "sk_...", ... }

API_KEY=sk_...   # from the response above

# 2. Ingest a document — queues async chunking + embedding
curl -s -X POST "$BASE_URL/documents" \
  -H "x-api-key: $API_KEY" -H 'Content-Type: application/json' \
  -d '{"title": "Getting started", "content": "Shiori is a RAG platform..."}'
# => 202 Accepted { "id": "...", "status": "PENDING" }

# 3. Semantic search once chunking/embedding finish
curl -s -X POST "$BASE_URL/retrieval/search" \
  -H "x-api-key: $API_KEY" -H 'Content-Type: application/json' \
  -d '{"query": "what is Shiori?", "topK": 5}'
# => [ { "chunkText": "...", "score": 0.87, ... }, ... ]
```

Ingestion is asynchronous: poll `GET /documents/:id` (or the `document`
GraphQL query) until `status` is `CHUNKED` before expecting search results
for that document.

## Architecture

DDD + CQRS + Hexagonal (Screaming Architecture). Full rules, file naming, and
the mandatory find-by-criteria filter pattern live in
`.claude/skills/architecture/SKILL.md`; project-wide conventions (tech stack,
testing layers, apply-time rules) live in `openspec/config.yaml`.

## Contributing

Shiori is early-stage and the domain model is still taking shape — issues and
discussions are welcome. Please read `AGENTS.md` and
`.claude/skills/architecture/SKILL.md` before opening a PR that adds a
bounded context.

## License

[MIT](LICENSE)
