'use client';

import { useState } from 'react';
import type { Paginated } from './types';
import { useApi } from './useApi';

interface FocusedListOptions<S extends string, T> {
  /** Cache-key prefix, e.g. 'affiliates'. */
  name: string;
  /** The tab with the user's to-do items, e.g. pending applications. */
  focus: S;
  fetchList: (status: S | 'all') => Promise<Paginated<T>>;
}

/**
 * A status-filtered list that opens on the `focus` tab when it has items and on
 * "All" otherwise. The focus list is fetched straight away and doubles as the
 * "is there anything to do?" check, so a busy queue costs one request. Once the
 * user picks a tab, that choice sticks.
 */
export function useFocusedList<S extends string, T>({ name, focus, fetchList }: FocusedListOptions<S, T>) {
  const [chosen, setChosen] = useState<S | 'all' | null>(null);

  const focusList = useApi(`${name}:${focus}`, () => fetchList(focus));
  const autoStatus: S | 'all' = focusList.error || focusList.data?.total === 0 ? 'all' : focus;
  const status = chosen ?? autoStatus;

  const otherList = useApi(`${name}:view:${status}`, () => (status === focus ? Promise.resolve(null) : fetchList(status)));
  const current = status === focus ? focusList : otherList;

  // Reload both, so the focus check stays current after an action.
  const reload = async () => {
    await Promise.all([focusList.reload(), status === focus ? undefined : otherList.reload()]);
  };

  return {
    status,
    setStatus: setChosen,
    data: current.data,
    error: current.error,
    loading: current.loading,
    reload,
    /** True when the page fell back to "All" because the focus list couldn't be loaded. */
    focusCheckFailed: chosen === null && status !== focus && Boolean(focusList.error),
  };
}
