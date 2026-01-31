"use client";

import type { FormEvent } from 'react';
import { useState } from 'react';

import { signInWithUsernameAndPassword } from '@/utils/auth/supabase-auth';

export function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<
    | { readonly type: 'idle' }
    | { readonly type: 'loading' }
    | { readonly type: 'error'; readonly message: string }
    | { readonly type: 'success' }
  >({ type: 'idle' });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus({ type: 'loading' });

    const res = await signInWithUsernameAndPassword({ username, password });
    if (!res.ok) {
      setStatus({ type: 'error', message: res.error.message });
      return;
    }

    setStatus({ type: 'success' });
    // TODO: where to go after login:
    // - set up a protected route and redirect there (e.g. /dashboard)
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <label className="block">
        <div className="text-sm text-zinc-200">Username</div>
        <input
          autoComplete="username"
          className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-50 outline-none ring-0 placeholder:text-zinc-600 focus:border-zinc-600"
          onChange={(e) => setUsername(e.target.value)}
          placeholder="alice"
          required
          type="text"
          value={username}
        />
      </label>

      <label className="block">
        <div className="text-sm text-zinc-200">Password</div>
        <input
          autoComplete="current-password"
          className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-50 outline-none ring-0 placeholder:text-zinc-600 focus:border-zinc-600"
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          type="password"
          value={password}
        />
      </label>

      {status.type === 'error' ? (
        <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {status.message}
        </div>
      ) : null}

      {status.type === 'success' ? (
        <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">
          Signed in. You can now redirect to your app.
        </div>
      ) : null}

      <button
        className="w-full rounded-xl bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={status.type === 'loading'}
        type="submit"
      >
        {status.type === 'loading' ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

