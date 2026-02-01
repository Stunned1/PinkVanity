'use client';
import { useEffect } from 'react';

interface ReminderPollerProps {
  onRefresh: () => void;
}

export function ReminderPoller({ onRefresh }: ReminderPollerProps) {
  useEffect(() => {
    // The "Mailman" routine
    const checkMail = async () => {
      console.log('👀 Checking for due reminders...');
      await fetch('/api/cron/process-reminders/');
      onRefresh(); // Trigger refresh after the cron job is called
    };

    // Check immediately, then every 60 seconds
    void checkMail(); // Call immediately on mount
    const interval = setInterval(checkMail, 60000);

    return () => clearInterval(interval);
  }, [onRefresh]); // Add onRefresh to dependencies

  return null; // It renders nothing (invisible)
}
