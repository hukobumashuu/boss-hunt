export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

/** Trying to void a kill that belongs to someone else - identity comes
 * from the token, so this only fires on a genuine ownership mismatch,
 * never a spoofed one. */
export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/** The kill exists and belongs to this logger, but voiding it isn't
 * allowed right now - either the void window has passed, or a newer
 * kill has already been logged for the same boss+channel since. */
export class VoidNotAllowedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VoidNotAllowedError';
  }
}

/** Not a hard failure - surfaced as a 409 so the client can show the
 * "log anyway?" prompt instead of a generic error. */
export class DuplicateKillWarning extends Error {
  constructor(
    message: string,
    public readonly lastLoggedBy: string,
    public readonly lastKilledAt: Date,
  ) {
    super(message);
    this.name = 'DuplicateKillWarning';
  }
}
