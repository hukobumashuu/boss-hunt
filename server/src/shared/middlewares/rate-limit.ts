import rateLimit from 'express-rate-limit';
import { errorResponse } from '../utils/api-response';

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json(errorResponse('Too many requests - try again later.'));
  },
});
