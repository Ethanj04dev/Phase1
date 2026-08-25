import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import type { AsyncState } from '@/lib/useAsyncResource';
import { useTheme } from '@/theme';

export interface AsyncBoundaryProps<T> {
  state: AsyncState<T>;
  onRetry: () => void;
  /** Rendered when the request succeeds but returns nothing to show. */
  empty?: { title: string; body: string };
  isEmpty?: (data: T) => boolean;
  children: (data: T) => ReactNode;
}

/**
 * Renders the loading, error, empty and success states of a request in one
 * place, so no screen has to remember all four.
 */
export function AsyncBoundary<T>({
  state,
  onRetry,
  empty,
  isEmpty,
  children,
}: AsyncBoundaryProps<T>) {
  const theme = useTheme();

  if (state.status === 'loading') {
    return (
      <View
        accessibilityLabel="Loading"
        style={{ paddingVertical: theme.spacing.xxxl, alignItems: 'center' }}
      >
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={{ paddingVertical: theme.spacing.xxl, gap: theme.spacing.lg }}>
        <Text variant="label" color="statusOffTarget">
          Unable to load
        </Text>
        <Text variant="body" color="textSecondary">
          {state.error.message}
        </Text>
        <Button label="Try again" variant="secondary" fullWidth={false} onPress={onRetry} />
      </View>
    );
  }

  if (empty && isEmpty?.(state.data)) {
    return (
      <View style={{ paddingVertical: theme.spacing.xxl, gap: theme.spacing.sm }}>
        <Text variant="label" color="textTertiary">
          {empty.title}
        </Text>
        <Text variant="body" color="textSecondary">
          {empty.body}
        </Text>
      </View>
    );
  }

  return <>{children(state.data)}</>;
}
