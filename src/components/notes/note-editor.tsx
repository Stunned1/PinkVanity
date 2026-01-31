"use client";

import type { Note } from '@/types/note.types';

export function NoteEditor(props: {
  readonly note: Note | null;
  readonly username: string;
  readonly entriesCount: number;
  readonly isEntriesOpen: boolean;
  readonly onToggleEntries: () => void;
  readonly onChange: (next: { readonly body: string }) => void;
}) {
  if (!props.note) {
    return (
      <section className="flex min-h-[70vh] flex-col p-6">
        <div className="text-sm text-zinc-400">Create a note to start writing.</div>
      </section>
    );
  }

  return (
    <section className="flex min-h-[70vh] flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-zinc-900 px-5 py-4">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Writing</div>
          <div className="mt-1 truncate text-sm text-zinc-300">
            Signed in as <span className="text-zinc-100">{props.username}</span>
          </div>
          <div className="mt-1 truncate text-sm font-medium text-zinc-100">{props.note.title}</div>
        </div>
        <button
          className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-left text-xs text-zinc-200 hover:border-zinc-700"
          onClick={props.onToggleEntries}
          type="button"
        >
          <div className="font-medium">{props.isEntriesOpen ? 'Hide entries' : 'Show entries'}</div>
          <div className="text-zinc-500">{props.entriesCount} total</div>
        </button>
      </header>

      <div className="flex-1 px-4 pb-4">
        <textarea
          className="lined-paper h-full min-h-[56vh] w-full resize-none rounded-xl border border-zinc-800 px-4 pb-6 pt-6 text-sm text-zinc-50 outline-none placeholder:text-zinc-600 focus:border-zinc-600"
          onChange={(e) => props.onChange({ body: e.target.value })}
          placeholder="Start typing…"
          spellCheck
          value={props.note.body}
        />
      </div>
    </section>
  );
}

