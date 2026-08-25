import { Easing } from 'react-native-reanimated';

/**
 * Motion is calm and short. The app should never feel like it is performing
 * for the athlete — transitions confirm state changes and get out of the way.
 */
export const motion = {
  duration: {
    instant: 90,
    fast: 160,
    normal: 240,
    slow: 380,
    /** Count-ups and ring fills — long enough to read, short enough to respect. */
    reveal: 900,
  },
  easing: {
    standard: Easing.bezier(0.22, 1, 0.36, 1),
    entrance: Easing.out(Easing.cubic),
    exit: Easing.in(Easing.cubic),
  },
} as const;

export type Motion = typeof motion;
