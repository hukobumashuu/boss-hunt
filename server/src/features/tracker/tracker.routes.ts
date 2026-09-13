import { Router } from 'express';
import { db } from '../../config/db';
import { TrackerRepository } from './tracker.repository';
import { TrackerService } from './tracker.service';
import { TrackerController } from './tracker.controller';

const repository = new TrackerRepository(db);
const service = new TrackerService(repository);
const controller = new TrackerController(service);

export const trackerRoutes = Router();
trackerRoutes.get('/api/tracker', controller.getTracker);
