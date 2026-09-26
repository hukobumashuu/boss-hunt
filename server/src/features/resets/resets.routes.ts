import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { db } from '../../config/db';
import { ResetRepository } from './resets.repository';
import {
  successResponse,
  errorResponse,
} from '../../shared/utils/api-response';

const repository = new ResetRepository(db);

export const resetRoutes = Router();

resetRoutes.post(
  '/api/resets',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.logger) {
      res.status(401).json(errorResponse('Not authenticated'));
      return;
    }
    try {
      const reset = await repository.insert(req.logger.id);
      res.status(201).json(successResponse(reset, 'Reset logged'));
    } catch (err) {
      next(err);
    }
  },
);

resetRoutes.get(
  '/api/resets/latest',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const latest = await repository.findLatest();
      res.status(200).json(successResponse(latest));
    } catch (err) {
      next(err);
    }
  },
);
