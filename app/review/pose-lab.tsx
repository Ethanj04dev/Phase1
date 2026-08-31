import { Screen } from '@/components/layout/Screen';
import { PoseAnalysisPanel } from '@/features/verification/PoseAnalysisPanel';
import { useTheme } from '@/theme';

/**
 * Pose Lab — run the full extraction + analysis pipeline on a local video
 * file, with every diagnostic view, and nothing stored. This is how real
 * phone footage answers M3C-2's question before any verified session
 * exists: can real Zero Phase pull-up footage become landmark streams good
 * enough for the analyzer to judge?
 */
export default function PoseLabScreen() {
  const theme = useTheme();
  return (
    <Screen
      scroll
      testID="pose-lab"
      contentContainerStyle={{
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
    >
      <PoseAnalysisPanel mode={{ kind: 'local' }} />
    </Screen>
  );
}
