import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { analyzeRun } from './analyze';
import { measurePath, prepareSamples, type DistancePipelineId } from './filtering';
import { RUN_RULESET } from './ruleset';
import {
  addJitter,
  makeLoopTrace,
  makeOutAndBackTrace,
  makeTruthTrace,
  T0,
} from './testTraces';
import type { RunTrace } from './types';

/**
 * The Run Engine accuracy benchmark: known reference distance vs computed,
 * across GPS conditions, for every candidate pipeline. This file is both a
 * gate (the selected pipeline must meet the thresholds below) and a report
 * generator — docs/benchmarks/run-engine-v2.md is written on every run, so
 * the numbers behind the pipeline selection are always inspectable.
 *
 * Real device traces can join the benchmark by dropping
 * `{"referenceMeters": <measured course length>, "trace": {...}}` files into
 * src/domain/runEngine/fixtures/ — they are picked up automatically.
 */

const MILE_1_5 = 2414.016;
const PIPELINES: DistancePipelineId[] = ['smooth3', 'stride', 'kalman', 'kalman_stride'];
const SEEDS = [11, 42, 97];

interface BenchmarkCase {
  name: string;
  /** True path length in metres. */
  referenceMeters: number;
  referenceCrossingSeconds: number | null;
  trace: RunTrace;
  /** Whether an honest verified verdict is possible for this trace. */
  validRun: boolean;
}

function straightCase(
  name: string,
  seed: number,
  options: {
    durationSeconds: number;
    speed: number;
    jitterMeters?: number;
    jitterModel?: 'white' | 'ar1';
    accuracyAt?: (t: number) => number;
    dropSeconds?: ReadonlySet<number>;
    validRun?: boolean;
  },
): BenchmarkCase {
  const truth = makeTruthTrace({
    durationSeconds: options.durationSeconds,
    speedAt: () => options.speed,
    jitterMeters: options.jitterMeters ?? 0,
    jitterModel: options.jitterModel ?? 'ar1',
    jitterSeed: seed,
    accuracyAt: options.accuracyAt ?? (() => 8),
    dropSeconds: options.dropSeconds,
  });
  return {
    name,
    referenceMeters: truth.referenceMeters,
    referenceCrossingSeconds: truth.referenceCrossingSeconds(MILE_1_5),
    trace: truth.trace,
    validRun: options.validRun ?? true,
  };
}

function buildCases(seed: number): BenchmarkCase[] {
  const dropoutSeconds = new Set<number>();
  for (let second = 300; second < 318; second += 1) {
    dropoutSeconds.add(second);
  }
  const urbanDrops = new Set<number>([80, 81, 200, 201, 202, 390, 391, 540, 610, 611]);

  const loop = makeLoopTrace({ durationSeconds: 700, speedMps: 3.6, sideA: 100, sideB: 100 });
  const turns = makeLoopTrace({ durationSeconds: 700, speedMps: 3.6, sideA: 40, sideB: 30 });
  const outBack = makeOutAndBackTrace(700, 3.6);

  return [
    straightCase('clean_open_sky', seed, {
      durationSeconds: 700,
      speed: 3.6,
      accuracyAt: () => 5,
    }),
    straightCase('normal_noise', seed, {
      durationSeconds: 700,
      speed: 3.6,
      jitterMeters: 3,
      jitterModel: 'ar1',
    }),
    straightCase('heavy_jitter_white', seed, {
      durationSeconds: 700,
      speed: 3.6,
      jitterMeters: 4,
      jitterModel: 'white',
      accuracyAt: () => 12,
    }),
    straightCase('temporary_dropout', seed, {
      durationSeconds: 700,
      speed: 3.6,
      jitterMeters: 3,
      jitterModel: 'ar1',
      dropSeconds: dropoutSeconds,
    }),
    straightCase('urban_degradation', seed, {
      durationSeconds: 720,
      speed: 3.6,
      jitterMeters: 6,
      jitterModel: 'ar1',
      accuracyAt: (t) => 10 + ((t * 7) % 18),
      dropSeconds: urbanDrops,
    }),
    straightCase('tree_cover', seed, {
      durationSeconds: 710,
      speed: 3.6,
      jitterMeters: 5,
      jitterModel: 'ar1',
      accuracyAt: () => 18,
    }),
    straightCase('slow_running', seed, {
      durationSeconds: 1290,
      speed: 2.0,
      jitterMeters: 3,
      jitterModel: 'ar1',
    }),
    straightCase('elite_speed', seed, {
      durationSeconds: 380,
      speed: 6.7,
      jitterMeters: 3,
      jitterModel: 'ar1',
    }),
    {
      name: 'track_laps',
      referenceMeters: 700 * 3.6,
      referenceCrossingSeconds: MILE_1_5 / 3.6,
      trace: addJitter(loop, 3, 'ar1', seed),
      validRun: true,
    },
    {
      name: 'many_turns',
      referenceMeters: 700 * 3.6,
      referenceCrossingSeconds: MILE_1_5 / 3.6,
      trace: addJitter(turns, 3, 'ar1', seed),
      validRun: true,
    },
    {
      name: 'out_and_back',
      referenceMeters: 700 * 3.6,
      referenceCrossingSeconds: MILE_1_5 / 3.6,
      trace: addJitter(outBack, 3, 'ar1', seed),
      validRun: true,
    },
    // Short run under heavy noise: noise inflation must never verify it.
    straightCase('short_run_noisy', seed, {
      durationSeconds: 620,
      speed: 3.6,
      jitterMeters: 4,
      jitterModel: 'white',
      accuracyAt: () => 12,
      validRun: false,
    }),
  ];
}

