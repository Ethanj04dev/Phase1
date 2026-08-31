/**
 * Minimal typing for the one react-native-web API the web-only review
 * tooling uses: rendering raw DOM elements (video, canvas, file input)
 * inside the react-native-web tree.
 */
declare module 'react-native-web' {
  import type { ReactElement } from 'react';

  export function unstable_createElement(
    type: string,
    props?: Record<string, unknown>,
  ): ReactElement;
}
