import { Card } from '@/components/primitives/Card';
import { Text } from '@/components/primitives/Text';
import type { ReviewEvidenceItem } from '@/data/repositories/types';
import { useTheme } from '@/theme';

/**
 * Native fallback: pose extraction and the diagnostic workbench run in the
 * web review console (and, on the promotion path, in the server worker) —
 * never on candidate devices.
 */

export interface PoseAnalysisPanelProps {
  mode:
    | { kind: 'evidence'; attemptId: string; eventId: 'pull_ups'; evidence: ReviewEvidenceItem }
    | { kind: 'local' };
}

export function PoseAnalysisPanel(_props: PoseAnalysisPanelProps) {
  const theme = useTheme();
  return (
    <Card style={{ gap: theme.spacing.sm }}>
      <Text variant="labelSm" color="accent">
        POSE ANALYSIS
      </Text>
      <Text variant="bodySm" color="textSecondary">
        Landmark extraction and the diagnostic workbench run in the web review console.
        Open this attempt in a browser to analyze and label it.
      </Text>
    </Card>
  );
}
