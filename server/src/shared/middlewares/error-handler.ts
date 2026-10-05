import type { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../utils/api-response';

const CLIENT_ERROR_MESSAGES: Record<number, string> = {
  400: 'Invalid request body',
  413: 'Request body too large',
  415: 'Unsupported content type',
};

function clientErrorStatus(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const { status, expose } = err as { status?: unknown; expose?: unknown };
  if (
    typeof status === 'number' &&
    status >= 400 &&
    status < 500 &&
    expose === true
  ) {
    return status;
  }
  return undefined;
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  void _next;
  const status = clientErrorStatus(err);
  if (status !== undefined) {
    res
      .status(status)
      .json(errorResponse(CLIENT_ERROR_MESSAGES[status] ?? 'Bad request'));
    return;
  }
  console.error(err);
  res.status(500).json(errorResponse('Internal server error'));
}
