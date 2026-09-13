import { z } from 'zod';
import { CHANNEL_MIN, CHANNEL_MAX } from '../../shared/utils/constants';

export const logKillBodySchema = z.object({
  bossId: z.number().int().positive(),
  channel: z.number().int().min(CHANNEL_MIN).max(CHANNEL_MAX),
  /**
   * Set by the client only when re-submitting after a duplicate warning.
   * The server never trusts a client-sent *timestamp*, but it does trust
   * this explicit "yes, log it anyway" flag - that's a user decision,
   * not a fact about the world.
   */
  force: z.boolean().optional().default(false),
});
