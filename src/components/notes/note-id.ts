export function createNoteId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  // Fallback for environments without randomUUID.
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

