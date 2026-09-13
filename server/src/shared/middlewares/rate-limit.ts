import rateLimit from 'express-rate-limit';
import { errorResponse } from '../utils/api-response';

/**
 * Scoped to `/api/*` only, not `/health` - Render polls `/health`
 * frequently to know the service is alive, and that check doesn't touch
 * the database, so it shouldn't compete with real traffic for the same
 * budget. Every `/api` route does hit the database (a tracker fetch, a
 * duplicate-kill check, an insert), so limiting here protects Neon's
 * free tier as much as Render's - one limiter, both resources.
 *
 * Not aimed at brute-forcing a token - a random 32-byte token is
 * infeasible to guess regardless of request rate. This is aimed at the
 * more mundane threat: automated internet scanners hit every public URL
 * indiscriminately, and Render's free tier (0.1 CPU, 512MB) is small
 * enough that sustained junk traffic can degrade real requests before
 * anyone notices why.
 *
 * In-memory store is fine here - Render's free tier runs a single
 * instance, not multiple instances behind a load balancer, so there's
 * no "state not shared across instances" problem that would call for a
 * Redis-backed store.
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json(errorResponse('Too many requests - try again later.'));
  },
});
