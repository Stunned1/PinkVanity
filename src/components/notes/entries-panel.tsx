"use client";

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
  readonly onDelete: (noteId: string) => void;
}) {
  return (
    <div className="divide-y divide-zinc-900">
        {props.notes.map((note) => {
          const isSelected = note.id === props.selectedNoteId;

          return (
            <div
              key={note.id}
              className={[
                'group',
                isSelected ? 'bg-zinc-900/20' : 'bg-transparent hover:bg-zinc-900/10'
              ].join(' ')}
            onClick={() => props.onSelect(note.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                props.onSelect(note.id);
              }
            }}
            role="button"
            tabIndex={0}
            >
              <div className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="text-sm font-medium text-zinc-100">
                  {formatEntryDate(note.entryDate)}
                </div>

              <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    className="text-xs text-zinc-500 hover:text-zinc-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onDelete(note.id);
                  }}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-200 ease-out group-hover:grid-rows-[1fr]">
                <div className="overflow-hidden px-5 pb-3">
                  <div className="text-xs text-zinc-500">
                    {note.body.trim().length > 0 ? note.body.trim().slice(0, 140) : 'Empty entry'}
                    {note.body.trim().length > 140 ? '…' : ''}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
    </div>
  );
}

