import type { Request, Response, NextFunction } from 'express';
import type { TrackerService } from './tracker.service';
import { successResponse } from '../../shared/utils/api-response';

export class TrackerController {
  constructor(private readonly service: TrackerService) {}

  getTracker = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const tracker = await this.service.getTracker();
      res.status(200).json(successResponse(tracker));
    } catch (err) {
      next(err);
    }
  };
}
