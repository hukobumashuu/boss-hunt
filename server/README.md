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

All `/api/*` routes require a bearer token. `GET /health` is public for Render health checks. The API trusts one proxy hop, which is required for correct per-client rate limiting behind Render.

## Deployment

`render.yaml` targets Render's free web-service plan. Its build command runs `bun install --frozen-lockfile` followed by `bun run db:migrate`; migration failures cancel the deployment. Seed bosses and generate tokens manually once after the Neon database is available.
