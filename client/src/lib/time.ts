function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export function formatCountdown(targetIso: string, now: Date): string {
  const diffMs = new Date(targetIso).getTime() - now.getTime();
  if (diffMs <= 0) return "now";
  return formatDuration(Math.round(diffMs / 60_000));
}

export function formatElapsedSince(targetIso: string, now: Date): string {
  const diffMs = Math.max(0, now.getTime() - new Date(targetIso).getTime());
  return formatDuration(Math.round(diffMs / 60_000));
}

const TIME_ZONE = "Asia/Manila";
const timeOfDayFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

/** Exact H:M:S, matching the clock's own formatting - this is the
 * precision the plan set out to replace manual chat logging with. */
export function formatTimeOfDay(iso: string): string {
  return timeOfDayFormatter.format(new Date(iso));
}
