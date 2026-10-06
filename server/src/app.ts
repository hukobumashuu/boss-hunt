import express from 'express';
import type { RequestHandler } from 'express';
import cors from 'cors';
import { killRoutes } from './features/kills/kills.routes';
import { trackerRoutes } from './features/tracker/tracker.routes';
import { bossRoutes } from './features/bosses/bosses.routes';
import { resetRoutes } from './features/resets/resets.routes';
import { coverageRoutes } from './features/tracker/coverage.routes';
import { apiRateLimiter } from './shared/middlewares/rate-limit';
import { requireApiToken } from './shared/middlewares/auth';
import { errorHandler } from './shared/middlewares/error-handler';
import { successResponse } from './shared/utils/api-response';
import { env } from './config/env';

export interface AppOptions {
  rateLimiter?: RequestHandler;
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(cors({ origin: env.ALLOWED_ORIGIN }));
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json(successResponse({ status: 'ok' }));
  });

  app.use('/api', options.rateLimiter ?? apiRateLimiter, requireApiToken);

  app.use(killRoutes);
  app.use(trackerRoutes);
  app.use(bossRoutes);
  app.use(resetRoutes);
  app.use(coverageRoutes);
  app.use(errorHandler);

  return app;
}
