import express from 'express';
import cors from 'cors';
import { killRoutes } from './features/kills/kills.routes';
import { trackerRoutes } from './features/tracker/tracker.routes';
import { bossRoutes } from './features/bosses/bosses.routes';
import { apiRateLimiter } from './shared/middlewares/rate-limit';
import { requireApiToken } from './shared/middlewares/auth';
import { errorHandler } from './shared/middlewares/error-handler';
import { successResponse } from './shared/utils/api-response';
import { env } from './config/env';

export function createApp() {
  const app = express();
  // Restricted to the one known frontend origin - the rate limiter below
  // and the token check further down are what actually keep this a
  // 4-person tool instead of a public one; CORS alone only stops
  // browsers, not curl/bots.
  app.use(cors({ origin: env.ALLOWED_ORIGIN }));
  app.use(express.json());

  // Public - Render's health check hits this before a logger token exists.
  app.get('/health', (_req, res) => {
    res.status(200).json(successResponse({ status: 'ok' }));
  });

  // Everything under /api is rate-limited, then requires a valid
  // per-person token. Identity for POST /api/kills comes from the
  // token, never from the request body.
  app.use('/api', apiRateLimiter, requireApiToken);

  app.use(killRoutes);
  app.use(trackerRoutes);
  app.use(bossRoutes);

  // Central error handler - anything a controller didn't already map to
  // a specific status ends up here as a 500.
  app.use(errorHandler);

  return app;
}
