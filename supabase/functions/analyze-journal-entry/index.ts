/// <reference types="https://deno.land/x/types@v0.1.0/index.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type AnalyzeRequest = {
  readonly entryId: string;
};

type GeminiSentiment = {
  readonly label: 'positive' | 'neutral' | 'negative' | 'mixed';
  readonly score: number; // -1..1
  readonly summary: string; // 1-2 sentences
  readonly emotions: readonly string[]; // e.g. ["anxious","hopeful"]
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) }
  });
}

function mustGetEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function callGemini(input: {
  readonly apiKey: string;
  readonly text: string;
}): Promise<GeminiSentiment> {
  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' +
    encodeURIComponent(input.apiKey);

  const prompt = [
    'You are a sentiment analysis service for a journaling app.',
    'Return STRICT JSON ONLY (no markdown, no code fences).',
    'Schema:',
    '{',
    '  "label": "positive"|"neutral"|"negative"|"mixed",',
    '  "score": number, // -1..1',
    '  "summary": string, // 1-2 sentences',
    '  "emotions": string[] // 1-5 lowercase words',
    '}',
    '',
    'Text to analyze:',
    input.text
  ].join('\n');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 300 }
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini error (${res.status}): ${body}`);
  }

  const json = await res.json();
  const text =
    json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ??
    '';

  // Gemini sometimes returns leading/trailing whitespace; enforce JSON parse.
  const parsed = JSON.parse(String(text).trim()) as GeminiSentiment;
  return parsed;
}

Deno.serve(async (req) => {
  try {
    const SUPABASE_URL = mustGetEnv('SUPABASE_URL');
    const SUPABASE_ANON_KEY = mustGetEnv('SUPABASE_ANON_KEY');
    const GEMINI_API_KEY = mustGetEnv('GEMINI_API_KEY');

    const authHeader = req.headers.get('authorization') ?? '';
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return jsonResponse({ error: 'Missing Authorization bearer token.' }, { status: 401 });
    }

    const payload = (await req.json()) as AnalyzeRequest;
    if (!payload?.entryId) {
      return jsonResponse({ error: 'Missing entryId.' }, { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: entry, error: entryError } = await supabase
      .from('journal_entries')
      .select('id,entry_date,body,prompt_1,prompt_2,p1_answer,p2_answer')
      .eq('id', payload.entryId)
      .single();

    if (entryError) return jsonResponse({ error: entryError.message }, { status: 400 });

    const combined = [
      `Entry date: ${entry.entry_date}`,
      '',
      'Journal body:',
      entry.body ?? '',
      '',
      'Prompt 1:',
      entry.prompt_1 ?? '',
      'Answer 1:',
      entry.p1_answer ?? '',
      '',
      'Prompt 2:',
      entry.prompt_2 ?? '',
      'Answer 2:',
      entry.p2_answer ?? ''
    ].join('\n');

    const sentiment = await callGemini({ apiKey: GEMINI_API_KEY, text: combined });

    const { error: updateError } = await supabase
      .from('journal_entries')
      .update({
        sentiment_label: sentiment.label,
        sentiment_score: sentiment.score,
        sentiment_summary: sentiment.summary,
        sentiment_json: sentiment,
        sentiment_updated_at: new Date().toISOString()
      })
      .eq('id', payload.entryId);

    if (updateError) return jsonResponse({ error: updateError.message }, { status: 400 });

    return jsonResponse({ ok: true, sentiment });
  } catch (e) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : 'Unknown error analyzing entry.' },
      { status: 500 }
    );
  }
});

