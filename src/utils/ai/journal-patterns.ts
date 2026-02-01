import { GoogleGenerativeAI, type Schema, SchemaType } from '@google/generative-ai';
import { z } from 'zod';

import { serverEnv } from '@/utils/env/server-env';
import { logger } from '@/utils/logger';

export type JournalPatternInputEntry = {
  readonly entryDate: string; // YYYY-MM-DD
  readonly body: string;
  readonly prompt1: string;
  readonly prompt2: string;
  readonly p1Answer: string;
  readonly p2Answer: string;
  readonly ventEntry: boolean;
};

export type JournalPatternsResult =
  | {
      readonly ok: true;
      readonly value: {
        readonly shouldSpeak: boolean;
        readonly reflection: string | null;
        readonly themes: readonly string[];
        readonly invitation: string | null;
        readonly timeRange: string | null;
        readonly debug?: {
          readonly attempted: boolean;
          readonly reason:
            | 'not_enough_entries'
            | 'not_enough_span'
            | 'model_silence'
            | 'rate_limited'
            | 'model_error'
            | 'banned_language'
            | 'invalid_json'
            | 'invalid_shape'
            | 'empty_reflection'
            | 'spoke';
          readonly entriesCount: number;
          readonly spanDays: number | null;
          readonly modelName: string | null;
          readonly finishReason?: string | null;
          readonly outputLength?: number;
          readonly outputPreview?: string;
          readonly errorStatus?: number | null;
          readonly errorMessage?: string;
          readonly retryAfterSeconds?: number | null;
          readonly retry?: {
            readonly modelName: string;
            readonly finishReason?: string | null;
            readonly outputLength?: number;
            readonly outputPreview?: string;
            readonly errorStatus?: number | null;
            readonly errorMessage?: string;
            readonly retryAfterSeconds?: number | null;
          };
        };
      };
    }
  | { readonly ok: false; readonly error: { readonly message: string } };

const modelResponseSchema = z.object({
  shouldSpeak: z.boolean(),
  timeRange: z.string().nullable(),
  reflection: z.string().nullable(),
  themes: z.array(z.string()).default([]),
  invitation: z.string().nullable()
});

// `@google/generative-ai` uses an OpenAPI-ish schema subset for `responseSchema`.
const responseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    shouldSpeak: { type: SchemaType.BOOLEAN },
    timeRange: { type: SchemaType.STRING, nullable: true },
    reflection: { type: SchemaType.STRING, nullable: true },
    themes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, maxItems: 6 },
    invitation: { type: SchemaType.STRING, nullable: true }
  },
  required: ['shouldSpeak', 'timeRange', 'reflection', 'themes', 'invitation']
};

let cachedModelName: string | null = null;

function normalizeModelName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('models/')) return trimmed;
  return `models/${trimmed}`;
}

function tryParseJsonLoose(input: string): unknown | null {
  try {
    return JSON.parse(input);
  } catch {
    // Apply a few safe-ish repairs for common LLM "almost JSON" outputs.
    // Order matters: progressively normalize toward strict JSON.
    const repaired = input
      // Trailing commas (valid in JSON5, invalid in JSON).
      .replace(/,\s*([}\]])/g, '$1')
      // Python-ish booleans/nulls.
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false')
      .replace(/\bNone\b/g, 'null')
      // Unquoted keys: { shouldSpeak: true } -> { "shouldSpeak": true }
      .replace(/([{\[,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3')
      // Single-quoted strings (best-effort; assumes no embedded single quotes).
      .replace(/:\s*'([^'\\]*)'/g, (_m, s1: string) => `: "${s1.replace(/"/g, '\\"')}"`)
      .replace(/,\s*'([^'\\]*)'\s*([}\]])/g, (_m, s1: string, tail: string) => `, "${s1.replace(/"/g, '\\"')}"${tail}`);

    try {
      return JSON.parse(repaired);
    } catch {
      return null;
    }
  }
}

function stripCodeFences(text: string): string {
  // If Gemini wraps output, prefer the FIRST fenced block.
  const fenceStart = text.indexOf('```');
  if (fenceStart === -1) return text.trim();
  const fenceEnd = text.indexOf('```', fenceStart + 3);
  if (fenceEnd === -1) return text.trim();

  const inside = text.slice(fenceStart + 3, fenceEnd);
  // Strip optional "json" language tag on the first line.
  return inside.replace(/^\s*json\s*\n/i, '').trim();
}

