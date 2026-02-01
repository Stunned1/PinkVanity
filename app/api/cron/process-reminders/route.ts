import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';

// 1. Init Supabase Admin Client (Bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 2. Init Twilio Client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function GET(request: Request) {
  // Optional: Add a secret header check here to prevent public access
  // if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return new NextResponse('Unauthorized', { status: 401 });
  // }

  try {
    // 3. Find due reminders
    // We look for 'pending' items where 'remind_at' is in the past
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

    // 4. Send texts and update DB
    const results = await Promise.all(
      reminders.map(async (reminder) => {


        let toPhone = reminder.phone_number.trim();
        if (!toPhone.startsWith('+')) {
          // Remove dashes/spaces and add +1
          toPhone = `+1${process.env.TWILIO_VIRTUAL_NUMBER}`; 
        }
        try {
          // Send via Twilio
          await twilioClient.messages.create({
            body: reminder.message,
            to: toPhone,
            from: process.env.TWILIO_PHONE_NUMBER,
          });

          // Mark as sent
          await supabase
            .from('reminders')
            .update({ status: 'sent' })
            .eq('id', reminder.id);

          return { id: reminder.id, success: true };
        } catch (err: any) {
          console.error(`Failed to send reminder ${reminder.id}:`, err);
          
          // Mark as failed so we don't retry forever
          await supabase
            .from('reminders')
            .update({ status: 'failed' })
            .eq('id', reminder.id);

          return { id: reminder.id, success: false, error: err.message };
        }
      })
    );

    return NextResponse.json({ 
      success: true, 
      processed: results.length,
      details: results 
    });

  } catch (error: any) {
    console.error('Cron job error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}