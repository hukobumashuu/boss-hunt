export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class VoidNotAllowedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VoidNotAllowedError';
  }
}

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
