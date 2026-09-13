import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4100),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  // The deployed frontend's origin, e.g. https://boss-tracker.vercel.app.
  // Defaults to the Vite dev server so local development works unchanged.
  ALLOWED_ORIGIN: z.string().default('http://localhost:5173'),
});

// Bun automatically loads .env / .env.local / .env.[NODE_ENV] before this
// module runs - no dotenv package, no manual loader needed.
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    'Invalid environment configuration:',
    parsed.error.flatten().fieldErrors,
  );
  process.exit(1);
}

export const env = parsed.data;
