import Link from 'next/link';

type NavItem = {
  readonly href: string;
  readonly label: string;
  readonly description?: string;
};

const NAV_ITEMS: readonly NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', description: 'Overview + quick actions' }
];

export function SidebarNav() {
  return (
    <aside className="rounded-2xl border border-zinc-900 bg-zinc-950/60 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Navigation</div>
      <nav className="mt-3 space-y-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            className="block rounded-xl px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900/40 hover:text-zinc-50"
            href={item.href}
          >
            <div className="font-medium">{item.label}</div>
            {item.description ? (
              <div className="text-xs text-zinc-500">{item.description}</div>
            ) : null}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

