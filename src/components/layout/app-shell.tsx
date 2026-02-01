import type { ReactNode } from 'react';

import { SidebarNav } from '@/components/layout/sidebar-nav';
import { Topbar } from '@/components/layout/topbar';
import { CatPeek } from '@/components/ui/cat-peek';

export function AppShell(props: { readonly children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <Topbar />
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[240px_1fr]">
        <SidebarNav />
        <div className="min-w-0">{props.children}</div>
      </div>
      <CatPeek />
    </div>
  );
}

