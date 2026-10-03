export const CHANNEL_MIN = 1;
export const CHANNEL_MAX = 30;

export const KNOWN_LOGGERS = ['p3anut', 'stasha', 'paupauu', 'Guest'] as const;
export type LoggerName = (typeof KNOWN_LOGGERS)[number];

export const VOID_WINDOW_MINUTES = 5;
export const VOID_WINDOW_MS = VOID_WINDOW_MINUTES * 60 * 1000;
