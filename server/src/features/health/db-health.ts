import type { RequestHandler } from 'express';
import { sql } from 'drizzle-orm';
import type { Database } from '../../config/db';
import {
  successResponse,
  errorResponse,
} from '../../shared/utils/api-response';

export const DB_HEALTH_TIMEOUT_MS = 3_000;

export function checkDatabase(db: Database): () => Promise<void> {
  return async () => {
    await db.execute(sql`select 1`);
  };
}

/**
 * GET /health answers without touching the database, so comparing it with this
 * endpoint tells you whether a hang is the process or the database path.
 */
export function createDbHealthHandler(
  check: () => Promise<void>,
  timeoutMs: number = DB_HEALTH_TIMEOUT_MS,
): RequestHandler {
  return async (_req, res) => {
    const startedAt = performance.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        check(),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new Error(`Database check timed out after ${timeoutMs}ms`),
              ),
            timeoutMs,
          );
        }),
      ]);
      res.status(200).json(
        successResponse({
          status: 'ok',
          dbLatencyMs: Math.round(performance.now() - startedAt),
        }),
      );
    } catch (err) {
      console.error('[health/db] database check failed:', err);
      res.status(503).json(errorResponse('Database unreachable'));
    } finally {
      clearTimeout(timer);
    }
  };
}
