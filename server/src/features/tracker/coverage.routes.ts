import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { db } from '../../config/db';
import { TrackerRepository } from './tracker.repository';
import { TrackerService } from './tracker.service';
import { ResetRepository } from '../resets/resets.repository';
import { BossRepository } from '../bosses/bosses.repository';
import { STALE_MISSED_THRESHOLD } from './tracker.derivation';
import { successResponse } from '../../shared/utils/api-response';

const trackerService = new TrackerService(
  new TrackerRepository(db),
  new ResetRepository(db),
);
const bossRepository = new BossRepository(db);

const CHANNELS = Array.from({ length: 30 }, (_, i) => i + 1);

export const coverageRoutes = Router();

coverageRoutes.get(
  '/api/coverage',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const [entries, bosses] = await Promise.all([
        trackerService.getTracker(),
        bossRepository.findAll(),
      ]);

      const coverage = bosses.map((boss) => {
        const bossEntries = entries.filter((e) => e.bossId === boss.id);
        const known = new Set(bossEntries.map((e) => e.channel));

        return {
          bossId: boss.id,
          bossName: boss.name,
          missing: CHANNELS.filter((ch) => !known.has(ch)),
          stale: bossEntries
            .filter((e) => e.windowsElapsed >= STALE_MISSED_THRESHOLD)
            .map((e) => ({ channel: e.channel, missed: e.windowsElapsed }))
            .sort((a, b) => a.channel - b.channel),
        };
      });

      res.status(200).json(successResponse(coverage));
    } catch (err) {
      next(err);
    }
  },
);
