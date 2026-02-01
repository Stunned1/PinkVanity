'use client';
import { useEffect } from 'react';

export function ReminderPoller() {
  useEffect(() => {
    // The "Mailman" routine
    const checkMail = async () => {
      console.log('👀 Checking for due reminders...');
      await fetch('/api/cron/process-reminders/');
    };

    // Check immediately, then every 60 seconds
    checkMail();
    const interval = setInterval(checkMail, 60000);

    return () => clearInterval(interval);
  }, []);

  return null; // It renders nothing (invisible)
}