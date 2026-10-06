import rateLimit from 'express-rate-limit';
import { errorResponse } from '../utils/api-response';

export const API_RATE_LIMIT = 600;

export function createRateLimiter(limit: number = API_RATE_LIMIT) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res
        .status(429)
        .json(errorResponse('Too many requests - try again later.'));
    },
  });
}

export const apiRateLimiter = createRateLimiter();
