import { useFonts } from 'expo-font';

/**
 * Loads the type system.
 *
 * Note the per-weight import paths. Importing from a family root
 * (`@expo-google-fonts/ibm-plex-mono`) pulls that package's index, which
 * requires *every* weight and italic it ships. Doing that for three families
 * put 6.6MB of fonts into the bundle, almost all of it faces the app never
 * renders. Naming each weight brings in only the six the theme uses.
 */
import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono/400Regular';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono/500Medium';
import { IBMPlexSansCondensed_600SemiBold } from '@expo-google-fonts/ibm-plex-sans-condensed/600SemiBold';
import { IBMPlexSansCondensed_700Bold } from '@expo-google-fonts/ibm-plex-sans-condensed/700Bold';
import { IBMPlexSans_400Regular } from '@expo-google-fonts/ibm-plex-sans/400Regular';
import { IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans/600SemiBold';

/**
 * Returns false until the faces are ready. The root layout holds the splash on
 * that, so text never paints once in a fallback face and then reflows into the
 * real one.
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    IBMPlexSansCondensed_600SemiBold,
    IBMPlexSansCondensed_700Bold,
    IBMPlexSans_400Regular,
    IBMPlexSans_600SemiBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });

  // A font that fails to load must not hold the app hostage. React Native
  // falls back to the system face, which is worse looking but entirely usable.
  return loaded || error !== null;
}
