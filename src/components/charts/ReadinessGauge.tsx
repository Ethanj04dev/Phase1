import { View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { Text } from '@/components/primitives/Text';
import { useTheme } from '@/theme';

import {
  GAUGE_START_DEGREES,
  gapTickAngles,
  gaugeArcPath,
  gaugeArcs,
  pointOnGauge,
} from './gaugeGeometry';

export interface ReadinessGaugeProps {
  /** 0–100, renormalised over measured weight. */
  score: number;
  /** 0–1: share of the target's weighted profile backed by real data. */
  coverage: number;
  /** Reads under the score, e.g. the band label. */
  caption?: string;
  /** Rendered size in points. */
  size?: number;
  accessibilityLabel: string;
}

const VIEWBOX = 100;
const CENTER = VIEWBOX / 2;
const RADIUS = 44;
const STROKE = 6;
/** Gap ticks reach inward from the track line. */
const TICK_LENGTH = 4;

/**
 * The honest gauge — the signature visual of the product.
 *
 * The arc's length is coverage; the accent fill is the score within it. The
 * unmeasured remainder is not empty space but a faintly ticked gap: the part
 * of the instrument that does not exist yet. Measuring a new domain visibly
 * completes the gauge, which makes "measure yourself honestly" the action the
 * interface rewards.
 *
 * Every ring in every competitor's app is always complete. This one cannot
 * be, structurally, because the scoring model refuses to invent a number for
 * a domain with no data — and the gauge is that refusal made visible.
 */
export function ReadinessGauge({
  score,
  coverage,
  caption,
  size = 220,
  accessibilityLabel,
}: ReadinessGaugeProps) {
  const theme = useTheme();
  const arcs = gaugeArcs(score, coverage);

  const trackPath = gaugeArcPath(CENTER, RADIUS, GAUGE_START_DEGREES, arcs.measuredSweep);
  const fillPath = gaugeArcPath(CENTER, RADIUS, GAUGE_START_DEGREES, arcs.scoreSweep);
  const ticks = gapTickAngles(arcs.gapSweep);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{ width: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
        {/*
          The phosphor: the score stroke drawn once underneath itself, wider
          and faint. This is the screen's single permitted glow, and it sits
          on the live data stroke — never on text.
        */}
        {fillPath ? (
          <Path
            d={fillPath}
            stroke={theme.colors.glowAccent}
            strokeWidth={STROKE * 2.2}
            strokeLinecap="round"
            fill="none"
          />
        ) : null}

        {/* The measured instrument: empty track, then the score fill. */}
        {trackPath ? (
          <Path
            d={trackPath}
            stroke={theme.colors.trackEmpty}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
          />
        ) : null}
        {fillPath ? (
          <Path
            d={fillPath}
            stroke={theme.colors.accent}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
          />
        ) : null}

        {/* The missing part of the instrument, ticked rather than blank. */}
        {ticks.map((angle) => {
          const outer = pointOnGauge(CENTER, RADIUS + STROKE / 2, angle);
          const inner = pointOnGauge(CENTER, RADIUS + STROKE / 2 - TICK_LENGTH, angle);
          return (
            <Line
              key={angle.toFixed(2)}
              x1={outer.x}
              y1={outer.y}
              x2={inner.x}
              y2={inner.y}
              stroke={theme.colors.borderStrong}
              strokeWidth={1.1}
            />
          );
        })}
      </Svg>

      {/* The number, dead centre, at arm's-length size. */}
      <View
        style={{
          position: 'absolute',
          alignItems: 'center',
          gap: theme.spacing.xxs,
        }}
      >
        <Text
          variant="display"
          style={{ fontSize: size * 0.32, lineHeight: size * 0.34 }}
        >
          {Math.round(score)}
        </Text>
        {caption ? (
          <Text variant="bodySm" color="accent">
            {caption}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
