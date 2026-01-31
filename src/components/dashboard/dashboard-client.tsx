"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { getSupabaseBrowserClient } from '@/utils/supabase/browser-client';

type ViewState =
  | { readonly type: 'loading' }
  | { readonly type: 'signed-out' }
  | { readonly type: 'ready'; readonly username: string };

function deriveUsernameFromEmail(email: string | undefined): string {
  if (!email) return 'user';
  const [localPart] = email.split('@');
  return localPart || 'user';
}

export function DashboardClient() {
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

      const username = deriveUsernameFromEmail(session.user.email ?? undefined);
      setState({ type: 'ready', username });
    }

    void load();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (!session) {
        setState({ type: 'signed-out' });
        router.replace('/login');
        return;
      }

      const username = deriveUsernameFromEmail(session.user.email ?? undefined);
      setState({ type: 'ready', username });
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
          {state.type === 'loading' ? 'Loading your session…' : 'Redirecting…'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-900 bg-zinc-950/60 p-6">
        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Overview</div>
        <div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">
          Welcome, {state.username}
        </div>
        <div className="mt-2 text-sm text-zinc-400">
          This is a clean starter layout you can replace with your hackathon features.
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-zinc-900 bg-zinc-950/60 p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Status</div>
          <div className="mt-2 text-lg font-semibold text-zinc-50">Signed in</div>
          <div className="mt-1 text-sm text-zinc-400">Supabase session is active.</div>
        </div>

        <div className="rounded-2xl border border-zinc-900 bg-zinc-950/60 p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Next</div>
          <div className="mt-2 text-lg font-semibold text-zinc-50">Build your feature</div>
          <div className="mt-1 text-sm text-zinc-400">Drop components into this grid.</div>
        </div>

        <div className="rounded-2xl border border-zinc-900 bg-zinc-950/60 p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Data</div>
          <div className="mt-2 text-lg font-semibold text-zinc-50">Coming soon</div>
          <div className="mt-1 text-sm text-zinc-400">Hook up tables/queries when ready.</div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-900 bg-zinc-950/60 p-6">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Quick actions
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-700">
              Create item
            </button>
            <button className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-700">
              Invite teammate
            </button>
            <button className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-700">
              Import data
            </button>
            <button className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-700">
              View settings
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-900 bg-zinc-950/60 p-6">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Recent activity
          </div>
          <ul className="mt-3 space-y-2 text-sm text-zinc-300">
            <li className="flex items-center justify-between rounded-xl border border-zinc-900 px-3 py-2">
              <span>Signed in</span>
              <span className="text-xs text-zinc-500">Just now</span>
            </li>
            <li className="flex items-center justify-between rounded-xl border border-zinc-900 px-3 py-2">
              <span>Opened dashboard</span>
              <span className="text-xs text-zinc-500">Just now</span>
            </li>
            <li className="flex items-center justify-between rounded-xl border border-zinc-900 px-3 py-2">
              <span>Ready to build</span>
              <span className="text-xs text-zinc-500">Now</span>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}

