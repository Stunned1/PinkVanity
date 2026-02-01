"use client";

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'wf_listen_only';

type ListenOnlyState = {
  readonly listenOnly: boolean;
  readonly setListenOnly: (next: boolean) => void;
  readonly toggleListenOnly: () => void;
};

const ListenOnlyContext = createContext<ListenOnlyState | null>(null);

export function ListenOnlyProvider(props: { readonly children: ReactNode }) {
  const [listenOnly, setListenOnlyState] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw == null) return;
      setListenOnlyState(raw === 'true');
    } catch {
      // ignore
    }
  }, []);

  const setListenOnly = useCallback((next: boolean) => {
    setListenOnlyState(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // ignore
    }
  }, []);

  const toggleListenOnly = useCallback(() => {
    setListenOnly(!listenOnly);
  }, [listenOnly, setListenOnly]);

  const value = useMemo(
    () => ({ listenOnly, setListenOnly, toggleListenOnly }),
    [listenOnly, setListenOnly, toggleListenOnly]
  );

  return <ListenOnlyContext.Provider value={value}>{props.children}</ListenOnlyContext.Provider>;
}

export function useListenOnly(): ListenOnlyState {
  const ctx = useContext(ListenOnlyContext);
  if (!ctx) {
    throw new Error('useListenOnly must be used within ListenOnlyProvider');
  }
  return ctx;
}

