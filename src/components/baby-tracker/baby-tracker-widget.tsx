"use client";

import { useEffect, useMemo, useState } from 'react';

import type { BabyLogEntry, BabyLogKind } from '@/types/baby-log.types';
import { getSupabaseBrowserClient } from '@/utils/supabase/browser-client';

type ModalState =
  | { type: 'closed' }
  | { type: 'open'; kind: 'feeding' }
  | { type: 'open'; kind: 'diaper' };

export function BabyTrackerWidget() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [logs, setLogs] = useState<BabyLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>({ type: 'closed' });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sleepLoading, setSleepLoading] = useState(false);

  // Active sleep entry — if one exists with no end time, sleep is "in progress"
  const activeSleep = logs.find((l) => l.kind === 'sleep' && l.sleep_start && !l.sleep_end) ?? null;

  // Feeding form state
  const [feedingType, setFeedingType] = useState<'breast' | 'bottle' | 'breast_pumped' | null>(null);
  const [feedingDuration, setFeedingDuration] = useState('');
  const [feedingAmount, setFeedingAmount] = useState('');
  const [feedingUnit, setFeedingUnit] = useState<'ml' | 'oz'>('ml'); // Default to ml

  // Fetch logs
  useEffect(() => {
    async function fetchLogs() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('baby_logs')
        .select('*')
        .eq('user_id', session.user.id)
        .order('logged_at', { ascending: false });

      if (!error && data) {
        setLogs(data);
      }
      setLoading(false);
    }

    void fetchLogs();
  }, [supabase]);

  // ─── Create helpers ─────────────────────────────────────────────

  async function getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  }

  // Feeding — modal form with adaptive fields
  async function handleCreateFeeding(e: React.FormEvent) {
    e.preventDefault();
    if (!feedingType) return;

    setSaving(true);
    const session = await getSession();
    if (!session) { setSaving(false); return; }

    let amountMl: number | null = null;
    if ((feedingType === 'bottle' || feedingType === 'breast_pumped') && feedingAmount) {
      amountMl = Number(feedingAmount);
      if (feedingUnit === 'oz') {
        amountMl = amountMl * 29.5735; // Convert oz to ml
      }
    }

    const { data, error } = await supabase
      .from('baby_logs')
      .insert({
        user_id: session.user.id,
        kind: 'feeding',
        logged_at: new Date().toISOString(),
        feeding_type: feedingType,
        feeding_duration_minutes: feedingType === 'breast' && feedingDuration ? Number(feedingDuration) : null,
        feeding_amount_ml: amountMl,
        feeding_amount_unit: feedingUnit,
      })
      .select()
      .single();

    if (!error && data) {
      setLogs((prev) => [data, ...prev]);
      setFeedingType(null);
      setFeedingDuration('');
      setFeedingAmount('');
      setModal({ type: 'closed' });
    }

    setSaving(false);
  }

  // Diaper — instant log, no modal
  async function handleLogDiaper(diaperType: 'wet' | 'dirty' | 'both') {
    const session = await getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from('baby_logs')
      .insert({
        user_id: session.user.id,
        kind: 'diaper',
        logged_at: new Date().toISOString(),
        diaper_type: diaperType,
      })
      .select()
      .single();

    if (!error && data) {
      setLogs((prev) => [data, ...prev]);
    } else if (error) {
      console.error('Error logging diaper:', error);
      alert('Failed to log diaper change: ' + error.message);
    }
  }

  // Sleep — toggle start/end
  async function handleToggleSleep() {
    setSleepLoading(true);
    const session = await getSession();
    if (!session) {
      setSleepLoading(false);
      return;
    }

    if (activeSleep) {
      // End the active sleep
      const { data, error } = await supabase
        .from('baby_logs')
        .update({ sleep_end: new Date().toISOString() })
        .eq('id', activeSleep.id)
        .select()
        .single();

      if (!error && data) {
        setLogs((prev) => prev.map((l) => (l.id === activeSleep.id ? data : l)));
      } else if (error) {
        console.error('Error ending sleep:', error);
        alert('Failed to end sleep: ' + error.message);
      }
    } else {
      // Start a new sleep
      const { data, error } = await supabase
        .from('baby_logs')
        .insert({
          user_id: session.user.id,
          kind: 'sleep',
          logged_at: new Date().toISOString(),
          sleep_start: new Date().toISOString(),
          sleep_end: null,
        })
        .select()
        .single();

      if (!error && data) {
        setLogs((prev) => [data, ...prev]);
      } else if (error) {
        console.error('Error starting sleep:', error);
        alert('Failed to start sleep: ' + error.message);
      }
    }
    setSleepLoading(false);
  }

  // ─── Delete ─────────────────────────────────────────────────────

  async function handleDeleteLog(logId: string) {
    setDeletingId(logId);

    const { error } = await supabase
      .from('baby_logs')
      .delete()
      .eq('id', logId);

    if (error) {
      console.error('Delete error:', error);
      alert(`Failed to delete log: ${error.message}`);
    } else {
      setLogs((prev) => prev.filter((l) => l.id !== logId));
    }

    setDeletingId(null);
  }

  // ─── Formatting ─────────────────────────────────────────────────

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  function kindLabel(kind: BabyLogKind): string {
    switch (kind) {
      case 'feeding': return 'Feeding';
      case 'diaper':  return 'Diaper';
      case 'sleep':   return 'Sleep';
    }
  }

  function kindColor(kind: BabyLogKind): string {
    switch (kind) {
      case 'feeding': return 'bg-blue-900/40 text-blue-400';
      case 'diaper':  return 'bg-yellow-900/40 text-yellow-400';
      case 'sleep':   return 'bg-purple-900/40 text-purple-400';
    }
  }

  function logSummary(log: BabyLogEntry): string {
    switch (log.kind) {
      case 'feeding':
        return [
          log.feeding_type === 'breast' ? 'Breast' : log.feeding_type === 'bottle' ? 'Bottle' : log.feeding_type === 'breast_pumped' ? 'Breast (pumped)' : null,
          log.feeding_duration_minutes ? `${log.feeding_duration_minutes} min` : null,
          log.feeding_amount_ml ? `${log.feeding_amount_ml} ${log.feeding_amount_unit || 'ml'}` : null,
        ]
          .filter(Boolean)
          .join(' · ') || 'Feeding logged';

      case 'diaper':
        return log.diaper_type
          ? log.diaper_type.charAt(0).toUpperCase() + log.diaper_type.slice(1)
          : 'Diaper change';

      case 'sleep': {
        if (log.sleep_start && log.sleep_end) {
          const start = new Date(log.sleep_start);
          const end = new Date(log.sleep_end);
          const mins = Math.round((end.getTime() - start.getTime()) / 60000);

          const formatTime = (date: Date) => {
            return date.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
          };

          return `${formatTime(start)} to ${formatTime(end)} (${mins} min)`;
        }
        if (log.sleep_start && !log.sleep_end) return 'In progress…';
        return 'Sleep logged';
      }
    }
  }

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <>
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-50">Baby Tracker</h2>
        </div>

        {/* Quick-action buttons */}
        <div className="mb-4 flex flex-wrap gap-2">
          {/* Feeding — opens modal */}
          <button
            onClick={() => setModal({ type: 'open', kind: 'feeding' })}
            className="rounded-lg bg-blue-900/40 px-4 py-2 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-900/60"
          >
            + Feeding
          </button>

          {/* Diaper — opens modal for type selection */}
          <button
            onClick={() => setModal({ type: 'open', kind: 'diaper' })}
            className="rounded-lg bg-yellow-900/40 px-4 py-2 text-sm font-medium text-yellow-300 transition-colors hover:bg-yellow-900/60"
          >
            + Diaper Change
          </button>

          {/* Sleep — toggle */}
          <button
            onClick={handleToggleSleep}
            disabled={sleepLoading}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeSleep
                ? 'bg-purple-900/60 text-purple-200 hover:bg-purple-900/80'
                : 'bg-purple-900/40 text-purple-300 hover:bg-purple-900/60'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {sleepLoading ? 'Loading...' : activeSleep ? '🌙 End Sleep' : '+ Sleep'}
          </button>
        </div>

        {/* Log list */}
        <div className="min-h-[200px] space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/20 p-4">
          {loading ? (
            <p className="text-center text-sm text-zinc-500">Loading logs...</p>
          ) : logs.length === 0 ? (
            <p className="text-center text-sm text-zinc-500">
              No logs yet — tap a button above to start tracking.
            </p>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${kindColor(log.kind)}`}>
                        {kindLabel(log.kind)}
                      </span>
                      <p className="text-sm text-zinc-200">{logSummary(log)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-zinc-400">{formatDate(log.logged_at)}</span>
                    <button
                      onClick={() => handleDeleteLog(log.id)}
                      disabled={deletingId === log.id}
                      className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-red-400 disabled:opacity-50"
                      aria-label="Delete log"
                    >
                      {deletingId === log.id ? (
                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Feeding modal */}
      {modal.type === 'open' && modal.kind === 'feeding' && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl my-8">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-50">Log Feeding</h3>
              <button
                onClick={() => setModal({ type: 'closed' })}
                className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateFeeding} className="space-y-4">
              {/* Type toggle */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFeedingType('breast')}
                    className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                      feedingType === 'breast'
                        ? 'border-blue-600 bg-blue-900/40 text-blue-200'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    Breast
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedingType('breast_pumped')}
                    className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                      feedingType === 'breast_pumped'
                        ? 'border-blue-600 bg-blue-900/40 text-blue-200'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    Breast (pumped)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedingType('bottle')}
                    className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                      feedingType === 'bottle'
                        ? 'border-blue-600 bg-blue-900/40 text-blue-200'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    Bottle
                  </button>
                </div>
              </div>

              {/* Duration — shown for breast only */}
              {feedingType === 'breast' && (
                <div>
                  <label htmlFor="duration" className="mb-1.5 block text-sm font-medium text-zinc-300">
                    Duration (minutes)
                  </label>
                  <input
                    id="duration"
                    type="number"
                    min="1"
                    value={feedingDuration}
                    onChange={(e) => setFeedingDuration(e.target.value)}
                    placeholder="e.g. 15"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                  />
                </div>
              )}

              {/* Amount — only shown for bottle or breast (pumped) */}
              {(feedingType === 'bottle' || feedingType === 'breast_pumped') && (
                <div>
                  <label htmlFor="amount" className="mb-1.5 block text-sm font-medium text-zinc-300">
                    Amount
                  </label>
                  <div className="flex rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
                    <input
                      id="amount"
                      type="number"
                      min="1"
                      value={feedingAmount}
                      onChange={(e) => setFeedingAmount(e.target.value)}
                      placeholder="e.g. 120"
                      className="flex-1 bg-transparent px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
                    />
                    <div className="flex border-l border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setFeedingUnit('ml')}
                        className={`px-3 py-2 text-sm font-medium ${
                          feedingUnit === 'ml'
                            ? 'bg-zinc-700 text-zinc-100'
                            : 'text-zinc-400 hover:bg-zinc-800'
                        }`}
                      >
                        ml
                      </button>
                      <button
                        type="button"
                        onClick={() => setFeedingUnit('oz')}
                        className={`px-3 py-2 text-sm font-medium ${
                          feedingUnit === 'oz'
                            ? 'bg-zinc-700 text-zinc-100'
                            : 'text-zinc-400 hover:bg-zinc-800'
                        }`}
                      >
                        oz
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModal({ type: 'closed' })}
                  className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !feedingType}
                  className="flex-1 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Log Feeding'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Diaper modal */}
      {modal.type === 'open' && modal.kind === 'diaper' && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl my-8">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-50">Log Diaper Change</h3>
              <button
                onClick={() => setModal({ type: 'closed' })}
                className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-zinc-400">Select diaper type:</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    handleLogDiaper('wet');
                    setModal({ type: 'closed' });
                  }}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:border-yellow-600"
                >
                  💧 Wet
                </button>
                <button
                  onClick={() => {
                    handleLogDiaper('dirty');
                    setModal({ type: 'closed' });
                  }}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:border-yellow-600"
                >
                  💩 Dirty
                </button>
                <button
                  onClick={() => {
                    handleLogDiaper('both');
                    setModal({ type: 'closed' });
                  }}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:border-yellow-600"
                >
                  💧💩 Both
                </button>
              </div>
              <button
                onClick={() => setModal({ type: 'closed' })}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
