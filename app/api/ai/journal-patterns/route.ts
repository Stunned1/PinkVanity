import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { serverEnv } from '@/utils/env/server-env';
import { generateJournalPatterns } from '@/utils/ai/journal-patterns';
import { logger } from '@/utils/logger';

type CachedPatterns = {
  readonly atMs: number;
  readonly fingerprint: string;
  readonly value: unknown;
};

const patternsCacheByUser = new Map<string, CachedPatterns>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function isEmptySilence(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const v = value as any;
  const themesLen = Array.isArray(v.themes) ? v.themes.length : null;
  return (
    v.shouldSpeak === false &&
    (v.reflection === null || v.reflection === undefined) &&
    (v.invitation === null || v.invitation === undefined) &&
    (v.timeRange === null || v.timeRange === undefined) &&
    (themesLen === 0 || themesLen === null)
  );
}

function stableHash(input: string): string {
  // Small non-crypto hash for cache keys (djb2-ish).
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  // Force unsigned 32-bit.
  return (h >>> 0).toString(16);
}

function computeEntriesFingerprint(rows: readonly DbJournalRow[]): string {
  // Keep it fast + stable: newest date + count + a tiny sample of newest body.
  const newest = rows.at(0);
  const newestDate = newest?.entry_date ?? '';
  const newestBody = newest?.body ?? '';
  const sample = newestBody.slice(0, 120);
  return stableHash(`${rows.length}|${newestDate}|${sample}`);
}

type DbJournalRow = {
  readonly entry_date: string;
  readonly body: string;
  readonly vent_entry?: boolean | null;
  readonly prompt_1: string | null;
  readonly prompt_2: string | null;
  readonly p1_answer: string | null;
  readonly p2_answer: string | null;
};

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get('authorization');
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const debug = process.env.NODE_ENV !== 'production' && url.searchParams.get('debug') === '1';
    const refresh = url.searchParams.get('refresh') === '1';

    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: 'Missing auth token.' }, { status: 401 });
    }

    // Create a Supabase client that can validate the JWT and query with RLS.
    const supabase = createClient(serverEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError) return NextResponse.json({ error: 'Invalid auth token.' }, { status: 401 });
    if (!userData.user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

    // Pull a bounded window for token safety.
    const MAX = 120;
    const { data, error } = await supabase
      .from('journal_entries')
      .select('entry_date,body,vent_entry,prompt_1,prompt_2,p1_answer,p2_answer')
      .eq('user_id', userData.user.id)
      .order('entry_date', { ascending: false })
      .limit(MAX);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as readonly DbJournalRow[];
    const totalCount = rows.length;
    const ventCount = rows.filter((r) => r.vent_entry ?? false).length;
    const nonVentCount = totalCount - ventCount;
    const fingerprint = computeEntriesFingerprint(rows);

    // Fast path: if entries haven't changed recently, serve cached result without hitting Gemini.
    if (!refresh) {
      const cached = patternsCacheByUser.get(userData.user.id);
      const ageMs = cached ? Date.now() - cached.atMs : null;
      if (cached && cached.fingerprint === fingerprint && ageMs != null && ageMs >= 0 && ageMs <= CACHE_TTL_MS) {
        const cachedValue = cached.value as any;
        if (!debug) return NextResponse.json(cachedValue);
        return NextResponse.json({
          ...cachedValue,
          debugMeta: {
            totalCount,
            ventCount,
            nonVentCount
          },
          cacheMeta: {
            servedFromCache: true,
            ageSeconds: Math.floor(ageMs / 1000),
            entriesFingerprint: fingerprint
          }
        });
      }
    }
    const entriesAll = rows
      .map((r) => ({
        entryDate: r.entry_date,
        body: r.body ?? '',
        prompt1: r.prompt_1 ?? '',
        prompt2: r.prompt_2 ?? '',
        p1Answer: r.p1_answer ?? '',
        p2Answer: r.p2_answer ?? '',
        ventEntry: r.vent_entry ?? false
      }))
      .reverse(); // oldest->newest

    const patterns = await generateJournalPatterns({ entriesAll, debug });
    if (!patterns.ok) {
      const status = patterns.error.message === 'Gemini is not configured.' ? 503 : 500;
      return NextResponse.json({ error: patterns.error.message }, { status });
    }

    // If we have an "empty silence" (rate limit / model error / invalid JSON), try to return
    // a recent cached response instead of going empty, and do NOT overwrite the cache.
    if (isEmptySilence(patterns.value)) {
      const cached = patternsCacheByUser.get(userData.user.id);
      const ageMs = cached ? Date.now() - cached.atMs : null;
      if (cached && ageMs != null && ageMs >= 0 && ageMs <= CACHE_TTL_MS) {
        const cachedValue = cached.value as any;
        if (!debug) return NextResponse.json(cachedValue);
        return NextResponse.json({
          ...cachedValue,
          debugMeta: {
            totalCount,
            ventCount,
            nonVentCount
          },
          cacheMeta: {
            servedFromCache: true,
            ageSeconds: Math.floor(ageMs / 1000)
          }
        });
      }
    }

    // Cache non-empty results per user for a short window to reduce quota pressure.
    patternsCacheByUser.set(userData.user.id, { atMs: Date.now(), fingerprint, value: patterns.value });

    if (!debug) return NextResponse.json(patterns.value);

    return NextResponse.json({
      ...patterns.value,
      debugMeta: {
        totalCount,
        ventCount,
        nonVentCount
      }
    });
  } catch (e) {
    logger.error('journal-patterns route failed', e);
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }
}

