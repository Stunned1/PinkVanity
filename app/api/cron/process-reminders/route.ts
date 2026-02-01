import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Configure the Email Transporter
const transporter = nodemailer.createTransport({
  service: 'gmail', // Or use host/port for other providers
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD, // Use an "App Password" for Gmail
  },
});

export async function GET(request: Request) {
  try {
    const now = new Date().toISOString();
    
    const { data: reminders, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('status', 'pending')
      .lte('remind_at', now);

    if (error) throw error;
    if (!reminders || reminders.length === 0) {
      return NextResponse.json({ message: 'No reminders to send' });
    }

    const results = await Promise.all(
      reminders.map(async (reminder) => {
        try {
          // --- EMAIL TO SMS LOGIC ---
          // Format: 1234567890@vtext.com (Verizon example)
          // You can store the carrier gateway in your DB or hardcode it
          const gateway = process.env.SMS_GATEWAY; // e.g., "vtext.com"
          const recipientEmail = `${reminder.phone_number.replace(/\D/g, '')}@${gateway}`;

          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: recipientEmail,
            subject: '', // Most SMS gateways ignore the subject
            text: reminder.message,
          });

          await supabase
            .from('reminders')
            .update({ status: 'sent' })
            .eq('id', reminder.id);

          return { id: reminder.id, success: true };
        } catch (err: any) {
          console.error(`Failed to send reminder ${reminder.id}:`, err);
          await supabase
            .from('reminders')
            .update({ status: 'failed' })
            .eq('id', reminder.id);

          return { id: reminder.id, success: false };
        }
      })
    );

    return NextResponse.json({ success: true, processed: results.length });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}