export const CHANNEL_MIN = 1;
export const CHANNEL_MAX = 30;

export const KNOWN_LOGGERS = ['p3anut', 'stasha', 'paupauu', 'Guest'] as const;
export type LoggerName = (typeof KNOWN_LOGGERS)[number];

export const VOID_WINDOW_MINUTES = 5;
export const VOID_WINDOW_MS = VOID_WINDOW_MINUTES * 60 * 1000;

// How far in the past a client may claim a kill happened. The client sends how
// long ago the user tapped (not an absolute time), so a wrong laptop clock
// cannot corrupt kill times. Keep in sync with client/src/lib/killIntent.ts.
export const MAX_KILL_AGE_MINUTES = 30;
export const MAX_KILL_AGE_MS = MAX_KILL_AGE_MINUTES * 60 * 1000;
