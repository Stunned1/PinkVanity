'use client';
import { useEffect } from 'react';

interface ReminderPollerProps {
  readonly onRefresh?: () => void;
}

export function ReminderPoller({ onRefresh }: ReminderPollerProps) {
  useEffect(() => {
    // The "Mailman" routine
    const checkMail = async () => {
      await fetch('/api/cron/process-reminders/');
      onRefresh?.(); // Trigger refresh after the cron job is called
    };

    // Check immediately, then every 60 seconds
    void checkMail(); // Call immediately on mount
    const interval = setInterval(checkMail, 60000);

    return () => clearInterval(interval);
  }, [onRefresh]);

  return null; // It renders nothing (invisible)
}
