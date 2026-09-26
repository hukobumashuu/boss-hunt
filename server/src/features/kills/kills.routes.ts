import { Router } from 'express';
import { db } from '../../config/db';
import { KillRepository } from './kills.repository';
import { KillService } from './kills.service';
import { KillController } from './kills.controller';
import { ResetRepository } from '../resets/resets.repository';
import { validateBody } from '../../shared/middlewares/validate';
import { logKillBodySchema } from './kills.validation';

const repository = new KillRepository(db);
const resetRepository = new ResetRepository(db);
const service = new KillService(repository, resetRepository);
const controller = new KillController(service);

export const killRoutes = Router();
killRoutes.post(
  '/api/kills',
  validateBody(logKillBodySchema),
  controller.logKill,
);
killRoutes.post('/api/kills/:id/void', controller.voidKill);
