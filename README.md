# Boss Respawn Tracker

A shared tracker for boss kills and respawn windows.

## Local setup

```bash
docker compose up -d
cd server
bun install
cp .env.example .env.development
bun run db:migrate
bun run db:seed
bun run db:generate-tokens
bun run dev
```

In another terminal:

```bash
cd client
bun install
cp .env.example .env.development
bun run dev
```

`.env.development` must point at your local database. The `db:*` commands refuse remote databases, and `bun run dev` refuses to start against one, so a stray production setting fails loudly instead of touching real data.

`db:seed` is idempotent. `db:generate-tokens` creates tokens for `p3anut`, `stasha`, `paupauu`, and `Guest`; rerunning it leaves existing logger tokens unchanged. Send bookmark links in the form `https://<frontend>/#token=<token>`. The fragment is not sent to the web server.

## Tests

Integration tests delete every row in the database they run against, so they refuse to start unless the database name contains `test`. They use a separate `boss_tracker_test` database:

```bash
cd server
bun run db:test:create
cp .env.test.example .env.test
bun run db:test:migrate
bun test
```

Without a `.env.test` file, `bun test` runs only the unit tests and skips the integration tests.

The client has unit tests for its networking, retry and caching logic:

```bash
cd client
bun test
```

## Deployment

1. Create a Neon database and set Render's `DATABASE_URL` to its direct connection URL.
2. Create the Render web service from `render.yaml`, then set `ALLOWED_ORIGIN` to the final frontend origin. The free-plan build command installs dependencies and applies pending migrations, `BUN_VERSION` in `render.yaml` pins the same Bun version CI uses, and `autoDeployTrigger: checksPass` makes Render deploy a commit only after its GitHub Actions checks pass.
3. Create `server/.env.neon` (git-ignored) with `DATABASE_URL` set to the Neon direct connection URL and `ALLOWED_ORIGIN` set to the frontend origin. Use this file only for production: never put production values in `.env.local` or `.env.development`, which Bun loads automatically.
4. Run `bun run db:prod:seed` once. It shows the target and asks you to type the database host.
5. Run `bun run db:prod:generate-tokens` once and share each generated fragment link privately. Later, `bun run db:prod:rotate-token "Name"` replaces one person's token and immediately invalidates their old link.
6. Deploy the client to Vercel or Cloudflare Pages with `VITE_API_URL` set to the Render API origin. Production builds fail when it is missing.
7. Confirm `GET /health` returns `200` (and `GET /health/db` for the database), then open the frontend with a generated link.

The API needs `DATABASE_URL` and `ALLOWED_ORIGIN`. The client needs `VITE_API_URL` only for production builds. Do not commit any `.env` files or generated tokens.

## Verification

GitHub Actions runs server type checks, linting, formatting, migrations, unit tests, PostgreSQL integration tests, client unit tests, and a client build on pushes and pull requests.
