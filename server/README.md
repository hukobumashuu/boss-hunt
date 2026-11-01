# Boss Tracker API

Express API backed by PostgreSQL and Drizzle, running on Bun.

## Commands

| Command                           | Purpose                                                               |
| --------------------------------- | --------------------------------------------------------------------- |
| `bun run dev`                     | Start the API with file watching                                      |
| `bun run typecheck`               | Type-check source files                                               |
| `bun run lint`                    | Lint source files                                                     |
| `bun run format:check`            | Check formatting                                                      |
| `bun test`                        | Run unit tests and, when `DATABASE_URL` is set, API integration tests |
| `bun run db:test:create`          | Create the `boss_tracker_test` database in Docker                     |
| `bun run db:test:migrate`         | Apply migrations to the test database from `.env.test`                |
| `bun run db:migrate`              | Apply pending migrations                                              |
| `bun run db:seed`                 | Add missing static bosses                                             |
| `bun run db:generate-tokens`      | Create missing logger tokens                                          |
| `bun run db:rotate-token "Guest"` | Replace one logger's token                                            |

## Environment

| Variable         | Purpose                                |
| ---------------- | -------------------------------------- |
| `DATABASE_URL`   | PostgreSQL connection string           |
| `ALLOWED_ORIGIN` | Browser origin permitted by CORS       |
| `PORT`           | API port, default `4100`               |
| `NODE_ENV`       | `development`, `test`, or `production` |

`bun test` aborts if `DATABASE_URL` points at a database whose name does not contain `test`, because the integration tests delete all rows. Copy `.env.test.example` to `.env.test` to run them locally.

All `/api/*` routes require a bearer token. `GET /health` is public for Render health checks. The API trusts one proxy hop, which is required for correct per-client rate limiting behind Render.

### Diagnosing a hang

`GET /health` never touches the database; `GET /health/db` runs `select 1` and reports `dbLatencyMs`. When the app stops responding, open both: if `/health` answers but `/health/db` fails or stalls, the database path is stuck; if both stall, the process or the platform is. `/health/db` is public but rate limited (it can wake the database), so do not point an uptime monitor at it.

Every request is cut off with a `503` after 10 seconds. The log only records problems: requests slower than 2 seconds, `5xx` responses, requests the client abandoned (`aborted by client`), and `[timeout]` lines.

### Logging a kill

`POST /api/kills` takes `bossId` and `channel`, plus optional fields:

- `force` skips the duplicate warning.
- `killedAgoMs` (0 to 30 minutes) is how long ago the user actually tapped. The server stores `killedAt = now - killedAgoMs`, so a delayed confirmation or retry still records the real kill time. The undo window runs from `createdAt` (when the server received the log), not from `killedAt`.
- `requestId` (UUID) is an idempotency key, scoped to the logger. Repeating a request with the same key returns the original kill instead of logging a second one.

## Deployment

`render.yaml` targets Render's free web-service plan. Its build command runs `bun install --frozen-lockfile` followed by `bun run db:migrate`; migration failures cancel the deployment. Seed bosses and generate tokens manually once after the Neon database is available.
