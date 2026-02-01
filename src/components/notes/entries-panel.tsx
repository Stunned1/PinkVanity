"use client";

import { useEffect, useState } from 'react';

import type { JournalEntry } from '@/types/journal-entry.types';

function formatEntryDate(entryDate: string): string {
  // Hackathon-friendly: if ISO, show a nicer label; otherwise fall back.
  if (/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
    const [y, m, d] = entryDate.split('-').map(Number);
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
    return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  return entryDate;
}

export function EntriesPanel(props: {
  readonly notes: readonly JournalEntry[];
  readonly selectedNoteId: string | null;
  readonly onSelect: (noteId: string) => void;
  readonly onCreate: () => void;
  readonly onDelete: (noteId: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(props.selectedNoteId);

  useEffect(() => {
    setOpenId(props.selectedNoteId);
  }, [props.selectedNoteId]);

  return (
    <div className="p-4">
      <div className="flex items-center justify-end">
        <button
          className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-700"
          onClick={props.onCreate}
          type="button"
        >
          New entry
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {props.notes.map((note) => {
          const isOpen = note.id === openId;
          const isSelected = note.id === props.selectedNoteId;

          return (
            <div
              key={note.id}
              className={[
                'overflow-hidden rounded-xl border',
                isSelected ? 'border-zinc-700 bg-zinc-900/20' : 'border-zinc-900'
              ].join(' ')}
            >
              <button
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-zinc-900/20"
                onClick={() => setOpenId((prev) => (prev === note.id ? null : note.id))}
                type="button"
              >
                <div className="text-sm font-medium text-zinc-100">
                  {formatEntryDate(note.entryDate)}
                </div>
                <div className="text-xs text-zinc-500">{isOpen ? 'Hide' : 'Show'}</div>
              </button>

              <div
                className={[
                  'grid transition-[grid-template-rows] duration-300 ease-out',
                  isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                ].join(' ')}
              >
                <div className="overflow-hidden border-t border-zinc-900 px-3 py-2">
                  <div className="text-xs text-zinc-500">
                    {note.body.trim().length > 0 ? note.body.trim().slice(0, 140) : 'Empty entry'}
                    {note.body.trim().length > 140 ? '…' : ''}
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <button
                      className="text-xs font-medium text-zinc-200 hover:text-zinc-50"
                      onClick={() => props.onSelect(note.id)}
                      type="button"
                    >
                      Open
                    </button>
                    <button
                      className="text-xs text-zinc-500 hover:text-zinc-200"
                      onClick={() => props.onDelete(note.id)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

