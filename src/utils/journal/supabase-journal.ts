import { logger } from '@/utils/logger';
import { err, ok, type Result } from '@/utils/result';
import { getSupabaseBrowserClient } from '@/utils/supabase/browser-client';
import type { JournalEntry } from '@/types/journal-entry.types';
import { pickDailyPrompts } from '@/utils/journal/prompt-picker';

type DbJournalRow = {
  readonly id: string;
  readonly user_id: string;
  readonly entry_date: string;
  readonly body: string;
  readonly updated_at: string;
  readonly vent_entry?: boolean | null;
  readonly prompt_1: string | null;
  readonly prompt_2: string | null;
  readonly p1_answer: string | null;
  readonly p2_answer: string | null;
};

export type JournalFailure = { readonly message: string };

function mapRow(row: DbJournalRow): JournalEntry {
  return {
    id: row.id,
    entryDate: row.entry_date,
    body: row.body,
    updatedAt: row.updated_at,
    ventEntry: row.vent_entry ?? false,
    prompt1: row.prompt_1 ?? '',
    prompt2: row.prompt_2 ?? '',
    p1Answer: row.p1_answer ?? '',
    p2Answer: row.p2_answer ?? ''
  };
}

/**
 * Journal persistence using Supabase table `journal_entries`.
 *
 * Table columns expected:
 * - id (uuid, pk)
 * - user_id (uuid, auth.users fk)
 * - entry_date (text) (YYYY-MM-DD)
 * - body (text)
 * - updated_at (timestamptz)
 * - prompt_1 (text)
 * - prompt_2 (text)
 * - p1_answer (text)
 * - p2_answer (text)
 */
export async function listJournalEntries(): Promise<Result<readonly JournalEntry[], JournalFailure>> {
  try {
    const supabase = getSupabaseBrowserClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) return err({ message: userError.message });
    if (!userData.user) return err({ message: 'Not signed in.' });

    const { data, error } = await supabase
      .from('journal_entries')
      .select(
        'id,user_id,entry_date,body,updated_at,vent_entry,prompt_1,prompt_2,p1_answer,p2_answer'
      )
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

    const prompts = pickDailyPrompts({ userId: userData.user.id, entryDate: input.entryDate });
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('journal_entries')
      .insert({
        user_id: userData.user.id,
        entry_date: input.entryDate,
        body: '',
        vent_entry: false,
        prompt_1: prompts.prompt1,
        prompt_2: prompts.prompt2,
        p1_answer: '',
        p2_answer: '',
        updated_at: now
      })
      .select(
        'id,user_id,entry_date,body,updated_at,vent_entry,prompt_1,prompt_2,p1_answer,p2_answer'
      )
      .single();

    if (error) return err({ message: error.message });
    return ok(mapRow(data as DbJournalRow));
  } catch (e) {
    logger.error('Unexpected createJournalEntry error', e);
    return err({ message: 'Failed to create entry.' });
  }
}

export async function setJournalEntryPrompts(input: {
  readonly id: string;
  readonly entryDate: string;
}): Promise<Result<{ readonly prompt1: string; readonly prompt2: string }, JournalFailure>> {
  try {
    const supabase = getSupabaseBrowserClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) return err({ message: userError.message });
    if (!userData.user) return err({ message: 'Not signed in.' });

    const prompts = pickDailyPrompts({ userId: userData.user.id, entryDate: input.entryDate });

    const { error } = await supabase
      .from('journal_entries')
      .update({ prompt_1: prompts.prompt1, prompt_2: prompts.prompt2 })
      .eq('id', input.id);

    if (error) return err({ message: error.message });
    return ok({ prompt1: prompts.prompt1, prompt2: prompts.prompt2 });
  } catch (e) {
    logger.error('Unexpected setJournalEntryPrompts error', e);
    return err({ message: 'Failed to set prompts.' });
  }
}

export async function updateJournalEntryAnswers(input: {
  readonly id: string;
  readonly p1Answer: string;
  readonly p2Answer: string;
}): Promise<Result<void, JournalFailure>> {
  try {
    const supabase = getSupabaseBrowserClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) return err({ message: userError.message });
    if (!userData.user) return err({ message: 'Not signed in.' });

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('journal_entries')
      .update({ p1_answer: input.p1Answer, p2_answer: input.p2Answer, updated_at: now })
      .eq('id', input.id);

    if (error) return err({ message: error.message });
    return ok(undefined);
  } catch (e) {
    logger.error('Unexpected updateJournalEntryAnswers error', e);
    return err({ message: 'Failed to save answers.' });
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

export async function updateJournalEntryVenting(input: {
  readonly id: string;
  readonly ventEntry: boolean;
}): Promise<Result<void, JournalFailure>> {
  try {
    const supabase = getSupabaseBrowserClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) return err({ message: userError.message });
    if (!userData.user) return err({ message: 'Not signed in.' });

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('journal_entries')
      .update({ vent_entry: input.ventEntry, updated_at: now })
      .eq('id', input.id);

    if (error) return err({ message: error.message });
    return ok(undefined);
  } catch (e) {
    logger.error('Unexpected updateJournalEntryVenting error', e);
    return err({ message: 'Failed to update venting status.' });
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