interface PipelineStats {
  pctErrors: number[];
}

interface VerdictStats {
  timeErrors: number[];
  falseVerifications: number;
  falseFailures: number;
  unableToVerify: number;
  verified: number;
  total: number;
  uncertaintyCovered: number;
  uncertaintyTotal: number;
}

function loadFixtures(): { name: string; referenceMeters: number; trace: RunTrace }[] {
  const dir = join(__dirname, 'fixtures');
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      const parsed = JSON.parse(readFileSync(join(dir, file), 'utf8')) as {
        referenceMeters: number;
        trace: RunTrace;
      };
      return { name: `fixture:${file}`, referenceMeters: parsed.referenceMeters, trace: parsed.trace };
    });
}

describe('run engine accuracy benchmark', () => {
  const distanceStats = new Map<string, Map<DistancePipelineId, PipelineStats>>();
  const verdictStats: VerdictStats = {
    timeErrors: [],
    falseVerifications: 0,
    falseFailures: 0,
    unableToVerify: 0,
    verified: 0,
    total: 0,
    uncertaintyCovered: 0,
    uncertaintyTotal: 0,
  };
  const fixtureRows: string[] = [];

  beforeAll(() => {
    for (const seed of SEEDS) {
      for (const benchmarkCase of buildCases(seed)) {
        // Distance error per candidate pipeline.
        const prepared = prepareSamples(benchmarkCase.trace.samples, RUN_RULESET);
        for (const pipeline of PIPELINES) {
          const measuredPath = measurePath(prepared.kept, pipeline, RUN_RULESET);
          const pctError =
            ((measuredPath.computedMeters - benchmarkCase.referenceMeters) /
              benchmarkCase.referenceMeters) *
            100;
          let byPipeline = distanceStats.get(benchmarkCase.name);
          if (!byPipeline) {
            byPipeline = new Map();
            distanceStats.set(benchmarkCase.name, byPipeline);
          }
          let stats = byPipeline.get(pipeline);
          if (!stats) {
            stats = { pctErrors: [] };
            byPipeline.set(pipeline, stats);
          }
          stats.pctErrors.push(pctError);
        }

        // Verdict + accepted-time behaviour for the SELECTED pipeline.
        const analysis = analyzeRun({
          trace: benchmarkCase.trace,
          requiredDistanceMeters: MILE_1_5,
          sessionWindow: { openedAtMs: T0 - 10_000, closedAtMs: T0 + 3_600_000 },
        });
        verdictStats.total += 1;
        if (analysis.verdict === 'verified') {
          verdictStats.verified += 1;
          if (!benchmarkCase.validRun || benchmarkCase.referenceMeters < MILE_1_5) {
            verdictStats.falseVerifications += 1;
          }
          if (
            benchmarkCase.referenceCrossingSeconds !== null &&
            analysis.acceptedTimeSeconds !== null
          ) {
            verdictStats.timeErrors.push(
              Math.abs(analysis.acceptedTimeSeconds - benchmarkCase.referenceCrossingSeconds),
            );
          }
        } else if (analysis.verdict === 'failed' && benchmarkCase.validRun) {
          verdictStats.falseFailures += 1;
        } else if (analysis.verdict === 'unable_to_verify') {
          verdictStats.unableToVerify += 1;
        }
        // Uncertainty calibration: does the bound cover the actual error?
        verdictStats.uncertaintyTotal += 1;
        if (
          Math.abs(analysis.computedDistanceMeters - benchmarkCase.referenceMeters) <=
          analysis.distanceUncertaintyMeters
        ) {
          verdictStats.uncertaintyCovered += 1;
        }
      }
    }

    for (const fixture of loadFixtures()) {
      const prepared = prepareSamples(fixture.trace.samples, RUN_RULESET);
      const measuredPath = measurePath(prepared.kept, RUN_RULESET.distancePipeline, RUN_RULESET);
      const pct =
        ((measuredPath.computedMeters - fixture.referenceMeters) / fixture.referenceMeters) * 100;
      fixtureRows.push(
        `| ${fixture.name} | ${fixture.referenceMeters.toFixed(0)} | ${measuredPath.computedMeters.toFixed(0)} | ${pct.toFixed(2)}% |`,
      );
    }
  });

  afterAll(() => {
    const lines: string[] = [
      '# Run Engine distance benchmark',
      '',
      `Ruleset v${RUN_RULESET.strideSeconds ? 2 : 1} · selected pipeline: **${RUN_RULESET.distancePipeline}** · ${SEEDS.length} seeds per condition.`,
      'Signed mean % error (positive = over-credit, the dangerous direction) / mean |%| error.',
      '',
      `| condition | ${PIPELINES.join(' | ')} |`,
      `|---|${PIPELINES.map(() => '---').join('|')}|`,
    ];
    for (const [condition, byPipeline] of distanceStats) {
      const cells = PIPELINES.map((pipeline) => {
        const stats = byPipeline.get(pipeline)!;
        const mean =
          stats.pctErrors.reduce((sum, value) => sum + value, 0) / stats.pctErrors.length;
        const meanAbs =
          stats.pctErrors.reduce((sum, value) => sum + Math.abs(value), 0) /
          stats.pctErrors.length;
        return `${mean >= 0 ? '+' : ''}${mean.toFixed(2)}% / ${meanAbs.toFixed(2)}%`;
      });
      lines.push(`| ${condition} | ${cells.join(' | ')} |`);
    }
    const meanTimeError =
      verdictStats.timeErrors.length > 0
        ? verdictStats.timeErrors.reduce((sum, value) => sum + value, 0) /
          verdictStats.timeErrors.length
        : null;
    lines.push(
      '',
      '## Verdict behaviour (selected pipeline)',
      '',
      `- assessments analysed: ${verdictStats.total}`,
      `- verified: ${verdictStats.verified} · unable_to_verify: ${verdictStats.unableToVerify}`,
      `- **false verifications: ${verdictStats.falseVerifications}**`,
      `- false failures (valid runs failed): ${verdictStats.falseFailures}`,
      `- accepted-time mean |error|: ${meanTimeError === null ? 'n/a' : `${meanTimeError.toFixed(1)}s`} (max ${verdictStats.timeErrors.length > 0 ? Math.max(...verdictStats.timeErrors).toFixed(1) : 'n/a'}s)`,
      `- uncertainty bound covered the true error in ${verdictStats.uncertaintyCovered}/${verdictStats.uncertaintyTotal} runs`,
      '',
    );
    if (fixtureRows.length > 0) {
      lines.push(
        '## Real device fixtures',
        '',
        '| fixture | reference m | computed m | error |',
        '|---|---|---|---|',
        ...fixtureRows,
        '',
      );
    }
    const outDir = join(__dirname, '../../../docs/benchmarks');
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'run-engine-v2.md'), lines.join('\n'));
  });

  it('the selected pipeline beats the v1 smoothing pipeline on worst-case noise', () => {
    const heavy = distanceStats.get('heavy_jitter_white')!;
    const v1 = heavy.get('smooth3')!.pctErrors.map(Math.abs);
    const selected = heavy.get(RUN_RULESET.distancePipeline)!.pctErrors.map(Math.abs);
    const mean = (values: number[]) =>
      values.reduce((sum, value) => sum + value, 0) / values.length;
    expect(mean(selected)).toBeLessThan(mean(v1));
  });

  it('mean absolute distance error stays within 1.5% across all conditions', () => {
    const all: number[] = [];
    for (const [, byPipeline] of distanceStats) {
      all.push(...byPipeline.get(RUN_RULESET.distancePipeline)!.pctErrors.map(Math.abs));
    }
    const mean = all.reduce((sum, value) => sum + value, 0) / all.length;
    expect(mean).toBeLessThanOrEqual(1.5);
    expect(Math.max(...all)).toBeLessThanOrEqual(4);
  });

  it('systematic bias is not meaningfully athlete-favouring', () => {
    // The signed mean across conditions must stay well inside the
    // uncertainty margin a verified run has to clear anyway (~1.5–2.5% of
    // the distance) — residual inflation can shave seconds, never conjure a
    // verification. Real-device calibration tightens this further.
    const all: number[] = [];
    for (const [, byPipeline] of distanceStats) {
      all.push(...byPipeline.get(RUN_RULESET.distancePipeline)!.pctErrors);
    }
    const mean = all.reduce((sum, value) => sum + value, 0) / all.length;
    expect(mean).toBeLessThanOrEqual(0.5);
  });

  it('records zero false verifications', () => {
    expect(verdictStats.falseVerifications).toBe(0);
  });

  it('never fails a valid run in benchmark conditions', () => {
    expect(verdictStats.falseFailures).toBe(0);
  });

  it('accepted-time error stays bounded for verified runs', () => {
    // Time error is distance error expressed at the crossing pace: ~1% of
    // an 11-minute run is ~7s, which is what GPS supports without map
    // matching. The analysis reports acceptedTimeUncertaintySeconds beside
    // the value so the bound is visible, not hidden.
    expect(verdictStats.timeErrors.length).toBeGreaterThan(0);
    const mean =
      verdictStats.timeErrors.reduce((sum, value) => sum + value, 0) /
      verdictStats.timeErrors.length;
    expect(mean).toBeLessThanOrEqual(8);
    expect(Math.max(...verdictStats.timeErrors)).toBeLessThanOrEqual(25);
  });

  it('the uncertainty bound covers the true error in at least 90% of runs', () => {
    expect(
      verdictStats.uncertaintyCovered / verdictStats.uncertaintyTotal,
    ).toBeGreaterThanOrEqual(0.9);
  });
});
