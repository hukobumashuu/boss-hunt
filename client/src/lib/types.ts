// Mirrors server/src/shared/utils/api-response.ts. No shared package
// between server and client at this scale - two small type files kept in
// sync by hand is less overhead than a monorepo package boundary would be.

export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiSuccessBody<T> {
  success: true;
  message: string;
  data: T;
}

export interface ApiErrorBody<T = undefined> {
  success: false;
  message: string;
  errors?: ApiFieldError[];
  data?: T;
}

export type WindowStatus = 'locked' | 'opening_soon' | 'open';

export interface TrackerEntry {
  bossId: number;
  bossName: string;
  map: string;
  channel: number;
  lastKilledAt: string;
  nextWindowAt: string;
  windowsElapsed: number;
  status: WindowStatus;
}

export interface Boss {
  id: number;
  name: string;
  map: string;
  respawnIntervalHours: number;
}

export interface DuplicateKillWarning {
  lastLoggedBy: string;
  lastKilledAt: string;
}
