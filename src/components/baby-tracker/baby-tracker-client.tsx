"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { BabyTrackerWidget } from '@/components/baby-tracker/baby-tracker-widget';
import { getSupabaseBrowserClient } from '@/utils/supabase/browser-client';

type ViewState =
  | { readonly type: 'loading' }
  | { readonly type: 'signed-out' }
  | { readonly type: 'ready' };

export function BabyTrackerClient() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [state, setState] = useState<ViewState>({ type: 'loading' });

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

  return <BabyTrackerWidget />;
}
