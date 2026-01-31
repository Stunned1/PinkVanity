import Link from 'next/link';

import { SignOutButton } from '@/components/auth/sign-out-button';

export function Topbar() {
  return (
    <header className="border-b border-zinc-900">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <Link className="text-sm font-semibold tracking-tight text-zinc-50" href="/dashboard">
            Wayfourth
          </Link>
          <div className="hidden text-xs text-zinc-500 sm:block">Hackathon skeleton</div>
        </div>

        <div className="flex items-center gap-3">
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}

