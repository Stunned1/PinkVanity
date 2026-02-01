"use client";

import { useListenOnly } from '@/components/settings/listen-only-provider';

export function ListenOnlyToggle() {
  const { listenOnly, toggleListenOnly } = useListenOnly();

  return (
    <button
      className={[
        'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs',
        listenOnly
          ? 'border-amber-700/50 bg-amber-950/20 text-amber-200'
          : 'border-zinc-800 bg-zinc-950 text-zinc-200',
        'hover:border-zinc-700'
      ].join(' ')}
      onClick={toggleListenOnly}
      type="button"
    >
      <span className="font-medium">Listen-only</span>
      <span className={listenOnly ? 'text-amber-300' : 'text-zinc-500'}>{listenOnly ? 'On' : 'Off'}</span>
    </button>
  );
}

