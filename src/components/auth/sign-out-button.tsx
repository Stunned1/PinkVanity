"use client";

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { getSupabaseBrowserClient } from '@/utils/supabase/browser-client';

export function SignOutButton() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [isLoading, setIsLoading] = useState(false);

  async function onClick() {
    setIsLoading(true);
    await supabase.auth.signOut();
    router.replace('/login');
    setIsLoading(false);
  }

  return (
    <button
      className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={isLoading}
      onClick={onClick}
      type="button"
    >
      {isLoading ? 'Signing out…' : 'Sign out'}
    </button>
  );
}

