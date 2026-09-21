export const CHANNEL_MIN = 1;
export const CHANNEL_MAX = 30;

/**
 * Fixed roster for a trusted 4-person group. Used only as the seed list
 * for `bun run db:generate-tokens` (see db/generate-tokens.ts) - identity
 * at request time now comes from each person's API token (see
 * shared/middlewares/auth.ts), not from this list directly.
 */
export const KNOWN_LOGGERS = [
  'Player1', // TODO: replace with your group's real names
  'Player2',
  'Player3',
  'Player4',
] as const;
export type LoggerName = (typeof KNOWN_LOGGERS)[number];

/** How long after logging a kill its own logger can void it - long
 * enough to catch "wrong boss/channel" in the same breath, short enough
 * that voiding never rewrites something the group has already acted on. */
export const VOID_WINDOW_MINUTES = 5;
export const VOID_WINDOW_MS = VOID_WINDOW_MINUTES * 60 * 1000;
