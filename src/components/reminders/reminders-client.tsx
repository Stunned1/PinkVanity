"use client";

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { RemindersWidget } from '@/components/reminders/reminders-widget';
import { ReminderPoller } from '@/components/reminders/reminder-poller'; // Import the poller
import { getSupabaseBrowserClient } from '@/utils/supabase/browser-client';

type ViewState =
  | { readonly type: 'loading' }
  | { readonly type: 'signed-out' }
  | { readonly type: 'ready' };

export function RemindersClient() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [state, setState] = useState<ViewState>({ type: 'loading' });
  const [refreshKey, setRefreshKey] = useState(0); // New state for triggering refresh

  const handleRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (cancelled) return;

      if (!session) {
        setState({ type: 'signed-out' });
        router.replace('/login');
        return;
      }

      setState({ type: 'ready' });
    }

    void load();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (!session) {
        setState({ type: 'signed-out' });
        router.replace('/login');
        return;
      }
      setState({ type: 'ready' });
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [router, supabase]);

  if (state.type !== 'ready') {
    return (
      <div className="rounded-2xl border border-zinc-900 bg-zinc-950/60 p-6">
        <div className="text-sm text-zinc-400">
          {state.type === 'loading' ? 'Loading…' : 'Redirecting…'}
        </div>
      </div>
    );
  }

  return (
    <>
      <RemindersWidget refreshKey={refreshKey} onRefresh={handleRefresh} />
      <ReminderPoller onRefresh={handleRefresh} /> {/* Pass onRefresh to poller */}
    </>
  );
}
