import { useCallback, useEffect, useState } from 'react';

import type { DomainError, Result } from '@/domain/types';

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: DomainError }
  | { status: 'success'; data: T };

export interface AsyncResource<T> {
  state: AsyncState<T>;
  reload: () => void;
}

const UNEXPECTED_ERROR: DomainError = {
  code: 'unknown',
  message: 'Something went wrong. Please try again.',
};

/**
 * Minimal async data hook for repository calls.
 *
 * This is deliberately small rather than a query library. Once Supabase is
 * wired up and screens start sharing cached server state across tabs, this is
 * the seam to replace with TanStack Query -- the AsyncState shape maps onto it
 * directly, so components would not change.
 *
 * `fetcher` must be stable (wrap it in useCallback at the call site).
 */
export function useAsyncResource<T>(fetcher: () => Promise<Result<T>>): AsyncResource<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);

  // Resetting to loading happens here, in an event handler, rather than in the
  // effect body. Setting state synchronously inside the effect would trigger a
  // second render pass on every fetch.
  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetcher()
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.ok) {
          setState({ status: 'success', data: result.value });
        } else {
          setState({ status: 'error', error: result.error });
        }
      })
      .catch((cause: unknown) => {
        if (cancelled) {
          return;
        }
        // Repositories are expected to return Results; reaching here means an
        // unhandled throw, which is a bug rather than a user-facing condition.
        setState({ status: 'error', error: { ...UNEXPECTED_ERROR, cause } });
      });

    return () => {
      cancelled = true;
    };
  }, [fetcher, reloadToken]);

  return { state, reload };
}
