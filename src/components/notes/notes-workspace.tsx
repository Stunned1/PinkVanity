"use client";

import { useEffect, useMemo, useRef, useState } from 'react';

import { EntriesPanel } from '@/components/notes/entries-panel';
import { NoteEditor } from '@/components/notes/note-editor';
import type { JournalEntry } from '@/types/journal-entry.types';
import {
  createJournalEntry,
  deleteJournalEntry,
  listJournalEntries,
  updateJournalEntry
} from '@/utils/journal/supabase-journal';

const HARD_CODED_ENTRY_DATE = 'Jan 31, 2026';

function upsertEntry(entries: readonly JournalEntry[], next: JournalEntry): JournalEntry[] {
  const idx = entries.findIndex((n) => n.id === next.id);
  if (idx === -1) return [next, ...entries];

  const copy = entries.slice();
  copy[idx] = next;

  // Bring updated entry to the top (notes-app feel).
  if (idx !== 0) {
    const [moved] = copy.splice(idx, 1);
    copy.unshift(moved);
  }

  return copy;
}

function removeEntry(entries: readonly JournalEntry[], id: string): JournalEntry[] {
  return entries.filter((n) => n.id !== id);
}

export function NotesWorkspace(_props: { readonly username: string }) {
  const [entries, setEntries] = useState<readonly JournalEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isEntriesOpen, setIsEntriesOpen] = useState(false);
  const [status, setStatus] = useState<
    | { readonly type: 'loading' }
    | { readonly type: 'ready' }
    | { readonly type: 'error'; readonly message: string }
  >({ type: 'loading' });

  const saveTimerRef = useRef<number | null>(null);
  const pendingSaveIdRef = useRef<string | null>(null);

  const selected = selectedId ? entries.find((n) => n.id === selectedId) ?? null : null;

  const selectedForPanel = selectedId;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus({ type: 'loading' });
      const res = await listJournalEntries();
      if (cancelled) return;

      if (!res.ok) {
        setStatus({ type: 'error', message: res.error.message });
        return;
      }

      setEntries(res.value);
      setSelectedId(res.value[0]?.id ?? null);
      setStatus({ type: 'ready' });
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function createEntry() {
    setIsEntriesOpen(false);
    const res = await createJournalEntry({ entryDate: HARD_CODED_ENTRY_DATE });
    if (!res.ok) {
      setStatus({ type: 'error', message: res.error.message });
      return;
    }

    setEntries((prev) => [res.value, ...prev]);
    setSelectedId(res.value.id);
    setStatus({ type: 'ready' });
  }

  async function deleteEntry(entryId: string) {
    const res = await deleteJournalEntry({ id: entryId });
    if (!res.ok) {
      setStatus({ type: 'error', message: res.error.message });
      return;
    }

    setEntries((prev) => {
      const next = removeEntry(prev, entryId);
      setSelectedId((prevSelected) => (prevSelected === entryId ? next[0]?.id ?? null : prevSelected));
      return next;
    });
  }

  function updateSelected(next: { readonly body: string }) {
    if (!selected) return;
    const updated: JournalEntry = {
      ...selected,
      body: next.body,
      updatedAt: new Date().toISOString()
    };

    setEntries((prev) => upsertEntry(prev, updated));

    // Debounced save to Supabase (hackathon-friendly).
    pendingSaveIdRef.current = updated.id;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      const id = pendingSaveIdRef.current;
      if (!id) return;
      const entry = entries.find((e) => e.id === id) ?? updated;
      await updateJournalEntry({ id: entry.id, body: entry.body });
    }, 500);
  }

  function selectEntry(entryId: string) {
    setSelectedId(entryId);
    setIsEntriesOpen(false);
  }

  const emptyStateText = useMemo(() => {
    if (status.type === 'loading') return 'Loading entries…';
    if (status.type === 'error') return status.message;
    return 'Create an entry to start writing.';
  }, [status]);

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-950/60">
      <NoteEditor
        emptyStateText={emptyStateText}
        entriesCount={entries.length}
        entriesPanel={
          <EntriesPanel
            notes={entries}
            onCreate={createEntry}
            onDelete={deleteEntry}
            onSelect={selectEntry}
            selectedNoteId={selectedForPanel}
          />
        }
        isEntriesOpen={isEntriesOpen}
        note={selected}
        onChange={updateSelected}
        onToggleEntries={() => setIsEntriesOpen((v) => !v)}
      />
    </section>
  );
}

