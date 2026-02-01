import { PROMPT_BANK } from '@/utils/journal/prompt-bank';

function hashStringToUint32(input: string): number {
  // FNV-1a 32-bit
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickDailyPrompts(input: {
  readonly userId: string;
  readonly entryDate: string; // YYYY-MM-DD
}): { readonly prompt1: string; readonly prompt2: string } {
  // “Random every day” but stable for a given (userId + date), so it stays persistent.
  const seed = hashStringToUint32(`${input.userId}:${input.entryDate}`);
  const rng = mulberry32(seed);

  const a = Math.floor(rng() * PROMPT_BANK.length);
  let b = Math.floor(rng() * PROMPT_BANK.length);
  if (b === a) b = (b + 1) % PROMPT_BANK.length;

  return { prompt1: PROMPT_BANK[a]!, prompt2: PROMPT_BANK[b]! };
}

