"use client";

import type { ReactNode } from 'react';

import type { JournalEntry } from '@/types/journal-entry.types';
import { PromptsDrawer } from '@/components/notes/prompts-drawer';

export function NoteEditor(props: {
  readonly note: JournalEntry | null;
  readonly emptyStateText?: string;
  readonly entriesCount: number;
  readonly isEntriesOpen: boolean;
  readonly onToggleEntries: () => void;
  readonly onCreateEntry?: () => void;
  readonly showDevCreate?: boolean;
  readonly entriesPanel: ReactNode;
  readonly onChange: (next: { readonly body: string }) => void;
  readonly onChangeAnswers: (next: { readonly p1Answer: string; readonly p2Answer: string }) => void;
}) {
  return (
    <section className="flex min-h-[70vh] flex-col">
      <div className="border-b border-zinc-900 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <button
            className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left hover:opacity-90"
            onClick={props.onToggleEntries}
            type="button"
          >
            <div className="truncate text-sm font-semibold tracking-tight text-zinc-100">
              Previous Entries
            </div>
            <div className="shrink-0 text-sm text-zinc-400">{props.entriesCount}</div>
          </button>

          {props.showDevCreate && props.onCreateEntry ? (
            <button
              className="shrink-0 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-700"
              onClick={(e) => {
                e.stopPropagation();
                props.onCreateEntry?.();
              }}
              type="button"
            >
              + New (dev)
            </button>
          ) : null}
        </div>
      </div>

      <div className="relative flex flex-1 flex-col">
        {props.note ? (
          <textarea
            className="lined-paper stylized-scrollbar min-h-[56vh] w-full flex-1 resize-none bg-transparent px-6 pb-10 pt-6 text-sm text-zinc-50 outline-none placeholder:text-zinc-600"
            onChange={(e) => props.onChange({ body: e.target.value })}
            placeholder="Start typing…"
            spellCheck
            value={props.note.body}
          />
        ) : (
          <div className="flex min-h-[56vh] w-full flex-1 items-center justify-center px-6 pb-10 pt-6">
            <div className="text-sm text-zinc-400">
              {props.emptyStateText ?? 'Create an entry to start writing.'}
            </div>
          </div>
        )}

        <PromptsDrawer
          onChangeAnswers={props.onChangeAnswers}
          p1Answer={props.note?.p1Answer ?? ''}
          p2Answer={props.note?.p2Answer ?? ''}
          prompts={props.note ? [props.note.prompt1, props.note.prompt2] : []}
        />

        <div
          className={[
            'absolute inset-0 overflow-hidden bg-zinc-950/95 backdrop-blur',
            'transition-transform duration-300 ease-out',
            'origin-top',
            props.isEntriesOpen ? 'scale-y-100' : 'pointer-events-none scale-y-0'
          ].join(' ')}
        >
          <div className="stylized-scrollbar h-full overflow-auto">{props.entriesPanel}</div>
        </div>
      </div>
    </section>
  );
}

