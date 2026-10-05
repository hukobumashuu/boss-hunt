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

`db:seed` is idempotent. `db:generate-tokens` creates tokens for `p3anut`, `stasha`, `paupauu`, and `Guest`; rerunning it leaves existing logger tokens unchanged. Send bookmark links in the form `https://<frontend>/#token=<token>`. The fragment is not sent to the web server.

## Deployment

1. Create a Neon database and set Render's `DATABASE_URL` to its direct connection URL.
2. Create the Render web service from `render.yaml`, then set `ALLOWED_ORIGIN` to the final frontend origin. The free-plan build command installs dependencies and applies pending migrations.
3. Run `bun run db:seed` once against Neon from a machine with `DATABASE_URL` configured.
4. Run `bun run db:generate-tokens` once against Neon and share each generated fragment link privately.
5. Deploy the client to Vercel or Cloudflare Pages with `VITE_API_URL` set to the Render API origin. Production builds fail when it is missing.
6. Confirm `GET /health` returns `200`, then open the frontend with a generated link.

The API needs `DATABASE_URL` and `ALLOWED_ORIGIN`. The client needs `VITE_API_URL` only for production builds. Do not commit any `.env` files or generated tokens.

## Verification

GitHub Actions runs server type checks, linting, formatting, migrations, unit tests, PostgreSQL integration tests, and a client build on pushes and pull requests.
