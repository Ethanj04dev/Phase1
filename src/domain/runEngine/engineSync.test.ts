import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * The server must run EXACTLY the engine the benchmark measured. The Edge
 * Function's copies in supabase/functions/_shared/runEngine are produced by
 * scripts/sync-run-engine.mjs; this test fails whenever they drift from the
 * source. Fix by re-running the sync script — never by editing the copies.
 */
describe('server-side engine parity', () => {
  const sourceDir = join(__dirname);
  const sharedDir = join(__dirname, '../../../supabase/functions/_shared/runEngine');
  const files = ['types.ts', 'geo.ts', 'ruleset.ts', 'filtering.ts', 'analyze.ts'];

  it('the shared copies exist', () => {
    for (const file of files) {
      expect(existsSync(join(sharedDir, file))).toBe(true);
    }
  });

  it.each(files)('%s matches the source (modulo Deno .ts specifiers)', (file) => {
    const source = readFileSync(join(sourceDir, file), 'utf8');
    const copy = readFileSync(join(sharedDir, file), 'utf8');
    const normalize = (content: string) =>
      content.replace(/from '(\.\/[a-zA-Z]+)\.ts';/g, "from '$1';");
    expect(normalize(copy)).toBe(normalize(source));
  });
});
