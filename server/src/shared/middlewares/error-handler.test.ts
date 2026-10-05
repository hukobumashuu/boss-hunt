import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import type { Request, Response } from 'express';
import { errorHandler } from './error-handler';

function run(err: unknown) {
  let statusCode = 0;
  let body: unknown;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
      return this;
    },
  } as unknown as Response;
  errorHandler(err, {} as Request, res, () => {});
  return { statusCode, body };
}

describe('errorHandler', () => {
  const consoleError = spyOn(console, 'error').mockImplementation(() => {});

  afterEach(() => {
    consoleError.mockClear();
  });

  it('returns 400 for a malformed request body without logging a stack trace', () => {
    const { statusCode, body } = run(
      Object.assign(new SyntaxError('Unexpected token'), {
        status: 400,
        expose: true,
      }),
    );

    expect(statusCode).toBe(400);
    expect(body).toEqual({ success: false, message: 'Invalid request body' });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('returns 413 for an oversized body', () => {
    const { statusCode, body } = run(
      Object.assign(new Error('too large'), { status: 413, expose: true }),
    );

    expect(statusCode).toBe(413);
    expect(body).toEqual({ success: false, message: 'Request body too large' });
  });

  it('returns 500 and logs unknown errors', () => {
    const { statusCode, body } = run(new Error('boom'));

    expect(statusCode).toBe(500);
    expect(body).toEqual({
      success: false,
      message: 'Internal server error',
    });
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it('does not trust a status without expose', () => {
    const { statusCode } = run(Object.assign(new Error('x'), { status: 400 }));

    expect(statusCode).toBe(500);
  });
});