function extractJsonObjects(text: string): readonly string[] {
  // Extract balanced {...} substrings, ignoring braces in strings.
  const out: string[] = [];

  for (let start = 0; start < text.length; start++) {
    if (text[start] !== '{') continue;

    let depth = 0;
    let inString = false;
    let escaping = false;

    for (let i = start; i < text.length; i++) {
      const ch = text[i] ?? '';

      if (inString) {
        if (escaping) {
          escaping = false;
          continue;
        }
        if (ch === '\\') {
          escaping = true;
          continue;
        }
        if (ch === '"') {
          inString = false;
          continue;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === '{') {
        depth++;
        continue;
      }
      if (ch === '}') {
        depth--;
        if (depth === 0) {
          out.push(text.slice(start, i + 1).trim());
          break;
        }
      }
    }
  }

  return out;
}

function parseBestJsonFromModelText(text: string): unknown | null {
  const normalized = stripCodeFences(text);
  const candidates = extractJsonObjects(normalized);

  // Prefer the last JSON object in the output (LLMs sometimes include an example first).
  let anyParsed: unknown | null = null;
  for (let i = candidates.length - 1; i >= 0; i--) {
    const candidate = candidates[i];
    if (!candidate) continue;
    const parsed = tryParseJsonLoose(candidate);
    if (parsed == null) continue;
    anyParsed = parsed;
    // Return immediately if it matches the schema.
    const shaped = modelResponseSchema.safeParse(parsed);
    if (shaped.success) return parsed;
  }

  return anyParsed;
}

async function resolveModelName(): Promise<string> {
  // Respect explicit configuration.
  if (serverEnv.GEMINI_MODEL) return normalizeModelName(serverEnv.GEMINI_MODEL);
  if (cachedModelName) return cachedModelName;
  if (!serverEnv.GEMINI_API_KEY) return 'models/gemini-2.0-flash';

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(
      serverEnv.GEMINI_API_KEY
    )}`;
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) {
      // Fall back to a reasonable default if listing is blocked.
      cachedModelName = 'models/gemini-2.0-flash';
      return cachedModelName;
    }

    const json = (await res.json()) as unknown;
    const models =
      typeof json === 'object' && json && 'models' in json && Array.isArray((json as any).models)
        ? ((json as any).models as readonly any[])
        : [];

    const supportsGenerateContent = models.filter((m) => {
      const methods = (m as any)?.supportedGenerationMethods;
      return Array.isArray(methods) && methods.includes('generateContent') && typeof (m as any)?.name === 'string';
    });

    const preferredPrefixes = [
      'models/gemini-2.5-flash',
      'models/gemini-2.5-flash-lite',
      'models/gemini-2.0-flash',
      'models/gemini-2.0-flash-lite',
      'models/gemini-1.5-flash',
      'models/gemini-1.5-pro',
      'models/gemini-1.0-pro'
    ] as const;

    for (const prefix of preferredPrefixes) {
      const hit = supportsGenerateContent.find((m) => String(m.name).startsWith(prefix));
      if (hit?.name) {
        cachedModelName = String(hit.name);
        return cachedModelName;
      }
    }

    cachedModelName = supportsGenerateContent[0]?.name ? String(supportsGenerateContent[0].name) : 'models/gemini-2.0-flash';
    return cachedModelName;
  } catch {
    cachedModelName = 'models/gemini-2.0-flash';
    return cachedModelName;
  }
}

const BANNED_SUBSTRINGS = [
  'postpartum depression',
  'ppd',
  'depression',
  'anxiety',
  'diagnos',
  'you should',
  'try ',
  'it might help',
  'you need to',
  'everything will be okay',
  "you're doing great",
  'at least',
  'the good news is',
  'progress',
  'growth',
  'resilience'
] as const;

function includesBannedLanguage(text: string): boolean {
  const lower = text.toLowerCase();
  return BANNED_SUBSTRINGS.some((s) => lower.includes(s));
}

function sanitizeOutput(input: {
  readonly reflection: string | null;
  readonly themes: readonly string[];
}): { readonly ok: true; readonly value: typeof input } | { readonly ok: false } {
  // We intentionally do NOT sanitize the invitation anymore since we never show/return it.
  const combined = [input.reflection ?? '', ...input.themes].join('\n');
  if (!combined.trim()) return { ok: true, value: input };
  if (includesBannedLanguage(combined)) return { ok: false };
  return { ok: true, value: input };
}

function parseIsoDate(iso: string): Date | null {
  // Treat as UTC midnight.
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return new Date(Date.UTC(y, mo - 1, d));
}

function computeSpanDays(entries: readonly JournalPatternInputEntry[]): number | null {
  const first = entries.at(0)?.entryDate;
  const last = entries.at(-1)?.entryDate;
  if (!first || !last) return null;
  const a = parseIsoDate(first);
  const b = parseIsoDate(last);
  if (!a || !b) return null;
  const ms = b.getTime() - a.getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function describeTimeRange(spanDays: number | null): string {
  if (spanDays == null) return 'over the past week';
  if (spanDays >= 20) return 'over the past few weeks';
  if (spanDays >= 13) return 'over the past two weeks';
  return 'over the past week';
}

function shouldAttemptLongitudinalAnalysis(entries: readonly JournalPatternInputEntry[]): boolean {
  // Enforce "longitudinal by design": silence when data is thin.
  const nonVent = entries.filter((e) => !e.ventEntry);
  if (nonVent.length < 4) return false;
  const spanDays = computeSpanDays(nonVent);
  if (spanDays == null) return false;
  // Require at least ~1 week span to avoid "day-to-day" reactivity.
  if (spanDays < 6) return false;
  return true;
}

function compactEntryText(entry: JournalPatternInputEntry): string {
  const parts = [
    entry.body?.trim() || '',
    entry.prompt1?.trim() ? `P1: ${entry.prompt1.trim()}` : '',
    entry.p1Answer?.trim() ? `A1: ${entry.p1Answer.trim()}` : '',
    entry.prompt2?.trim() ? `P2: ${entry.prompt2.trim()}` : '',
    entry.p2Answer?.trim() ? `A2: ${entry.p2Answer.trim()}` : ''
  ].filter(Boolean);

  // Keep each entry bounded so the whole prompt is one stable context blob.
  const combined = parts.join('\n');
  return combined.length > 900 ? `${combined.slice(0, 900)}…` : combined;
}

function selectEntriesForModel(entries: readonly JournalPatternInputEntry[]): readonly JournalPatternInputEntry[] {
  // If the prompt is too large, the model may have almost no output tokens left and truncate
  // the JSON immediately with finishReason=MAX_TOKENS.
  const MAX_ENTRIES = 30;
  const MAX_CHARS_TOTAL = 8_000;

  const nonVent = entries.filter((e) => !e.ventEntry);
  const vent = entries.filter((e) => e.ventEntry);

  // Prefer newest non-vent entries; include a small amount of vent context.
  const candidatesNewestFirst: JournalPatternInputEntry[] = [...nonVent.slice().reverse(), ...vent.slice().reverse().slice(0, 6)];

  const pickedNewestFirst: JournalPatternInputEntry[] = [];
  let usedChars = 0;

  for (const e of candidatesNewestFirst) {
    if (pickedNewestFirst.length >= MAX_ENTRIES) break;

    const bounded: JournalPatternInputEntry = {
      ...e,
      body: (e.body ?? '').slice(0, 500),
      prompt1: (e.prompt1 ?? '').slice(0, 140),
      prompt2: (e.prompt2 ?? '').slice(0, 140),
      p1Answer: (e.p1Answer ?? '').slice(0, 260),
      p2Answer: (e.p2Answer ?? '').slice(0, 260)
    };

    const text = compactEntryText(bounded);
    const cost = 40 + text.length; // rough per-entry overhead
    if (pickedNewestFirst.length > 0 && usedChars + cost > MAX_CHARS_TOTAL) break;

    pickedNewestFirst.push(bounded);
    usedChars += cost;
  }

  return pickedNewestFirst.reverse(); // oldest->newest
}

function buildGeminiRequest(entries: readonly JournalPatternInputEntry[]): {
  readonly systemInstruction: string;
  readonly userText: string;
} {
  // IMPORTANT: we send all entries as ONE text blob (single content part),
  // not as individual messages/parts per entry.
  const entriesSelected = selectEntriesForModel(entries);
  const entriesCompact = entriesSelected.map((e) => ({
    entryDate: e.entryDate,
    ventEntry: e.ventEntry,
    text: compactEntryText(e)
  }));

  const systemInstruction = [
    'You are a journaling pattern observer. Reflect sustained patterns across time; do not advise.',
    '',
    'Scope & safety:',
    '- Do NOT diagnose, label conditions, assess risk, or provide therapy.',
    '- Do NOT give directives/suggestions.',
    '- Do NOT react to a single day/entry.',
    '',
    'Temporal reasoning:',
    '- Only speak about persistence/direction over days or weeks.',
    '- Use cautious, descriptive language.',
    '',
    'Venting rule:',
    '- Each entry has ventEntry:true|false.',
    '- Vent entries may be intense; use them only as background after repeated signals exist across non-vent entries.',
    '- A vent entry may never be the primary justification for speaking.',
    '',
    'Forbidden language (must not appear):',
    '- clinical labels (depression, anxiety, PPD, etc.)',
    '- directives (you should, try, you need to, it might help)',
    '- platitudes (everything will be okay, you’re doing great, at least, the good news is)',
    '',
    'Output contract:',
    '- Output ONLY a single-line minified JSON object.',
    '- It MUST be valid JSON (no trailing commas; all quotes/brace closed).',
    '- Before responding, verify your JSON parses.',
    '',
    'JSON shape:',
    '{"shouldSpeak":true,"timeRange":"string|null","reflection":"string|null","themes":["string"],"invitation":"string|null"}',
    '',
    'Field rules:',
    '- timeRange: "over the past week" | "over the past two weeks" | "over the past few weeks" | null',
    '- reflection: time-based, <= 240 characters, no advice.',
    '- themes: 0-3 short, concrete, non-clinical strings (<= 20 chars each).',
    '- invitation: ALWAYS null.',
    '',
    'If evidence is thin/unclear:',
    '- still set shouldSpeak=true and write: "Over the past week, I’m not seeing a clear repeating pattern yet."',
    '- themes=[] and invitation=null.'
  ].join('\n');

  const userText = [
    'Entries (oldest to newest) as JSON. Each entry has a compact text field:',
    JSON.stringify(entriesCompact)
  ].join('\n');

  return { systemInstruction, userText };
}

export async function generateJournalPatterns(input: {
  readonly entriesAll: readonly JournalPatternInputEntry[];
  readonly debug?: boolean;
}): Promise<JournalPatternsResult> {
  try {
    const entries = input.entriesAll
      .slice()
      .sort((a, b) => a.entryDate.localeCompare(b.entryDate));

    if (!shouldAttemptLongitudinalAnalysis(entries)) {
      const nonVent = entries.filter((e) => !e.ventEntry);
      const spanDays = computeSpanDays(nonVent);
      return {
        ok: true,
        value: {
          shouldSpeak: false,
          reflection: null,
          themes: [],
          invitation: null,
          timeRange: null,
          debug: input.debug
            ? {
                attempted: false,
                reason: nonVent.length < 4 ? 'not_enough_entries' : 'not_enough_span',
                entriesCount: nonVent.length,
                spanDays,
                modelName: null
              }
            : undefined
        }
      };
    }

    if (!serverEnv.GEMINI_API_KEY) {
      return { ok: false, error: { message: 'Gemini is not configured.' } };
    }

    const genAI = new GoogleGenerativeAI(serverEnv.GEMINI_API_KEY);
    const resolvedModelName = await resolveModelName();

    type ModelAttempt =
      | {
          readonly ok: true;
          readonly modelName: string;
          readonly text: string;
          readonly finishReason: string | null;
          readonly partsCount: number | null;
        }
      | {
          readonly ok: false;
          readonly modelName: string;
          readonly errorStatus: number | null;
          readonly errorMessage: string;
          readonly retryAfterSeconds: number | null;
        };

    function extractRetryAfterSeconds(e: unknown): number | null {
      const details = (e as any)?.errorDetails;
      if (!Array.isArray(details)) return null;
      const retryInfo = details.find((d: any) => d && typeof d === 'object' && d['@type']?.includes('RetryInfo'));
      const retryDelay = retryInfo?.retryDelay;
      if (typeof retryDelay !== 'string') return null;
      const m = retryDelay.match(/^(\d+)s$/);
      if (!m) return null;
      const s = Number(m[1]);
      return Number.isFinite(s) ? s : null;
    }

    async function runOnce(modelName: string): Promise<ModelAttempt> {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });

        const req = buildGeminiRequest(entries);
        // Use streaming and accumulate text ourselves. In some cases the aggregated
        // response text can appear truncated even when more chunks were streamed.
        const streamRes = await model.generateContentStream({
          systemInstruction: req.systemInstruction,
          contents: [{ role: 'user', parts: [{ text: req.userText }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema,
            temperature: 0.0,
            // Keep this high to avoid accidental truncation.
            maxOutputTokens: 2048
          }
        });

        let streamedText = '';
        let streamedChunks = 0;
        for await (const chunk of streamRes.stream) {
          const t = typeof (chunk as any)?.text === 'function' ? (chunk as any).text() : null;
          if (typeof t === 'string') streamedText += t;
          streamedChunks++;
        }

        const res = await streamRes.response;
        const candidate0 = (res as any)?.candidates?.[0];
        const parts = candidate0?.content?.parts;
        const partsCount = Array.isArray(parts) ? parts.length : null;

        // Prefer joining parts, in case `text()` isn't returning the full content.
        const joinedText =
          Array.isArray(parts) && parts.length
            ? parts.map((p: any) => (typeof p?.text === 'string' ? p.text : '')).join('')
            : null;

        const aggregatedText = joinedText ?? (typeof (res as any)?.text === 'function' ? (res as any).text() : '');
        const text = streamedText.length >= aggregatedText.length ? streamedText : aggregatedText;
        const finishReason = (candidate0?.finishReason as string | undefined | null) ?? null;

        // If debug is on, include a hint in the preview (no user data).
        if (input.debug && streamedChunks > 1 && streamedText.length !== aggregatedText.length) {
          logger.debug('Gemini stream/aggregate length mismatch', {
            modelName,
            streamedChunks,
            streamedLen: streamedText.length,
            aggregatedLen: aggregatedText.length
          });
        }

        return { ok: true, modelName, text, finishReason, partsCount };
      } catch (e) {
        const status = (e as any)?.status;
        const errorStatus = typeof status === 'number' ? status : null;
        const message =
          typeof (e as any)?.message === 'string'
            ? String((e as any).message)
            : 'Gemini request failed.';
        return {
          ok: false,
          modelName,
          errorStatus,
          errorMessage: message,
          retryAfterSeconds: extractRetryAfterSeconds(e)
        };
      }
    }

    const attempt1 = await runOnce(resolvedModelName);
    if (!attempt1.ok) {
      return {
        ok: true,
        value: {
          shouldSpeak: false,
          reflection: null,
          themes: [],
          invitation: null,
          timeRange: null,
          debug: input.debug
            ? {
                attempted: true,
                reason: attempt1.errorStatus === 429 ? 'rate_limited' : 'model_error',
                entriesCount: entries.filter((e) => !e.ventEntry).length,
                spanDays: computeSpanDays(entries.filter((e) => !e.ventEntry)),
                modelName: attempt1.modelName,
                errorStatus: attempt1.errorStatus,
                errorMessage: attempt1.errorMessage,
                retryAfterSeconds: attempt1.retryAfterSeconds
              }
            : undefined
        }
      };
    }

    let parsedJson = parseBestJsonFromModelText(attempt1.text);
    let finalModelName = attempt1.modelName;
    let finalFinishReason = attempt1.finishReason;
    let finalText = attempt1.text;

    // NOTE: No second attempt / fallback model here. Retrying doubles request volume and
    // makes rate limiting much worse. We instead focus on making the single attempt stable.
    const retryDebug = undefined;

    if (parsedJson == null) {
      const outputPreview1 = stripCodeFences(attempt1.text).slice(0, 600);
      if (input.debug) {
        logger.warn('Gemini returned unparseable JSON', {
          modelName: attempt1.modelName,
          finishReason: attempt1.finishReason,
          partsCount: attempt1.partsCount,
          outputLength: attempt1.text.length,
          outputPreview: outputPreview1
        });
      }
      return {
        ok: true,
        value: {
          shouldSpeak: false,
          reflection: null,
          themes: [],
          invitation: null,
          timeRange: null,
          debug: input.debug
            ? {
                attempted: true,
                reason: 'invalid_json',
                entriesCount: entries.filter((e) => !e.ventEntry).length,
                spanDays: computeSpanDays(entries.filter((e) => !e.ventEntry)),
                modelName: attempt1.modelName,
                finishReason: attempt1.finishReason,
                outputLength: attempt1.text.length,
                outputPreview: outputPreview1,
                retry: retryDebug
              }
            : undefined
        }
      };
    }

    const parsed = modelResponseSchema.safeParse(parsedJson);
    if (!parsed.success) {
      return {
        ok: true,
        value: {
          shouldSpeak: false,
          reflection: null,
          themes: [],
          invitation: null,
          timeRange: null,
          debug: input.debug
            ? {
                attempted: true,
                reason: 'invalid_shape',
                entriesCount: entries.filter((e) => !e.ventEntry).length,
                spanDays: computeSpanDays(entries.filter((e) => !e.ventEntry)),
                modelName: finalModelName,
                finishReason: finalFinishReason,
                outputLength: finalText.length,
                outputPreview: stripCodeFences(finalText).slice(0, 600),
                retry: retryDebug
              }
            : undefined
        }
      };
    }

    const sanitized = sanitizeOutput({
      reflection: parsed.data.reflection,
      themes: parsed.data.themes
    });
    if (!sanitized.ok) {
      const nonVent = entries.filter((e) => !e.ventEntry);
      const spanDays = computeSpanDays(nonVent);
      const timeRange = describeTimeRange(spanDays);
      return {
        ok: true,
        value: {
          // Degrade gracefully: if the model used disallowed language, return a neutral
          // time-based reflection instead of going silent.
          shouldSpeak: true,
          timeRange,
          reflection: `${timeRange}, I’m noticing some repeating threads, but I can’t put them into words cleanly right now.`,
          themes: [],
          invitation: null,
          debug: input.debug
            ? {
                attempted: true,
                reason: 'banned_language',
                entriesCount: nonVent.length,
                spanDays,
                modelName: finalModelName,
                finishReason: finalFinishReason,
                outputLength: finalText.length,
                outputPreview: stripCodeFences(finalText).slice(0, 600),
                retry: retryDebug
              }
            : undefined
        }
      };
    }

    if (!parsed.data.shouldSpeak) {
      const nonVent = entries.filter((e) => !e.ventEntry);
      const spanDays = computeSpanDays(nonVent);
      const timeRange = describeTimeRange(spanDays);
      return {
        ok: true,
        value: {
          shouldSpeak: true,
          timeRange,
          reflection: `${timeRange}, I’m not seeing a clear repeating pattern yet.`,
          themes: [],
          invitation: null,
          debug: input.debug
            ? {
                attempted: true,
                reason: 'model_silence',
                entriesCount: nonVent.length,
                spanDays,
                modelName: finalModelName,
                finishReason: finalFinishReason,
                outputLength: finalText.length,
                outputPreview: stripCodeFences(finalText).slice(0, 600),
                retry: retryDebug
              }
            : undefined
        }
      };
    }

    // Extra guard: require a time-based phrase somewhere if it speaks.
    const reflection = (sanitized.value.reflection ?? '').trim();
    if (!reflection) {
      return {
        ok: true,
        value: {
          shouldSpeak: false,
          reflection: null,
          themes: [],
          invitation: null,
          timeRange: null,
          debug: input.debug
            ? {
                attempted: true,
                reason: 'empty_reflection',
                entriesCount: entries.filter((e) => !e.ventEntry).length,
                spanDays: computeSpanDays(entries.filter((e) => !e.ventEntry)),
                modelName: finalModelName,
                finishReason: finalFinishReason,
                outputLength: finalText.length,
                outputPreview: stripCodeFences(finalText).slice(0, 600),
                retry: retryDebug
              }
            : undefined
        }
      };
    }

    return {
      ok: true,
      value: {
        shouldSpeak: true,
        reflection,
        themes: sanitized.value.themes.map((t) => t.trim()).filter(Boolean),
        invitation: null,
        timeRange: parsed.data.timeRange?.trim() || null,
        debug: input.debug
          ? {
              attempted: true,
              reason: 'spoke',
              entriesCount: entries.filter((e) => !e.ventEntry).length,
              spanDays: computeSpanDays(entries.filter((e) => !e.ventEntry)),
              modelName: finalModelName,
              finishReason: finalFinishReason,
              outputLength: finalText.length,
              outputPreview: stripCodeFences(finalText).slice(0, 600),
              retry: retryDebug
            }
          : undefined
      }
    };
  } catch (e) {
    logger.error('generateJournalPatterns failed', e);
    return { ok: false, error: { message: 'Failed to generate patterns.' } };
  }
}

