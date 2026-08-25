import { View } from 'react-native';

import { useTheme } from '@/theme';

export type ProgressTone = 'accent' | 'onTarget' | 'caution' | 'offTarget' | 'neutral';

export interface ProgressBarProps {
  /** 0–1. Values outside the range are clamped. */
  value: number;
  tone?: ProgressTone;
  height?: number;
  /** Announced to screen readers, e.g. "Swimming readiness". */
  accessibilityLabel?: string;
}

export function ProgressBar({
  value,
  tone = 'accent',
  height = 4,
  accessibilityLabel,
}: ProgressBarProps) {
  const theme = useTheme();
  const clamped = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

  const fillColor = {
    accent: theme.colors.accent,
    onTarget: theme.colors.statusOnTarget,
    caution: theme.colors.statusCaution,
    offTarget: theme.colors.statusOffTarget,
    neutral: theme.colors.textTertiary,
  }[tone];

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: theme.colors.trackEmpty,
        overflow: 'hidden',
        flexDirection: 'row',
      }}
    >
      {/* Flex ratios avoid percentage-string widths and animate cleanly later. */}
      <View style={{ flex: clamped, backgroundColor: fillColor }} />
      <View style={{ flex: 1 - clamped }} />
    </View>
  );
}
