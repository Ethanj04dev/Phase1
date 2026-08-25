import { PlaceholderScreen } from '@/components/feedback/PlaceholderScreen';

export default function ProgressScreen() {
  return (
    <PlaceholderScreen
      testID="progress-screen"
      title="Progress"
      summary="Assessments, personal records, and whether the work is moving the numbers."
      upcoming={[
        'Personal records across every measured event',
        'Assessment entry and full result history',
        'Trend charts for run, swim and calisthenics',
        'Readiness history over time',
        'Weekly training volume and consistency',
      ]}
    />
  );
}
