import type { z } from 'zod';
import type { logKillBodySchema } from './kills.validation';

export type LogKillBody = z.infer<typeof logKillBodySchema>;
