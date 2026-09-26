import { Router } from 'express';
import { db } from '../../config/db';
import { TrackerRepository } from './tracker.repository';
import { TrackerService } from './tracker.service';
import { TrackerController } from './tracker.controller';
import { ResetRepository } from '../resets/resets.repository';

const repository = new TrackerRepository(db);
const resetRepository = new ResetRepository(db);
const service = new TrackerService(repository, resetRepository);
const controller = new TrackerController(service);

export const trackerRoutes = Router();
trackerRoutes.get('/api/tracker', controller.getTracker);
