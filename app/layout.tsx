import type { Metadata } from 'next';
import './globals.css';
// 1. Import the Poller
import { ReminderPoller } from '@/components/reminders/reminder-poller';

import { CursorGlow } from '@/components/ui/cursor-glow';
import { ListenOnlyProvider } from '@/components/settings/listen-only-provider';

export const metadata: Metadata = {
  title: 'Wayfourth',
  description: 'Auth scaffold'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-50 antialiased">
        <ReminderPoller />
        <ListenOnlyProvider>{children}</ListenOnlyProvider>
        <CursorGlow />
      </body>
    </html>
  );
}