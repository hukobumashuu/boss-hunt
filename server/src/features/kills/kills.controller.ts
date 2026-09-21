import type { Request, Response, NextFunction } from 'express';
import type { KillService } from './kills.service';
import type { LogKillBody } from './kills.types';
import {
  NotFoundError,
  DuplicateKillWarning,
  ForbiddenError,
  VoidNotAllowedError,
} from '../../shared/utils/app-error';
import {
  successResponse,
  errorResponse,
} from '../../shared/utils/api-response';

export class KillController {
  constructor(private readonly service: KillService) {}

  // req.body is typed as LogKillBody because validateBody(logKillBodySchema)
  // runs before this handler. req.logger is set by requireApiToken, which
  // also runs before this handler on every /api/* route.
  logKill = async (
    req: Request<Record<string, never>, unknown, LogKillBody>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (!req.logger) {
      // Should be unreachable - requireApiToken runs before this handler
      // on every /api/* route and would have already responded with 401.
      res.status(401).json(errorResponse('Not authenticated'));
      return;
    }

    try {
      const kill = await this.service.logKill(req.body, req.logger);
      res.status(201).json(successResponse(kill, 'Kill logged'));
    } catch (err) {
      if (err instanceof NotFoundError) {
        res.status(404).json(errorResponse(err.message));
        return;
      }
      if (err instanceof DuplicateKillWarning) {
        res.status(409).json(
          errorResponse(err.message, undefined, {
            lastLoggedBy: err.lastLoggedBy,
            lastKilledAt: err.lastKilledAt,
          }),
        );
        return;
      }
      next(err);
    }
  };

  // req.logger and req.params.id: same reasoning as logKill above, plus
  // the route param. Express validates :id is present via the route
  // pattern; the number-and-positive check is ours to make.
  voidKill = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (!req.logger) {
      res.status(401).json(errorResponse('Not authenticated'));
      return;
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json(errorResponse('Invalid kill id'));
      return;
    }

    try {
      await this.service.voidKill(id, req.logger);
      res.status(200).json(successResponse(null, 'Kill voided'));
    } catch (err) {
      if (err instanceof NotFoundError) {
        res.status(404).json(errorResponse(err.message));
        return;
      }
      if (err instanceof ForbiddenError) {
        res.status(403).json(errorResponse(err.message));
        return;
      }
      if (err instanceof VoidNotAllowedError) {
        res.status(400).json(errorResponse(err.message));
        return;
      }
      next(err);
    }
  };
}
