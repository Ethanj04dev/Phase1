import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

/**
 * Copies the pure Run Engine modules into the Supabase Edge Function's
 * _shared directory, rewriting import specifiers to the explicit .ts form
 * Deno requires. Run after any engine change:
 *
 *   node scripts/sync-run-engine.mjs
 *
 * A parity test (engineSync.test.ts) fails the suite whenever the copies
 * drift from the source, so the server can never silently run a different
 * engine than the one the benchmark measured.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(root, 'src/domain/runEngine');
const targetDir = join(root, 'supabase/functions/_shared/runEngine');

const FILES = ['types.ts', 'geo.ts', 'ruleset.ts', 'filtering.ts', 'analyze.ts'];

mkdirSync(targetDir, { recursive: true });
for (const file of FILES) {
  const content = readFileSync(join(sourceDir, file), 'utf8');
  const denoContent = content.replace(/from '(\.\/[a-zA-Z]+)';/g, "from '$1.ts';");
  writeFileSync(join(targetDir, file), denoContent);
  console.log(`synced ${file}`);
}
