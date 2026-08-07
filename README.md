# Shiori API

**Shiori (栞)** — Japanese for "bookmark" — is an open-source Retrieval-Augmented
Generation (RAG) platform. This repository, `shiori-api`, is its backend
service.

The project is bootstrapped from
[`sisques-labs/nestjs-template`](https://github.com/sisques-labs/nestjs-template):
**DDD + CQRS + Hexagonal** architecture, TypeORM/PostgreSQL, optional Kafka
event forwarding, REST (Swagger) + GraphQL (Apollo) transports, structured
logging (`@sisques-labs/nestjs-kit` + Winston), Sentry, Prometheus metrics,
an MCP endpoint, health checks, and production-ready CI/CD workflows.

The first bounded context, **`knowledge-bases`** (`src/contexts/knowledge-bases/`),
has landed: it's the tenant root every future RAG context scopes its data
to, authenticated by a per-knowledge-base API key. See its
[README](src/contexts/knowledge-bases/README.md) for the auth flow and the
reusable tenancy mechanism (`src/core/tenancy/`) it introduces. See the
`architecture` skill in `.claude/skills/architecture/SKILL.md` for the layer
rules every context — including this one — must follow.

## What's included

| Area | Where | Notes |
|------|-------|-------|
| Config + env validation | `src/core/config/` | Zod-validated env vars, CORS origin resolution |
| Health checks | `src/core/health/` | `GET /api/health/live` (liveness), `GET /api/health/ready` (DB ping via `@nestjs/terminus`) |
| Logging | `src/support/logging/` | Winston via `@sisques-labs/nestjs-kit`, JSON file + console transports |
| Kafka event forwarding | `@sisques-labs/nestjs-kit/messaging` (wired in `src/core/core.module.ts`); `src/core/messaging/` keeps only the app-local, auto-generated aggregate→topic map | Opt-in (`KAFKA_ENABLED`), no-op when disabled |
| Prometheus metrics | `@sisques-labs/nestjs-kit/metrics` (wired in `src/core/core.module.ts`) | `GET /api/metrics`, HTTP (REST+GraphQL) + CQRS instrumentation |
| Sentry | `src/core/observability/` | Disabled until `SENTRY_DSN` is set |
| MCP (Model Context Protocol) | `@sisques-labs/nestjs-kit/mcp` (wired in `src/core/core.module.ts`) | `POST /api/mcp`, per-request server, tool auto-discovery |
| REST + GraphQL | `src/main.ts`, `src/core/core.module.ts` | Swagger at `/docs`, Apollo GraphQL at `/graphql` |
| Database | `src/database/`, TypeORM | Postgres only; migrations in `src/database/migrations/` |
| CI/CD | `.github/workflows/` | `ci.yml` (lint+test+build+e2e+integration), `docker.yml` (PR smoke build), `release.yml` / `release-train.yml` |
| Dev workflow | `AGENTS.md`, `.claude/`, `openspec/` | Architecture skill, OpenSpec propose/apply/archive skills, project conventions in `openspec/config.yaml` |

## Roadmap

`knowledge-bases` (tenancy) is done. Next up: `documents` (ingestion,
chunking) and `retrieval` (embeddings, vector search via pgvector) — tracked
as they're proposed under `openspec/`.

## Local development

```bash
pnpm install
pnpm test:db:up      # Postgres on localhost:5434 (dev) — see docker-compose.yml
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

See `.env.example` for every environment variable this service reads.

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
