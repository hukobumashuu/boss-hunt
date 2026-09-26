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

export type WindowStatus = "locked" | "opening_soon" | "open";

export interface TrackerEntry {
  bossId: number;
  bossName: string;
  map: string;
  channel: number;
  lastKilledAt: string;
  nextWindowAt: string;
  windowsElapsed: number;
  status: WindowStatus;
  respawnIntervalHours: number;
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

export interface CoverageEntry {
  bossId: number;
  bossName: string;
  missing: number[];
  stale: { channel: number; missed: number }[];
}
