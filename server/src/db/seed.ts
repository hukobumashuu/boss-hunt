import { db } from '../config/db';
import { bosses } from './schema';
import type { NewBoss } from './schema';

const SEED_BOSSES: NewBoss[] = [
  { name: 'Faello', map: 'Lakeside', respawnIntervalHours: 4 },
  { name: 'Karion', map: 'Forgotten Ruin', respawnIntervalHours: 4 },
  { name: 'Cockatrice', map: 'Forgotten Ruin', respawnIntervalHours: 4 },
  { name: 'Cauda', map: 'Forgotten Ruin', respawnIntervalHours: 4 },
  { name: 'Mongrel', map: 'Forgotten Ruin', respawnIntervalHours: 4 },
];

async function seed() {
  const inserted = await db
    .insert(bosses)
    .values(SEED_BOSSES)
    .onConflictDoNothing({ target: bosses.name })
    .returning();
  console.log(`Seeded ${inserted.length} bosses.`);
  process.exit(0);
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
