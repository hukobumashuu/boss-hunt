import type { Request, Response, NextFunction } from 'express';
import type { ZodType } from 'zod';
import { errorResponse } from '../utils/api-response';

export function validateBody(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((issue) => ({
        field: issue.path.length > 0 ? issue.path.join('.') : 'body',
        message: issue.message,
      }));
      res.status(400).json(errorResponse('Validation failed', errors));
      return;
    }
    req.body = parsed.data;
    next();
  };
}
