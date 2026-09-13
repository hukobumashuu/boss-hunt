# Boss Tracker Server

Express + TypeScript API backed by PostgreSQL. Zod for request validation,
Drizzle ORM for queries and migrations. Runs on Bun.

## Auth

Every `/api/*` route requires `Authorization: Bearer <token>`. There's no
signup flow - tokens are generated once by whoever runs the server:

```bash
bun run db:generate-tokens   # creates all 4 from KNOWN_LOGGERS, prints each bookmark link
bun run db:rotate-token "Player1"   # if a token leaks, rotate just that one
```

Send each person their own `https://<frontend>/?token=<their-token>` link.
The intended frontend contract (for build order step 2): read `token` from
the URL on first load, save it (e.g. `localStorage`), strip it from the
visible URL with `history.replaceState`, then attach it as
`Authorization: Bearer <token>` on every request after that. No login
screen, no typing - open the bookmark once and it's remembered.

Identity for `POST /api/kills` comes entirely from this token now -
`loggedBy` is not part of the request body, so nobody can attribute a
kill to someone else's name.

## Setup

From the repo root, start Postgres:

```bash
docker compose up -d
```

Then, from `server/`:

```bash
bun install
cp .env.example .env.development
bun run db:migrate
bun run db:seed
bun run db:generate-tokens
bun run dev
```

The API runs at:

```text
http://localhost:4100
```

## Environment Variables

The server relies on Bun's automatic `.env.[NODE_ENV]` loading - no
loader code needed. Default file loaded: `.env.development`.

| Variable       | Example value                                                        | Description           |
| -------------- | -------------------------------------------------------------------- | --------------------- |
| `NODE_ENV`     | `development`                                                        | Runtime environment   |
| `PORT`         | `4100`                                                               | Express server port   |
| `DATABASE_URL` | `postgresql://boss_tracker:boss_tracker@localhost:5433/boss_tracker` | PostgreSQL connection |

## Scripts

