import { parseEnv } from './env-schema';

const parsed = parseEnv(process.env);

if (!parsed.success) {
  console.error(
    'Invalid environment configuration:',
    parsed.error.flatten().fieldErrors,
  );
  process.exit(1);
}

export const env = parsed.data;
