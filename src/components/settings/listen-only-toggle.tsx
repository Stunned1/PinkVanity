"use client";

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'wf_listen_only';

export function ListenOnlyToggle() {
  const [listenOnly, setListenOnly] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw == null) return;
      setListenOnly(raw === 'true');
    } catch {
      // ignore
    }
  }, []);

  function toggle() {
    setListenOnly((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  return (
    <button
      className={[
        'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs',
        listenOnly ? 'border-amber-700/50 bg-amber-950/20 text-amber-200' : 'border-zinc-800 bg-zinc-950 text-zinc-200',
        'hover:border-zinc-700'
      ].join(' ')}
      onClick={toggle}
      type="button"
    >
      <span className="font-medium">Listen-only</span>
      <span className={listenOnly ? 'text-amber-300' : 'text-zinc-500'}>{listenOnly ? 'On' : 'Off'}</span>
    </button>
  );
}

