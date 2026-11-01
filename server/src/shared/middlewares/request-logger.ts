import type { RequestHandler } from 'express';

export const SLOW_REQUEST_MS = 2_000;

export function requestLogger(
  slowMs: number = SLOW_REQUEST_MS,
): RequestHandler {
  return (req, res, next) => {
    const startedAt = performance.now();
    let finished = false;

    res.once('finish', () => {
      finished = true;
    });
    res.once('close', () => {
      const durationMs = Math.round(performance.now() - startedAt);
      const outcome = finished ? res.statusCode : 'aborted by client';
      if (!finished || res.statusCode >= 500 || durationMs >= slowMs) {
        console.warn(
          `[request] ${req.method} ${req.path} -> ${outcome} in ${durationMs}ms`,
        );
      }
    });
    next();
  };
}
