import { err, ok, type Result } from '@/utils/result';
import { getSupabaseBrowserClient } from '@/utils/supabase/browser-client';

export type AnalyzeFailure = { readonly message: string };

export async function analyzeJournalEntry(entryId: string): Promise<Result<void, AnalyzeFailure>> {
  try {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.functions.invoke('analyze-journal-entry', {
      body: { entryId }
    });

    if (error) return err({ message: error.message });
    return ok(undefined);
  } catch (e) {
    return err({ message: e instanceof Error ? e.message : 'Failed to analyze entry.' });
  }
}

