export type JournalEntry = {
  readonly id: string;
  readonly entryDate: string; // hackathon: store as display string for now
  readonly body: string;
  readonly updatedAt: string; // ISO string
};

