# Boss Respawn Tracker

Replaces manual respawn tracking (currently a Facebook group chat) with a
shared dashboard. See the original planning doc for the full problem
breakdown; this README covers what's built and how to run it.

## Repo layout

```text
boss-tracker/
├── docker-compose.yaml   # Postgres only, for local dev
├── server/               # Express + Drizzle + Zod API (Bun runtime)
└── client/               # React + Vite dashboard - not built yet (step 2)
```

## Prerequisites

- **Bun** ≥ 1.4.0 — `npm install -g bun`, then `bun --version` to confirm.
  (Node itself isn't required for this project; Bun replaces the whole
  toolchain - runtime, package manager, test runner, bundler.)
- **Docker** for local Postgres.

## First-time setup

```bash
git clone <this-repo>
cd boss-tracker
docker compose up -d          # starts Postgres on localhost:5433

cd server
bun install
cp .env.example .env.development
bun run db:migrate            # applies the generated migration
bun run db:seed               # inserts the 5 known bosses
bun run dev                   # http://localhost:4100
```

`.env.development` is gitignored - it holds your real `DATABASE_URL`, never commit it.

## Before using this for real

Open `server/src/shared/utils/constants.ts` and replace the `KNOWN_LOGGERS`
placeholders with your actual 4 names. `logged_by` is a closed list on
purpose (see comment in that file) - free text would quietly break the
v1.1 respawn-odds analysis this whole log exists to eventually answer.

## Why Bun (and why not, elsewhere)

This project uses Bun as the runtime/package manager; other projects in
this portfolio (job-application-tracker) use Yarn Berry + Node. That's a
deliberate, single project's tooling choice, not a claim that Bun is
strictly better - worth having a clear answer ready if asked about the
inconsistency in an interview: it's a controlled experiment on a
low-stakes side project, not a production recommendation.

Concretely, Bun removes three dependencies this project would otherwise
need under Node: `tsx`/`ts-node` (Bun runs `.ts` directly), `dotenv`
(Bun auto-loads `.env.[NODE_ENV]` files with no code), and a separate
test runner (`bun test` is Jest-API-compatible, so Supertest still works
unchanged when the integration suite gets added).

## What's implemented

See `server/README.md` for the API reference, environment variables, and
script list.

## Hosting

- **Database:** [Neon](https://neon.tech) - free tier, no forced expiry (unlike Render's own free Postgres, which self-deletes after 30 days).
- **API:** [Render](https://render.com) - free web service, deploys straight from this repo via `render.yaml` (Root Directory `server`, Build Command `bun install`, Start Command `bun src/server.ts`). Sleeps after 15 min idle; first request after a lull takes 30-60s to wake, fine for a 4-person group.
- **Frontend:** Vercel or Cloudflare Pages, once `client/` exists - static Vite build, no cold start.

Set `DATABASE_URL` (from Neon) and `ALLOWED_ORIGIN` (the deployed frontend's URL) as environment variables in the Render dashboard - `render.yaml` intentionally leaves these unset (`sync: false`) so they're never committed.

## Not built yet

- `client/` - the React dashboard (build order step 2).
- Supertest integration tests for `POST /api/kills` and `GET /api/tracker`
  against a real Postgres instance (only the pure derivation logic has
  unit tests so far - see `server/src/features/tracker/tracker.derivation.test.ts`).
- Deployment. Plan: Neon (free Postgres, no forced expiry) + Render free
  web service for the API + Vercel/Cloudflare Pages for the static
  frontend. See conversation history for why Render's own free Postgres
  isn't used (30-day expiry, then deletion).
- PWA scaffolding (manifest, service worker) - needed before push
  notifications become possible, not scoped yet.
- Ownership model (who's allowed to log which boss+channel) - explicitly
  left as a social convention for v1, per the original plan.
