import { z } from 'zod';

const DEFAULT_ORIGIN = 'http://localhost:5173';

/**
 * Browsers send the Origin header with no trailing slash and CORS compares it
 * exactly, so "https://app.example.com/" would block every request. Accept the
 * common copy-paste slip, normalize it, and reject anything that is not a
 * plain origin.
 */
export function normalizeOrigin(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(
      `"${value}" is not a valid URL. Use something like ${DEFAULT_ORIGIN}`,
    );
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`"${value}" must start with http:// or https://`);
  }
  if (
    url.pathname !== '/' ||
    url.search !== '' ||
    url.hash !== '' ||
    url.username !== '' ||
    url.password !== ''
  ) {
    throw new Error(
      `"${value}" must be an origin only (scheme, host and optional port), ` +
        'with no path, query, fragment or credentials',
    );
  }
  return url.origin;
}

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4100),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  ALLOWED_ORIGIN: z
    .string()
    .default(DEFAULT_ORIGIN)
    .transform((value, ctx) => {
      try {
        return normalizeOrigin(value);
      } catch (error) {
        ctx.addIssue({
          code: 'custom',
          message: error instanceof Error ? error.message : 'Invalid origin',
        });
        return z.NEVER;
      }
    }),
  // Strict on purpose: only the exact word "true" lifts the remote-database
  // guard, so "1" or "yes" fail loudly instead of being half-honoured.
  ALLOW_REMOTE_DB: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

export function parseEnv(source: Record<string, string | undefined>) {
  return envSchema.safeParse(source);
}
