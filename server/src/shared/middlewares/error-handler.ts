import type { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../utils/api-response';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express requires 4-arg signature to recognize this as an error handler
  _next: NextFunction,
): void {
  console.error(err);
  res.status(500).json(errorResponse('Internal server error'));
}
