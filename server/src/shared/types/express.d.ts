import 'express';

declare module 'express' {
  interface Request {
    logger?: { id: number; name: string };
  }
}
