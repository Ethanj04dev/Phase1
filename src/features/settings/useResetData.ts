import { useCallback, useState } from 'react';

import { clearAllRecords } from '@/data/local/storage';

/**
 * Wipes every local record.
 *
 * Destructive and unrecoverable, so the UI gates it behind an explicit
 * confirmation rather than a single tap. It exists because testing onboarding
 * repeatedly is otherwise impossible, and because an athlete who wants to
 * start over should not have to delete the app.
 *
 * This clears local storage only. Once Supabase owns the data in M8 this
 * becomes a server-side deletion and will need a stronger confirmation still.
 */
export function useResetData() {
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(async (): Promise<boolean> => {
    setResetting(true);
    setError(null);

    const cleared = await clearAllRecords();
    setResetting(false);

    if (!cleared.ok) {
      setError(cleared.error.message);
      return false;
    }
    return true;
  }, []);

  return { reset, resetting, error };
}
