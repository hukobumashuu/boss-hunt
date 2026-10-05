import { z } from 'zod';
import { CHANNEL_MIN, CHANNEL_MAX } from '../../shared/utils/constants';

export const logKillBodySchema = z.object({
  bossId: z.number().int().positive(),
  channel: z.number().int().min(CHANNEL_MIN).max(CHANNEL_MAX),
  force: z.boolean().optional().default(false),
});
