import { logger } from '@/utils/logger';
import { err, ok, type Result } from '@/utils/result';
import { getSupabaseBrowserClient } from '@/utils/supabase/browser-client';
import type { JournalEntry } from '@/types/journal-entry.types';

type DbJournalRow = {
  readonly id: string;
  readonly user_id: string;
  readonly entry_date: string;
  readonly body: string;
  readonly updated_at: string;
};

export type JournalFailure = { readonly message: string };

function mapRow(row: DbJournalRow): JournalEntry {
  return {
    id: row.id,
    entryDate: row.entry_date,
    body: row.body,
    updatedAt: row.updated_at
  };
}

/**
 * Journal persistence using Supabase table `journal_entries`.
 *
 * Table columns expected:
 * - id (uuid, pk)
 * - user_id (uuid, auth.users fk)
 * - entry_date (text)
 * - body (text)
 * - updated_at (timestamptz)
 */
export async function listJournalEntries(): Promise<Result<readonly JournalEntry[], JournalFailure>> {
  try {
    const supabase = getSupabaseBrowserClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) return err({ message: userError.message });
    if (!userData.user) return err({ message: 'Not signed in.' });

    const { data, error } = await supabase
      .from('journal_entries')
      .select('id,user_id,entry_date,body,updated_at')
      // Sort by entry_date first (your "journal date"), then by updated_at for ties.
      .order('entry_date', { ascending: false })
      .order('updated_at', { ascending: false });

    if (error) return err({ message: error.message });
    return ok((data ?? []).map((row) => mapRow(row as DbJournalRow)));
  } catch (e) {
    logger.error('Unexpected listJournalEntries error', e);
    return err({ message: 'Failed to load entries.' });
  }
}

export async function createJournalEntry(input: {
  readonly entryDate: string;
}): Promise<Result<JournalEntry, JournalFailure>> {
  try {
    const supabase = getSupabaseBrowserClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) return err({ message: userError.message });
    if (!userData.user) return err({ message: 'Not signed in.' });

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('journal_entries')
      .insert({
        user_id: userData.user.id,
        entry_date: input.entryDate,
        body: '',
        updated_at: now
      })
      .select('id,user_id,entry_date,body,updated_at')
      .single();

    if (error) return err({ message: error.message });
    return ok(mapRow(data as DbJournalRow));
  } catch (e) {
    logger.error('Unexpected createJournalEntry error', e);
    return err({ message: 'Failed to create entry.' });
  }
}

export async function updateJournalEntry(input: {
  readonly id: string;
  readonly body: string;
}): Promise<Result<void, JournalFailure>> {
  try {
    const supabase = getSupabaseBrowserClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) return err({ message: userError.message });
    if (!userData.user) return err({ message: 'Not signed in.' });

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('journal_entries')
      .update({ body: input.body, updated_at: now })
      .eq('id', input.id);

    if (error) return err({ message: error.message });
    return ok(undefined);
  } catch (e) {
    logger.error('Unexpected updateJournalEntry error', e);
    return err({ message: 'Failed to save entry.' });
  }
}

export async function deleteJournalEntry(input: {
  readonly id: string;
}): Promise<Result<void, JournalFailure>> {
  try {
    const supabase = getSupabaseBrowserClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) return err({ message: userError.message });
    if (!userData.user) return err({ message: 'Not signed in.' });

    const { error } = await supabase.from('journal_entries').delete().eq('id', input.id);
    if (error) return err({ message: error.message });
    return ok(undefined);
  } catch (e) {
    logger.error('Unexpected deleteJournalEntry error', e);
    return err({ message: 'Failed to delete entry.' });
  }
}

