import type { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../utils/api-response';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  void _next;
  console.error(err);
  res.status(500).json(errorResponse('Internal server error'));
}
