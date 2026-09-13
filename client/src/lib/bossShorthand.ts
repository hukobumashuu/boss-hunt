/**
 * Guild shorthand, not a server concept - the server only knows full
 * boss names. Kept here, keyed by name, so it's one place to update if
 * the roster or naming ever changes.
 */
const BOSS_SHORTHAND: Record<string, string> = {
  Faello: 'F',
  Karion: 'K',
  Cockatrice: 'C',
  Mongrel: 'D',
  Cauda: 'S',
};

export function getBossLetter(bossName: string): string {
  return BOSS_SHORTHAND[bossName] ?? bossName.charAt(0).toUpperCase();
}
