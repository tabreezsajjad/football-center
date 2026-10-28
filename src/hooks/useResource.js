import { useEffect, useState } from 'react';
import { watchResource } from '../api/resourceWatcher';

export function useResource(loader, key, refreshMs = 0) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ key: null, data: null, error: null });

  useEffect(() => {
    if (key === null) return;

    return watchResource({
      interval: refreshMs,
      load: (signal) => loader(key, { signal }),
      onStart: () =>
        setState((previous) => ({
          ...(previous.key === key ? previous : { data: null, checkedAt: null }),
          key,
          error: null,
          refreshing: true,
        })),
      onSuccess: (data, checkedAt) =>
        setState({ key, data, checkedAt, error: null, refreshing: false }),
      onError: (error) =>
        setState((previous) => ({
          ...(previous.key === key ? previous : { data: null, checkedAt: null }),
          key,
          error,
          refreshing: false,
        })),
    });
  }, [loader, key, attempt, refreshMs]);

  const current = state.key === key ? state : { data: null, error: null };
  return {
    ...current,
    refreshMs,
    loading: key !== null && !current.data && !current.error,
    retry: () => {
      if (current.refreshing || current.error?.retryAt > Date.now()) return;
      setAttempt((value) => value + 1);
    },
  };
}
