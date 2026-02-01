import type { Metadata } from 'next';
import './globals.css';

import { CursorGlow } from '@/components/ui/cursor-glow';

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
        {children}
        <CursorGlow />
      </body>
    </html>
  );
}

