export type JournalEntry = {
  readonly id: string;
  readonly entryDate: string; // ISO date string YYYY-MM-DD
  readonly body: string;
  readonly updatedAt: string; // ISO string
  readonly ventEntry: boolean;
  readonly prompt1: string;
  readonly prompt2: string;
  readonly p1Answer: string;
  readonly p2Answer: string;
};

