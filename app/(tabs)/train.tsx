import { PlaceholderScreen } from '@/components/feedback/PlaceholderScreen';

export default function TrainScreen() {
  return (
    <PlaceholderScreen
      testID="train-screen"
      title="Train"
      summary="Your program, the week ahead, and the session you are in right now."
      upcoming={[
        'Program overview with track and week structure',
        'Training calendar for the current week',
        'Workout overview with personalised targets',
        'Active workout with rep-by-rep logging',
        'Session complete summary',
      ]}
    />
  );
}
