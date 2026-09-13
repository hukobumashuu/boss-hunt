export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
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
