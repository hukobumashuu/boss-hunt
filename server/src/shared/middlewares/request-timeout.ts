import type { RequestHandler } from 'express';
import { errorResponse } from '../utils/api-response';

export const REQUEST_TIMEOUT_MS = 10_000;

export function requestTimeout(
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): RequestHandler {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      if (res.headersSent) return;
      console.error(
        `[timeout] ${req.method} ${req.path} still running after ${timeoutMs}ms`,
      );
      res
        .status(503)
        .json(
          errorResponse(
            'The server took too long to respond. Please try again.',
          ),
        );
    }, timeoutMs);

    const clear = () => clearTimeout(timer);
    res.once('finish', clear);
    res.once('close', clear);
    next();
  };
}
