import { Redirect } from 'expo-router';

/**
 * Boot gate. Today it forwards straight to the app shell.
 *
 * This is the single place that will decide between the auth stack, the
 * onboarding stack and the tabs once session and profile hydration exist,
 * which is why it is a route rather than logic inside the root layout.
 */
export default function BootScreen() {
  return <Redirect href="/(tabs)" />;
}
