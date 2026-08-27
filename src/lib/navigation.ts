import { router } from 'expo-router';

type Href = Parameters<typeof router.replace>[0];

/**
 * Returns the athlete to where they came from, or somewhere sensible.
 *
 * `router.back()` alone is a quiet trap. It does nothing when there is no
 * history, which is exactly the case for a deep link, a notification tap, or a
 * screen reached directly during development -- so a save appears to succeed
 * and then strands the athlete on the screen they just finished with. The
 * fallback is the screen the work belongs to.
 */
export function goBack(fallback: Href): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}
