'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from './api';

interface ApiState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
}

interface Loaded<T> {
  key: string;
  data: T | null;
  error: string | null;
}

/**
 * Loads data for `key` and reloads whenever the key changes (put every input
 * of `fetcher` into the key, e.g. `commissions:${status}`). `reload` refetches
 * after a mutation. Responses for an outdated request are ignored.
 */
export function useApi<T>(key: string, fetcher: () => Promise<T>): ApiState<T> {
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null);
  const [reloading, setReloading] = useState(false);
  const fetcherRef = useRef(fetcher);
  const latestRequest = useRef(0);

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const run = useCallback(async (forKey: string) => {
    const requestId = ++latestRequest.current;
    try {
      const data = await fetcherRef.current();
      if (requestId === latestRequest.current) setLoaded({ key: forKey, data, error: null });
    } catch (err) {
      if (requestId === latestRequest.current) {
        setLoaded((previous) => ({ key: forKey, data: previous?.key === forKey ? previous.data : null, error: errorMessage(err) }));
      }
    }
  }, []);

  useEffect(() => {
    void run(key);
  }, [key, run]);

  const reload = useCallback(async () => {
    setReloading(true);
    try {
      await run(key);
    } finally {
      setReloading(false);
    }
  }, [key, run]);

  const current = loaded?.key === key ? loaded : null;
  return { data: current?.data ?? null, error: current?.error ?? null, loading: !current || reloading, reload };
}