| Script                | Description                                                       |
| --------------------- | ----------------------------------------------------------------- |
| `bun run dev`         | Start the server with hot reload (`--watch`)                      |
| `bun run start`       | Run the server directly (no build step - Bun runs `.ts` natively) |
| `bun run typecheck`   | Type-check without emitting files (`tsc --noEmit`)                |
| `bun test`            | Run the test suite (Bun's built-in runner)                        |
| `bun run db:up`       | Start Postgres with Docker Compose                                |
| `bun run db:down`     | Stop Postgres                                                     |
| `bun run db:logs`     | Follow Postgres logs                                              |
| `bun run db:generate` | Generate a Drizzle migration from the schema                      |
| `bun run db:migrate`  | Apply pending migrations                                          |
| `bun run db:seed`     | Insert the 5 known bosses                                         |
| `bun run db:studio`   | Open Drizzle Studio                                               |

## Structure

```text
server/
├── src/
│   ├── config/
│   │   ├── db.ts                     # Drizzle client (postgres-js driver)
│   │   └── env.ts                    # Zod-validated environment config
│   ├── db/
│   │   ├── migrations/               # generated Drizzle migrations
│   │   ├── schema/
│   │   │   ├── bosses.table.ts
│   │   │   ├── kill-events.table.ts  # append-only log
│   │   │   └── loggers.table.ts      # identity - name + hashed API token
│   │   ├── seed.ts
│   │   ├── generate-tokens.ts        # one-time: create all 4 tokens
│   │   └── rotate-token.ts           # revoke/reissue a single leaked token
│   ├── features/
│   │   ├── kills/
│   │   │   ├── kills.routes.ts
│   │   │   ├── kills.validation.ts   # Zod schema
│   │   │   ├── kills.types.ts        # inferred TS types
│   │   │   ├── kills.controller.ts
│   │   │   ├── kills.service.ts      # duplicate-guard + force-flag logic
│   │   │   └── kills.repository.ts
│   │   ├── tracker/
│   │   │   ├── tracker.routes.ts
│   │   │   ├── tracker.controller.ts
│   │   │   ├── tracker.service.ts
│   │   │   ├── tracker.repository.ts     # DISTINCT ON latest-kill query
│   │   │   ├── tracker.derivation.ts     # pure window-state math, no DB
│   │   │   ├── tracker.derivation.test.ts
│   │   │   └── tracker.types.ts
│   │   └── bosses/
│   │       ├── bosses.routes.ts
│   │       └── bosses.repository.ts      # no service layer - no logic to hold
│   ├── shared/
│   │   ├── middlewares/
│   │   │   ├── auth.ts                   # requireApiToken - identity per request
│   │   │   ├── validate.ts               # generic Zod body-validator
│   │   │   └── error-handler.ts
│   │   ├── types/
│   │   │   └── express.d.ts              # Request.logger augmentation
│   │   └── utils/
│   │       ├── api-response.ts           # {success,message,data} envelope
│   │       ├── app-error.ts              # NotFoundError, DuplicateKillWarning
│   │       └── constants.ts              # channel range, known loggers
│   ├── app.ts                            # Express app assembly, no .listen()
│   └── server.ts                         # entry point
├── drizzle.config.ts
├── package.json
└── tsconfig.json
```

## API Reference

Base URL:

```text
http://localhost:4100
```

| Method | Route          | Description                                             |
| ------ | -------------- | ------------------------------------------------------- |
| `POST` | `/api/kills`   | Log a kill for a boss+channel                           |
| `GET`  | `/api/tracker` | Latest window state per boss+channel, sorted by urgency |
| `GET`  | `/api/bosses`  | Static boss list, feeds the picker                      |
| `GET`  | `/health`      | Health check                                            |

### Log Kill

```http
POST /api/kills
Authorization: Bearer <your-token>
Content-Type: application/json
```

```json
{
  "bossId": 1,
  "channel": 5
}
```

The server sets `killedAt` itself and derives who's logging the kill from
the token, not from the body - never trust a client-sent timestamp _or_
a client-sent name. If the same boss+channel was logged within the last
2 minutes, this returns `409` with a warning instead of silently duplicating:

```json
{
  "success": false,
  "message": "Player2 already logged this kill recently. Log anyway?",
  "data": {
    "lastLoggedBy": "Player2",
    "lastKilledAt": "2026-09-05T04:00:00.000Z"
  }
}
```

Resubmit with `"force": true` to log anyway.

### Get Tracker

```http
GET /api/tracker
```

Returns every boss+channel pair with at least one logged kill, each with
`nextWindowAt` (the next respawn-check boundary), `windowsElapsed` (how
many checks have passed with no kill logged), and `status`
(`locked` | `opening_soon` | `open`). Sorted by urgency, not alphabetically:
`open` entries first (most-overdue first), then `opening_soon`, then
`locked`, each by soonest next window.

### Get Bosses

```http
GET /api/bosses
```

Static list of the 5 known bosses (`id`, `name`, `map`, `respawnIntervalHours`).

## Response Shape

Successful responses:

```json
{ "success": true, "message": "Success", "data": {} }
```

Error responses:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "channel", "message": "Number must be less than or equal to 30" }
  ]
}
```

## Database

Three tables:

```text
bosses
  id                       serial, primary key
  name                     varchar(100), required
  map                      varchar(100), required
  respawn_interval_hours   integer, required, defaults to 4

loggers
  id            serial, primary key
  name          varchar(100), required, unique
  token_hash    varchar(64), required, unique  # SHA-256 hex of their API token
  created_at    timestamptz, required, defaults to now()

kill_events                # append-only - never UPDATE or DELETE a row
  id            serial, primary key
  boss_id       integer, required, references bosses.id
  channel       integer, required (1-30)
  killed_at     timestamptz, required, defaults to now()
  logger_id     integer, required, references loggers.id
  # composite index on (boss_id, channel) - the actual query pattern
```

Everything else (next window, elapsed windows, future respawn-odds stats)
is derived from `kill_events` at read time, never stored.

To reset the local database:

```bash
docker compose down -v
docker compose up -d
cd server
bun run db:migrate
bun run db:seed
bun run db:generate-tokens
```
