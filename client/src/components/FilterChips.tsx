import type { Boss } from "../lib/types";
import { getBossLetter } from "../lib/bossShorthand";

export function FilterChips({
  bosses,
  selected,
  onToggle,
}: {
  bosses: Boss[];
  selected: Set<number>;
  onToggle: (bossId: number) => void;
}) {
  return (
    <div className="chips" role="group" aria-label="Filter by boss">
      {bosses.map((boss) => {
        const isActive = selected.has(boss.id);
        return (
          <button
            key={boss.id}
            type="button"
            aria-pressed={isActive}
            className={`chip ${isActive ? "chip--active" : ""}`}
            onClick={() => onToggle(boss.id)}
          >
            {getBossLetter(boss.name)} · {boss.name}
          </button>
        );
      })}
    </div>
  );
}
