import 'express';

declare module 'express' {
  interface Request {
    /** Set by requireApiToken once the bearer token resolves to a known
     * logger. Only present on routes behind that middleware. */
    logger?: { id: number; name: string };
  }
}
