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

| Variable          | Purpose                                                                     |
| ----------------- | --------------------------------------------------------------------------- |
| `DATABASE_URL`    | PostgreSQL connection string                                                |
| `ALLOWED_ORIGIN`  | Browser origin permitted by CORS                                            |
| `PORT`            | API port, default `4100`                                                    |
| `NODE_ENV`        | `development`, `test`, or `production`                                      |
| `ALLOW_REMOTE_DB` | `true` lets a non-production server use a remote database (default `false`) |

`ALLOWED_ORIGIN` is normalized when the server starts: a trailing slash is removed, and anything that is not a plain `http(s)` origin (a path, query or credentials) is rejected with a clear message. The startup log prints the CORS origin and database in use.

`bun test` aborts if `DATABASE_URL` points at a database whose name does not contain `test`, because the integration tests delete all rows. Copy `.env.test.example` to `.env.test` to run them locally.

All `/api/*` routes require a bearer token. `GET /health` is public for Render health checks. The API trusts one proxy hop, which is required for correct per-client rate limiting behind Render.

### Dev and production database commands

Every database command prints its target (host and database name, never the password) before it does anything, and each one only runs against the kind of database its name promises:

- `db:*` commands are **local only**. They refuse any host other than `localhost`, `127.0.0.1` or `::1`.
- `db:prod:*` commands are **remote only**. They load `server/.env.neon` and nothing else, refuse a local database, and require you to type the database host before anything runs. A lazy `y` aborts.
- `db:migrate` also runs on Render: a deploy (`NODE_ENV=production` or `RENDER=true`) may migrate a remote database without a prompt. Never export `NODE_ENV=production` on your own machine. `seed` and the token commands do not have this exception.
- `bun run dev` refuses to start when `NODE_ENV` is not `production` and `DATABASE_URL` is remote, unless `ALLOW_REMOTE_DB=true`.

`server/.env.neon` (ignored by git) must define `DATABASE_URL` and `ALLOWED_ORIGIN`. Bun loads only that file for `db:prod:*` commands, so `.env.local` and `.env.development` cannot leak into them. Put production values only there, never in `.env.local` or `.env.development`, which Bun loads automatically for every other command.

Migrations run inside the same process as the guard (`src/db/migrate.ts`, using Drizzle's own migrator and the same `drizzle.__drizzle_migrations` history as `drizzle-kit`), so the database that was checked is the database that is migrated. Use `bun run db:generate` to create new migration files.

### Diagnosing a hang

`GET /health` never touches the database; `GET /health/db` runs `select 1` and reports `dbLatencyMs`. When the app stops responding, open both: if `/health` answers but `/health/db` fails or stalls, the database path is stuck; if both stall, the process or the platform is. `/health/db` is public but rate limited (it can wake the database), so do not point an uptime monitor at it.

Every request is cut off with a `503` after 10 seconds. The log only records problems: requests slower than 2 seconds, `5xx` responses, requests the client abandoned (`aborted by client`), and `[timeout]` lines.

### Logging a kill

`POST /api/kills` takes `bossId` and `channel`, plus optional fields:

- `force` skips the duplicate warning.
- `killedAgoMs` (0 to 30 minutes) is how long ago the user actually tapped. The server stores `killedAt = now - killedAgoMs`, so a delayed confirmation or retry still records the real kill time. The undo window runs from `createdAt` (when the server received the log), not from `killedAt`.
- `requestId` (UUID) is an idempotency key, scoped to the logger. Repeating a request with the same key returns the original kill instead of logging a second one.

## Deployment

`render.yaml` targets Render's free web-service plan. Its build command runs `bun install --frozen-lockfile` followed by `bun run db:migrate`; migration failures cancel the deployment. Seed bosses and generate tokens once after the Neon database is available, with `bun run db:prod:seed` and `bun run db:prod:generate-tokens`.
