import { z } from 'zod';
import {
  CHANNEL_MIN,
  CHANNEL_MAX,
  MAX_KILL_AGE_MS,
} from '../../shared/utils/constants';

export const logKillBodySchema = z.object({
  bossId: z.number().int().positive(),
  channel: z.number().int().min(CHANNEL_MIN).max(CHANNEL_MAX),
  force: z.boolean().optional().default(false),
  // How long ago the user actually tapped, in ms. Lets a delayed request (a
  // confirm prompt, a retry after a timeout) still record the real kill time.
  killedAgoMs: z.number().int().min(0).max(MAX_KILL_AGE_MS).optional(),
  // Idempotency key, generated once per user action and reused on retries.
  requestId: z.uuid().optional(),
});
