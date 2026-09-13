import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Request, Response, NextFunction } from 'express';
import { db } from '../../config/db';
import { loggers } from '../../db/schema';
import { errorResponse } from '../utils/api-response';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Requires `Authorization: Bearer <token>`. On success, attaches
 * `req.logger` so downstream handlers never need to trust a
 * client-supplied name again - identity comes from the credential.
 *
 * Deliberately no expiry: for a closed 4-person group, the real failure
 * mode is a leaked token, and the fix for that is revoking the one row
 * in `loggers` that matches it (see db/generate-token.ts), not a timer
 * that also logs out someone who's actively hunting.
 */
export async function requireApiToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

  if (!token) {
    res
      .status(401)
      .json(errorResponse('Missing or malformed Authorization header'));
    return;
  }

  const [match] = await db
    .select({ id: loggers.id, name: loggers.name })
    .from(loggers)
    .where(eq(loggers.tokenHash, hashToken(token)))
    .limit(1);

  if (!match) {
    res.status(401).json(errorResponse('Invalid API token'));
    return;
  }

  req.logger = match;
  next();
}
