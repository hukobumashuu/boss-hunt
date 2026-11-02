import { describe, expect, it } from 'bun:test';
import { normalizeOrigin, parseEnv } from './env-schema';

const BASE = { DATABASE_URL: 'postgresql://u:p@localhost:5432/db' };

describe('normalizeOrigin', () => {
  it('strips trailing slashes, which would otherwise break CORS matching', () => {
    expect(normalizeOrigin('https://boss-hunt-flax.vercel.app/')).toBe(
      'https://boss-hunt-flax.vercel.app',
    );
    expect(normalizeOrigin('https://boss-hunt-flax.vercel.app///')).toBe(
      'https://boss-hunt-flax.vercel.app',
    );
  });

  it('keeps ports, lowercases the host and trims whitespace', () => {
    expect(normalizeOrigin('  http://LOCALHOST:5173 \n')).toBe(
      'http://localhost:5173',
    );
  });

  it('leaves an already-correct origin unchanged', () => {
    expect(normalizeOrigin('http://localhost:5173')).toBe(
      'http://localhost:5173',
    );
  });

  it('rejects anything that is not a plain http(s) origin', () => {
    for (const value of [
      'boss-hunt-flax.vercel.app',
      'ftp://example.com',
      'https://example.com/app',
      'https://example.com?x=1',
      'https://example.com/#token=abc',
      'https://user:pass@example.com',
      '',
    ]) {
      expect(() => normalizeOrigin(value)).toThrow();
    }
  });
});

describe('parseEnv', () => {
  it('applies defaults', () => {
    const result = parseEnv(BASE);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      NODE_ENV: 'development',
      PORT: 4100,
      ALLOWED_ORIGIN: 'http://localhost:5173',
      ALLOW_REMOTE_DB: false,
    });
  });

  it('normalizes ALLOWED_ORIGIN, so the trailing-slash mistake cannot break CORS or links', () => {
    const result = parseEnv({
      ...BASE,
      ALLOWED_ORIGIN: 'https://boss-hunt-flax.vercel.app/',
    });

    expect(result.data?.ALLOWED_ORIGIN).toBe(
      'https://boss-hunt-flax.vercel.app',
    );
  });

  it('reports a bad ALLOWED_ORIGIN against that field', () => {
    const result = parseEnv({
      ...BASE,
      ALLOWED_ORIGIN: 'https://example.com/app',
    });

    expect(result.success).toBe(false);
    expect(
      result.error?.flatten().fieldErrors['ALLOWED_ORIGIN']?.[0],
    ).toContain('origin only');
  });

  it('requires DATABASE_URL', () => {
    expect(parseEnv({}).success).toBe(false);
  });

  it('only accepts the exact words true or false for ALLOW_REMOTE_DB', () => {
    expect(
      parseEnv({ ...BASE, ALLOW_REMOTE_DB: 'true' }).data?.ALLOW_REMOTE_DB,
    ).toBe(true);
    expect(
      parseEnv({ ...BASE, ALLOW_REMOTE_DB: 'false' }).data?.ALLOW_REMOTE_DB,
    ).toBe(false);
    for (const value of ['1', 'yes', 'TRUE', '']) {
      expect(parseEnv({ ...BASE, ALLOW_REMOTE_DB: value }).success).toBe(false);
    }
  });
});
