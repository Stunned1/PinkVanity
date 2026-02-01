import { ok, type Result } from '@/utils/result';

export type AnalyzeFailure = { readonly message: string };

export async function analyzeJournalEntry(entryId: string): Promise<Result<void, AnalyzeFailure>> {
  // Analysis integration was intentionally removed. This remains as a stable call-site hook
  // in case you wire it back in from scratch later.
  void entryId;
  return ok(undefined);
}

