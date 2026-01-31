"use client";

import { useMemo, useState } from 'react';

import { EntriesPanel } from '@/components/notes/entries-panel';
import { createNoteId } from '@/components/notes/note-id';
import { NoteEditor } from '@/components/notes/note-editor';
import type { Note } from '@/types/note.types';

const HARD_CODED_ENTRY_DATE = 'Jan 31, 2026';

function createEmptyNote(): Note {
  const now = Date.now();
  // HACKATHON NOTE:
  // This is intentionally hard-coded for quick testing.
  // Replace this with a real "entry date" picker / routing (YYYY-MM-DD) so you can create entries for different dates.
  return { id: createNoteId(), title: "Today", body: '', updatedAt: now };
}

function upsertNote(notes: readonly Note[], next: Note): Note[] {
  const idx = notes.findIndex((n) => n.id === next.id);
  if (idx === -1) return [next, ...notes];

  const copy = notes.slice();
  copy[idx] = next;

  // Bring updated note to the top (notes-app feel).
  if (idx !== 0) {
    const [moved] = copy.splice(idx, 1);
    copy.unshift(moved);
  }

  return copy;
}

function removeNote(notes: readonly Note[], id: string): Note[] {
  return notes.filter((n) => n.id !== id);
}

export function NotesWorkspace(props: { readonly username: string }) {
  const initial = useMemo(() => {
    const note = createEmptyNote();
    return { notes: [note], selectedId: note.id };
  }, []);

  const [notes, setNotes] = useState<readonly Note[]>(initial.notes);
  const [selectedId, setSelectedId] = useState<string | null>(initial.selectedId);
  const [isEntriesOpen, setIsEntriesOpen] = useState(false);

  const selected = selectedId ? notes.find((n) => n.id === selectedId) ?? null : null;

  function createNote() {
    const note = createEmptyNote();
    setNotes((prev) => [note, ...prev]);
    setSelectedId(note.id);
    setIsEntriesOpen(false);
  }

  function deleteNote(noteId: string) {
    setNotes((prev) => {
      const next = removeNote(prev, noteId);

      setSelectedId((prevSelected) => {
        if (prevSelected !== noteId) return prevSelected;
        return next[0]?.id ?? null;
      });

      return next;
    });
  }

  function updateSelected(next: { readonly body: string }) {
    if (!selected) return;
    const updated: Note = {
      ...selected,
      // Title is the (hard-coded) entry date for now.
      title: selected.title,
      body: next.body,
      updatedAt: Date.now()
    };
    setNotes((prev) => upsertNote(prev, updated));
  }

  function selectNote(noteId: string) {
    setSelectedId(noteId);
    setIsEntriesOpen(false);
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-950/60">
      <div className="relative">
        <NoteEditor
          entriesCount={notes.length}
          isEntriesOpen={isEntriesOpen}
          note={selected}
          onChange={updateSelected}
          onToggleEntries={() => setIsEntriesOpen((v) => !v)}
          username={props.username}
        />

        <div
          className={[
            'absolute inset-0 bg-zinc-950/95 backdrop-blur transition-transform duration-300 ease-out',
            'origin-top',
            isEntriesOpen ? 'scale-y-100' : 'pointer-events-none scale-y-0'
          ].join(' ')}
        >
          <EntriesPanel
            notes={notes}
            onClose={() => setIsEntriesOpen(false)}
            onCreate={createNote}
            onDelete={deleteNote}
            onSelect={selectNote}
            selectedNoteId={selectedId}
          />
        </div>
      </div>
    </section>
  );
}

