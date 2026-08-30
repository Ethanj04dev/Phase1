import { readFileSync } from 'fs';
import { join } from 'path';

import { SCORING_CONFIGS } from './index';

/**
 * The official rating is computed server-side by compute_official_rating(),
 * which reads curves seeded into scoring_configs by migration 0008. Those
 * seeds must be EXACTLY the app's curves — a drift between the two would
 * mean the preview and the official rating disagree about arithmetic.
 *
 * This test parses the JSON out of the migration and deep-compares it to the
 * TypeScript catalog. Editing either side without the other fails here.
 */
describe('SQL scoring seeds mirror the TypeScript configs', () => {
  const migration = readFileSync(
    join(__dirname, '../../../../supabase/migrations/0008_verification_foundation.sql'),
    'utf8',
  );

  for (const config of SCORING_CONFIGS) {
    it(`${config.definitionId}@${config.definitionVersion} matches the seed`, () => {
      const marker = `('${config.definitionId}', ${config.definitionVersion}, ${config.configVersion}, '`;
      const start = migration.indexOf(marker);
      expect(start).toBeGreaterThan(-1);

      const jsonStart = start + marker.length;
      const jsonEnd = migration.indexOf(`'::jsonb)`, jsonStart);
      expect(jsonEnd).toBeGreaterThan(jsonStart);

      const seeded = JSON.parse(migration.slice(jsonStart, jsonEnd)) as {
        events: { eventId: string; weight: number; anchors: unknown[] }[];
      };

      expect(seeded.events).toEqual(
        config.events.map((curve) => ({
          eventId: curve.eventId,
          weight: curve.weight,
          anchors: curve.anchors.map((anchor) => ({ ...anchor })),
        })),
      );
    });
  }
});
