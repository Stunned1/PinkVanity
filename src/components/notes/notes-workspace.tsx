"use client";

import { useEffect, useMemo, useRef, useState } from 'react';

import { EntriesPanel } from '@/components/notes/entries-panel';
import { NoteEditor } from '@/components/notes/note-editor';
import type { JournalEntry } from '@/types/journal-entry.types';
import {
  createJournalEntry,
  deleteJournalEntry,
  listJournalEntries,
  setJournalEntryPrompts,
  updateJournalEntryAnswers,
  updateJournalEntryVenting,
  updateJournalEntry
} from '@/utils/journal/supabase-journal';

function getTodayIsoDate(): string {
  // YYYY-MM-DD (local time is fine for hackathon; switch to timezone-aware logic later)
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysIsoDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function sortEntries(entries: readonly JournalEntry[]): JournalEntry[] {
  return entries
    .slice()
    .sort((a, b) => b.entryDate.localeCompare(a.entryDate) || b.updatedAt.localeCompare(a.updatedAt));
}

function upsertEntry(entries: readonly JournalEntry[], next: JournalEntry): JournalEntry[] {
  const idx = entries.findIndex((n) => n.id === next.id);
  if (idx === -1) return sortEntries([next, ...entries]);

  const copy = entries.slice();
  copy[idx] = next;

  return sortEntries(copy);
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
  const pendingAnswersRef = useRef<{ readonly p1Answer: string; readonly p2Answer: string } | null>(
    null
  );
  const ventTimerRef = useRef<number | null>(null);
  const pendingVentRef = useRef<boolean | null>(null);
  const ensuredTodayRef = useRef(false);
  const backfilledRef = useRef(false);

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

      const sorted = sortEntries(res.value);
      setEntries(sorted);
      setSelectedId(sorted[0]?.id ?? null);
      setStatus({ type: 'ready' });
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (status.type !== 'ready') return;
    if (backfilledRef.current) return;

    const missing = entries.filter((e) => !e.prompt1 || !e.prompt2);
    if (missing.length === 0) {
      backfilledRef.current = true;
      return;
    }

    backfilledRef.current = true;
    void (async () => {
      for (const entry of missing) {
        const res = await setJournalEntryPrompts({ id: entry.id, entryDate: entry.entryDate });
        if (!res.ok) continue;
        setEntries((prev) =>
          prev.map((e) =>
            e.id === entry.id ? { ...e, prompt1: res.value.prompt1, prompt2: res.value.prompt2 } : e
          )
        );
      }
    })();
  }, [entries, status.type]);

  useEffect(() => {
    if (status.type !== 'ready') return;
    if (ensuredTodayRef.current) return;

    const today = getTodayIsoDate();
    const hasToday = entries.some((e) => e.entryDate === today);
    if (hasToday) {
      ensuredTodayRef.current = true;
      return;
    }

    ensuredTodayRef.current = true;
    void createEntry(today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.type, entries.length]);

  async function createEntry(entryDate: string = getTodayIsoDate()) {
    setIsEntriesOpen(false);
    const res = await createJournalEntry({ entryDate });
    if (!res.ok) {
      setStatus({ type: 'error', message: res.error.message });
      return;
    }

    setEntries((prev) => sortEntries([res.value, ...prev]));
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
      // Use the latest body we just applied (this timer gets reset on every keystroke).
      await updateJournalEntry({ id, body: updated.body });
    }, 500);
  }

  function updateAnswers(next: { readonly p1Answer: string; readonly p2Answer: string }) {
    if (!selected) return;
    const updated: JournalEntry = {
      ...selected,
      p1Answer: next.p1Answer,
      p2Answer: next.p2Answer,
      updatedAt: new Date().toISOString()
    };

    setEntries((prev) => upsertEntry(prev, updated));

    // Debounced save answers (separate from journal body).
    pendingSaveIdRef.current = updated.id;
    pendingAnswersRef.current = { p1Answer: updated.p1Answer, p2Answer: updated.p2Answer };
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      const id = pendingSaveIdRef.current;
      const answers = pendingAnswersRef.current;
      if (!id || !answers) return;
      await updateJournalEntryAnswers({ id, p1Answer: answers.p1Answer, p2Answer: answers.p2Answer });
    }, 500);
  }

  function toggleVenting() {
    if (!selected) return;
    const next = !selected.ventEntry;
    const updated: JournalEntry = { ...selected, ventEntry: next, updatedAt: new Date().toISOString() };
    setEntries((prev) => upsertEntry(prev, updated));

    pendingSaveIdRef.current = updated.id;
    pendingVentRef.current = next;
    if (ventTimerRef.current) window.clearTimeout(ventTimerRef.current);
    ventTimerRef.current = window.setTimeout(async () => {
      const id = pendingSaveIdRef.current;
      const ventEntry = pendingVentRef.current;
      if (!id || ventEntry == null) return;
      await updateJournalEntryVenting({ id, ventEntry });
    }, 250);
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
            onDelete={deleteEntry}
            onSelect={selectEntry}
            selectedNoteId={selectedForPanel}
          />
        }
        isEntriesOpen={isEntriesOpen}
        note={selected}
        onChange={updateSelected}
        onChangeAnswers={updateAnswers}
        onToggleEntries={() => setIsEntriesOpen((v) => !v)}
        onToggleVenting={toggleVenting}
      />
    </section>
  );
}

