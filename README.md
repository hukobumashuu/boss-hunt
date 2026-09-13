# Boss Respawn Tracker

Replaces manual respawn tracking (currently a Facebook group chat) with a
shared dashboard. See the original planning doc for the full problem
breakdown; this README covers what's built and how to run it.

## Repo layout

```text
boss-tracker/
├── docker-compose.yaml   # Postgres only, for local dev
├── server/               # Express + Drizzle + Zod API (Bun runtime)
└── client/               # React + Vite dashboard
```

## Prerequisites

- **Bun** ≥ 1.4.0 — `npm install -g bun`, then `bun --version` to confirm.
- **Docker** for local Postgres.

## First-time setup

```bash
git clone https://github.com/hukobumashuu/boss-hunt.git
cd boss-hunt
docker compose up -d          # starts Postgres on localhost:5433

cd server
bun install
cp .env.example .env.development
bun run db:migrate            # applies the migration
bun run db:seed               # inserts the 5 known bosses
bun run db:generate-tokens    # creates a login token per person, printed once
bun run dev                   # http://localhost:4100
```

In a second terminal:

```bash
cd client
bun install
cp .env.example .env.development
bun run dev                   # http://localhost:5173
```

Open `http://localhost:5173/?token=<one of the printed tokens>` - the app
reads it once, saves it, and remembers you from then on.

`.env.development` files are gitignored in both `server/` and `client/` -
they hold real connection strings and never get committed.

## Before using this for real

Open `server/src/shared/utils/constants.ts` and replace the
`KNOWN_LOGGERS` placeholders with your actual group's names before
running `db:generate-tokens` - that list is what gets a token generated
for it. If someone's token ever leaks, `bun run db:rotate-token "Name"`
invalidates the old one and prints a fresh one; there's no expiry to
wait out.

## What's implemented

See `server/README.md` for the full API reference, environment
variables, and script list.

- Kill logging with server-set timestamps, a soft duplicate-kill guard,
  and per-person API tokens - identity comes from the token, never from
  the request body.
- Respawn-window derivation (locked / opening soon / open), sorted by
  urgency, with unit tests covering the tick-boundary math.
- Rate limiting (100 req/15 min) and CORS scoped to one known frontend
  origin.
- Dashboard with tap-only kill logging (no typing, even for 30
  channels), multi-select boss filtering, and a "copy as text" output
  matching the guild's own manual shorthand for pasting into chat.

## Hosting

- **Database:** [Neon](https://neon.tech) - free tier, no forced expiry (unlike Render's own free Postgres, which self-deletes after 30 days).
- **API:** [Render](https://render.com) - free web service, deploys straight from this repo via `render.yaml` (Root Directory `server`, Build Command `bun install`, Start Command `bun src/server.ts`). Sleeps after 15 min idle; first request after a lull takes 30-60s to wake.
- **Frontend:** Vercel or Cloudflare Pages - static Vite build, no cold start.

Set `DATABASE_URL` (from Neon) and `ALLOWED_ORIGIN` (the deployed
frontend's URL) as environment variables in the Render dashboard -
`render.yaml` intentionally leaves these unset (`sync: false`) so they're
never committed. Note `ALLOWED_ORIGIN` has to point at the real deployed
frontend URL, and the frontend's `VITE_API_URL` has to point at the real
deployed API URL - Vite bakes that value in at build time, so it has to
be set correctly _before_ building, not after.

## Not built yet

- Not yet actually deployed - hosting plan above is decided, execution
  isn't done.
- Supertest integration tests for `POST /api/kills` and `GET /api/tracker`
  against a real Postgres instance - only the pure derivation logic has
  unit tests so far.
- CI (GitHub Actions: install, typecheck, lint, test on every push) -
  agreed on, not yet added.
- PWA scaffolding (manifest, service worker) - needed before push
  notifications become possible, not scoped yet.
- Ownership model (who's allowed to log which boss+channel) - explicitly
  left as a social convention for v1, per the original plan.
