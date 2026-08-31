import { View } from 'react-native';
import Svg, { Line, Polyline, Rect } from 'react-native-svg';

import { Text } from '@/components/primitives/Text';
import { CALISTHENICS_RULESET } from '@/domain/calisthenicsEngine/ruleset';
import type {
  BarReference,
  PullUpDiagnostics,
  RepRecord,
} from '@/domain/calisthenicsEngine/types';
import { useTheme } from '@/theme';

/**
 * The analyzer's signals over time, drawn so a human can look at any
 * decision and see why: chin clearance against the bar, elbow angle against
 * the extension/start thresholds, hip sway, landmark visibility — with rep
 * boundaries and machine phases overlaid on every chart.
 */

const CHART_HEIGHT = 72;
const PHASE_COLORS: Record<string, string> = {
  seeking: '#555f6b',
  hang: '#3b7dd8',
  pull: '#4dc38f',
  return: '#c9a13d',
  blind: '#c95f5f',
};

interface ChartProps {
  title: string;
  points: { tMs: number; value: number | null }[];
  durationMs: number;
  /** Value range; values outside are clamped visually. */
  min: number;
  max: number;
  thresholds?: { value: number; label: string }[];
  reps: readonly RepRecord[];
  invert?: boolean;
}

function Chart({ title, points, durationMs, min, max, thresholds = [], reps, invert }: ChartProps) {
  const theme = useTheme();
  const width = 640;

  const x = (tMs: number) => (tMs / Math.max(1, durationMs)) * width;
  const y = (value: number) => {
    const clamped = Math.min(max, Math.max(min, value));
    const fraction = (clamped - min) / (max - min);
    return invert ? fraction * CHART_HEIGHT : (1 - fraction) * CHART_HEIGHT;
  };

  const segments: string[] = [];
  let current: string[] = [];
  for (const point of points) {
    if (point.value === null) {
      if (current.length > 1) {
        segments.push(current.join(' '));
      }
      current = [];
    } else {
      current.push(`${x(point.tMs).toFixed(1)},${y(point.value).toFixed(1)}`);
    }
  }
  if (current.length > 1) {
    segments.push(current.join(' '));
  }

  return (
    <View style={{ gap: theme.spacing.xxs }}>
      <Text variant="labelSm" color="textTertiary">
        {title}
      </Text>
      <View style={{ overflow: 'hidden', borderRadius: theme.radii.sm }}>
        <Svg
          width="100%"
          height={CHART_HEIGHT}
          viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
        >
          <Rect x={0} y={0} width={width} height={CHART_HEIGHT} fill={theme.colors.backgroundSunken} />
          {reps.map((rep) => (
            <Rect
              key={rep.repNumber}
              x={x(rep.startMs)}
              y={0}
              width={Math.max(1, x(rep.endMs) - x(rep.startMs))}
              height={CHART_HEIGHT}
              fill={
                rep.verdict === 'valid'
                  ? 'rgba(77,195,143,0.12)'
                  : rep.verdict === 'invalid'
                    ? 'rgba(201,95,95,0.14)'
                    : 'rgba(201,161,61,0.14)'
              }
            />
          ))}
          {thresholds.map((threshold) => (
            <Line
              key={threshold.label}
              x1={0}
              x2={width}
              y1={y(threshold.value)}
              y2={y(threshold.value)}
              stroke={theme.colors.accent}
              strokeDasharray="6 5"
              strokeWidth={1}
            />
          ))}
          {segments.map((pointsString, index) => (
            <Polyline
              key={index}
              points={pointsString}
              fill="none"
              stroke={theme.colors.textPrimary}
              strokeWidth={1.5}
            />
          ))}
        </Svg>
      </View>
    </View>
  );
}

export interface SignalChartsProps {
  diagnostics: PullUpDiagnostics;
  bar: BarReference | null;
  reps: readonly RepRecord[];
  durationMs: number;
}

export function SignalCharts({ diagnostics, bar, reps, durationMs }: SignalChartsProps) {
  const theme = useTheme();
  const frames = diagnostics.frames;

  const hipValues = frames
    .map((frame) => frame.hipX)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  const hipMedian = hipValues[Math.floor(hipValues.length / 2)] ?? 0;

  return (
    <View style={{ gap: theme.spacing.md }}>
      {bar ? (
        <Chart
          title={`CHIN CLEARANCE vs BAR (line = required ±${(
            Math.max(
              CALISTHENICS_RULESET.chinClearanceFloor,
              CALISTHENICS_RULESET.chinClearanceUncertaintyMultiple * bar.uncertainty,
            ) * 1000
          ).toFixed(0)}mu)`}
          points={frames.map((frame) => ({
            tMs: frame.tMs,
            value: frame.chinY === null ? null : bar.lineY - frame.chinY,
          }))}
          durationMs={durationMs}
          min={-0.2}
          max={0.1}
          thresholds={[
            {
              value: Math.max(
                CALISTHENICS_RULESET.chinClearanceFloor,
                CALISTHENICS_RULESET.chinClearanceUncertaintyMultiple * bar.uncertainty,
              ),
              label: 'required',
            },
            { value: 0, label: 'bar' },
          ]}
          reps={reps}
        />
      ) : null}

      <Chart
        title="ELBOW ANGLE (dashed: extension 160° / start-pull 140°)"
        points={frames.map((frame) => ({ tMs: frame.tMs, value: frame.angleDeg }))}
        durationMs={durationMs}
        min={30}
        max={185}
        thresholds={[
          { value: CALISTHENICS_RULESET.extensionAngleDeg, label: 'extension' },
          { value: CALISTHENICS_RULESET.startPullAngleDeg, label: 'start' },
        ]}
        reps={reps}
      />

      <Chart
        title="HIP SWAY (relative to median)"
        points={frames.map((frame) => ({
          tMs: frame.tMs,
          value: frame.hipX === null ? null : frame.hipX - hipMedian,
        }))}
        durationMs={durationMs}
        min={-0.12}
        max={0.12}
        thresholds={[{ value: 0, label: 'center' }]}
        reps={reps}
      />

      <Chart
        title="CORE LANDMARK VISIBILITY"
        points={frames.map((frame) => ({ tMs: frame.tMs, value: frame.coreVisibility }))}
        durationMs={durationMs}
        min={0}
        max={1}
        thresholds={[
          { value: CALISTHENICS_RULESET.repVisibilityFloor, label: 'rep floor' },
          { value: CALISTHENICS_RULESET.framingVisibilityFloor, label: 'framing floor' },
        ]}
        reps={reps}
      />

      {/* State machine strip. */}
      <View style={{ gap: theme.spacing.xxs }}>
        <Text variant="labelSm" color="textTertiary">
          STATE MACHINE (blue hang · green pull · gold return · red blind)
        </Text>
        <View style={{ overflow: 'hidden', borderRadius: theme.radii.sm }}>
          <Svg width="100%" height={14} viewBox={`0 0 640 14`} preserveAspectRatio="none">
            {frames.map((frame, index) => {
              const next = frames[index + 1];
              const x1 = (frame.tMs / Math.max(1, durationMs)) * 640;
              const x2 = ((next?.tMs ?? durationMs) / Math.max(1, durationMs)) * 640;
              return (
                <Rect
                  key={frame.tMs}
                  x={x1}
                  y={0}
                  width={Math.max(0.5, x2 - x1)}
                  height={14}
                  fill={PHASE_COLORS[frame.phase] ?? '#333'}
                />
              );
            })}
          </Svg>
        </View>
      </View>
    </View>
  );
}
