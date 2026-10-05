const BOSS_SHORTHAND: Record<string, string> = {
  Faello: "F",
  Karion: "K",
  Cockatrice: "C",
  Mongrel: "D",
  Cauda: "S",
};

export function getBossLetter(bossName: string): string {
  return BOSS_SHORTHAND[bossName] ?? bossName.charAt(0).toUpperCase();
}
