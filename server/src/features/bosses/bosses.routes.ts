import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { db } from '../../config/db';
import { BossRepository } from './bosses.repository';
import { successResponse } from '../../shared/utils/api-response';

const repository = new BossRepository(db);

export const bossRoutes = Router();

bossRoutes.get(
  '/api/bosses',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const bosses = await repository.findAll();
      res.status(200).json(successResponse(bosses));
    } catch (err) {
      next(err);
    }
  },
);
