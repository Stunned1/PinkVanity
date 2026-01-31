"use client";

import type { Note } from '@/types/note.types';

export function EntriesPanel(props: {
  readonly notes: readonly Note[];
  readonly selectedNoteId: string | null;
  readonly onSelect: (noteId: string) => void;
  readonly onCreate: () => void;
  readonly onDelete: (noteId: string) => void;
  readonly onClose: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-900 px-5 py-4">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Entries</div>
          <div className="mt-1 text-sm text-zinc-400">{props.notes.length} total</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-700"
            onClick={props.onCreate}
            type="button"
          >
            New
          </button>
          <button
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-700"
            onClick={props.onClose}
            type="button"
          >
            Close
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {props.notes.map((note) => {
            const isSelected = note.id === props.selectedNoteId;
            return (
              <div
                key={note.id}
                className={[
                  'group rounded-2xl border p-4',
                  isSelected
                    ? 'border-zinc-700 bg-zinc-900/30'
                    : 'border-zinc-900 hover:border-zinc-800 hover:bg-zinc-900/20'
                ].join(' ')}
              >
                <button
                  className="block w-full text-left"
                  onClick={() => props.onSelect(note.id)}
                  type="button"
                >
                  <div className="text-sm font-semibold text-zinc-100">{note.title}</div>
                  <div className="mt-1 text-xs text-zinc-500">Tap to open</div>
                </button>

                <div className="mt-3 flex justify-end">
                  <button
                    className="text-xs text-zinc-500 opacity-0 hover:text-zinc-200 group-hover:opacity-100"
                    onClick={() => props.onDelete(note.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

