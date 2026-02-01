"use client";

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

import { useListenOnly } from '@/components/settings/listen-only-provider';
import { getSupabaseBrowserClient } from '@/utils/supabase/browser-client';

const SUPPORT_OPTIONS = [
  'Some people talk with a partner, friend, or family member about how things have been feeling. This is not to fix it, just to be less alone with it.',
  'Some people find it helpful to mention mood or overwhelm to a provider they already see, like an OB, midwife, or primary care doctor.',
  'Some people look for support from someone familiar with postpartum changes, like a therapist or group that focuses on this stage of life.',
  "Getting support doesn’t have to mean things are ‘bad enough.’ Some people reach out simply because carrying it alone feels heavy."
] as const;

const UNDERSTANDING_PPD = [
  'Many people notice mood shifts when hard days stack up without much rest or relief. This isn’t a personal failure; it’s often what prolonged exhaustion and responsibility feel like.',
  'Postpartum mood changes don’t always show up right away. For some people, they appear weeks or months later, especially when support drops or demands increase.',
  'Postpartum struggles don’t always look like sadness. Irritability, anger, or feeling emotionally flat can also show up during this period.',
  'It’s common to feel love for a baby and still feel overwhelmed, resentful, or unsure. Mixed feelings don’t cancel each other out.'
] as const;

const OTHERS_TRY = [
  'Some people try lowering expectations for a while, letting non-essential things slide, or narrowing their focus to just getting through the day.',
  'Some people find it helpful to vent without fixing, write things down to get them out of their head, or name that a day is just heavy.',
  'Some people try accepting help in small ways, like meals, childcare, or fewer responsibilities for a bit.'
] as const;

function pickRandom<T>(items: readonly T[]): T {
  const idx = Math.floor(Math.random() * items.length);
  return items[Math.max(0, Math.min(items.length - 1, idx))] as T;
}

export function CatPeek() {
  const { listenOnly } = useListenOnly();
  const [isHover, setIsHover] = useState(false);
  const [open, setOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [animatedReflection, setAnimatedReflection] = useState<string>('');
  const [moreCard, setMoreCard] = useState<{ readonly title: string; readonly body: string } | null>(null);
  const [status, setStatus] = useState<
    | { readonly type: 'idle' }
    | { readonly type: 'loading' }
    | {
        readonly type: 'ready';
        readonly timeRange: string | null;
        readonly reflection: string | null;
        readonly themes: readonly string[];
      }
    | { readonly type: 'message'; readonly message: string }
    | { readonly type: 'error'; readonly message: string }
  >({ type: 'idle' });

  // Resting peek:
  // - normal: ~30% (half eyes)
  // - listen-only: ~20% (ears only)
  const restPeek = listenOnly ? 0.2 : 0.3;
  // Hover peek:
  // - normal: show more
  // - listen-only: only up to half eyes (~30%)
  const hoverPeek = listenOnly ? 0.3 : 0.5;

  const peek = isHover ? hoverPeek : restPeek;
  const size = useMemo(() => 260, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (status.type !== 'ready') return;

    const full = (status.reflection ?? '').trim();
    if (!full) {
      setAnimatedReflection('');
      return;
    }

    // "Token-by-token" feel: animate word-by-word (including spaces).
    const tokens = full.split(/(\s+)/);
    let i = 0;
    setAnimatedReflection('');

    const id = window.setInterval(() => {
      i++;
      setAnimatedReflection(tokens.slice(0, i).join(''));
      if (i >= tokens.length) window.clearInterval(id);
    }, 45);

    return () => window.clearInterval(id);
  }, [open, status]);

  async function fetchPatterns() {
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setStatus({ type: 'error', message: 'Could not read your session.' });
        return;
      }
      const token = data.session?.access_token;
      if (!token) {
        setStatus({ type: 'message', message: 'Sign in to see reflections.' });
        return;
      }

      setStatus({ type: 'loading' });
      const url = process.env.NODE_ENV === 'production' ? '/api/ai/journal-patterns' : '/api/ai/journal-patterns?debug=1';
      const res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      });

      const json = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        const errMsg =
          typeof json === 'object' && json && 'error' in json && typeof (json as any).error === 'string'
            ? ((json as any).error as string)
            : null;

        if (res.status === 401) {
          setStatus({ type: 'message', message: 'Your session expired. Please sign in again.' });
          return;
        }
        if (res.status === 403) {
          setStatus({ type: 'error', message: 'Not allowed to load reflections.' });
          return;
        }
        if (res.status === 503) {
          setStatus({ type: 'error', message: 'Reflections aren’t configured yet.' });
        } else {
          setStatus({
            type: 'error',
            message: errMsg ? `Could not load reflections: ${errMsg}` : 'Could not load reflections.'
          });
        }
        return;
      }

      const parsed = (json ?? {}) as {
        readonly shouldSpeak?: boolean;
        readonly timeRange?: string | null;
        readonly reflection?: string | null;
        readonly themes?: readonly string[];
        readonly debug?: {
          readonly reason?: string;
          readonly entriesCount?: number;
          readonly spanDays?: number | null;
          readonly retryAfterSeconds?: number | null;
        };
        readonly debugMeta?: { readonly totalCount: number; readonly ventCount: number; readonly nonVentCount: number };
      };

      if (!parsed.shouldSpeak) {
        const dbg =
          parsed.debug && parsed.debugMeta
            ? ` (debug: ${parsed.debugMeta.nonVentCount}/${parsed.debugMeta.totalCount} non-vent, reason=${String(
                parsed.debug.reason ?? 'unknown'
              )})`
            : '';
        setStatus({ type: 'message', message: `I don’t have any patterns to reflect back right now.${dbg}` });
        return;
      }

      setStatus({
        type: 'ready',
        timeRange: parsed.timeRange ?? null,
        reflection: parsed.reflection ?? null,
        themes: parsed.themes ?? []
      });
    } catch {
      setStatus({ type: 'error', message: 'Something went wrong.' });
    }
  }

  return (
    <>
      {open ? (
        <button
          aria-label="Close"
          className="fixed inset-0 z-40 cursor-default bg-transparent"
          onClick={() => setOpen(false)}
          type="button"
        />
      ) : null}

      <div className="fixed bottom-0 left-1/2 z-50 -translate-x-1/2 select-none">
        <div className="relative">
          {open ? (
            <>
              {/* Desktop: popover on the right of the cat */}
              <div className="absolute bottom-3 left-full z-50 hidden w-[min(420px,calc(100vw-32px))] translate-x-3 sm:block">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/95 p-4 text-sm text-zinc-100 shadow-2xl backdrop-blur">
                  {listenOnly ? (
                    <div>I&apos;m only listening. I&apos;ll be here if you need me...</div>
                  ) : status.type === 'loading' ? (
                    <div className="text-zinc-300">Listening…</div>
                  ) : status.type === 'error' ? (
                    <div className="text-zinc-300">{status.message}</div>
                  ) : status.type === 'message' ? (
                    <div className="text-zinc-200">{status.message}</div>
                  ) : status.type === 'ready' ? (
                    <div className="space-y-3">
                      <div
                        className={`overflow-hidden transition-[max-height,opacity] duration-200 ${
                          showMore ? 'max-h-0 opacity-0' : 'max-h-[520px] opacity-100'
                        }`}
                      >
                        <div className="text-zinc-100">{animatedReflection || status.reflection || ''}</div>
                      </div>

                      <div
                        className={`overflow-hidden transition-[max-height,opacity] duration-200 ${
                          showMore ? 'max-h-[520px] opacity-100' : 'pointer-events-none max-h-0 opacity-0'
                        }`}
                      >
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="rounded-full border border-zinc-800 bg-zinc-900/40 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-900/70"
                            onClick={() => setMoreCard({ title: 'Support Options', body: pickRandom(SUPPORT_OPTIONS) })}
                            type="button"
                          >
                            Support Options
                          </button>
                          <button
                            className="rounded-full border border-zinc-800 bg-zinc-900/40 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-900/70"
                            onClick={() =>
                              setMoreCard({ title: 'Understanding PPD', body: pickRandom(UNDERSTANDING_PPD) })
                            }
                            type="button"
                          >
                            Understanding PPD
                          </button>
                          <button
                            className="rounded-full border border-zinc-800 bg-zinc-900/40 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-900/70"
                            onClick={() => setMoreCard({ title: 'Others try', body: pickRandom(OTHERS_TRY) })}
                            type="button"
                          >
                            Others try
                          </button>
                        </div>
                        {moreCard ? (
                          <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
                            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
                              {moreCard.title}
                            </div>
                            <div className="text-sm text-zinc-100">{moreCard.body}</div>
                          </div>
                        ) : null}
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          className="rounded-full border border-zinc-800 bg-zinc-900/40 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-900/70"
                          onClick={() => {
                            setShowMore((v) => !v);
                            setMoreCard(null);
                          }}
                          type="button"
                        >
                          {showMore ? 'Back' : 'Show more'}
                        </button>
                        <button
                          className="rounded-full border border-zinc-800 bg-zinc-900/40 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-900/70"
                          onClick={() => setOpen(false)}
                          type="button"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-zinc-300" />
                  )}
                </div>
              </div>

              {/* Mobile: fall back to above to avoid off-screen overflow */}
              <div className="mx-auto mb-3 w-[min(92vw,420px)] rounded-2xl border border-zinc-800 bg-zinc-950/95 p-4 text-sm text-zinc-100 shadow-2xl backdrop-blur sm:hidden">
                {listenOnly ? (
                  <div>I&apos;m only listening. I&apos;ll be here if you need me...</div>
                ) : status.type === 'loading' ? (
                  <div className="text-zinc-300">Listening…</div>
                ) : status.type === 'error' ? (
                  <div className="text-zinc-300">{status.message}</div>
                ) : status.type === 'message' ? (
                  <div className="text-zinc-200">{status.message}</div>
                ) : status.type === 'ready' ? (
                  <div className="space-y-3">
                    <div
                      className={`overflow-hidden transition-[max-height,opacity] duration-200 ${
                        showMore ? 'max-h-0 opacity-0' : 'max-h-[520px] opacity-100'
                      }`}
                    >
                      <div className="text-zinc-100">{animatedReflection || status.reflection || ''}</div>
                    </div>

                    <div
                      className={`overflow-hidden transition-[max-height,opacity] duration-200 ${
                        showMore ? 'max-h-[520px] opacity-100' : 'pointer-events-none max-h-0 opacity-0'
                      }`}
                    >
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-full border border-zinc-800 bg-zinc-900/40 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-900/70"
                          onClick={() => setMoreCard({ title: 'Support Options', body: pickRandom(SUPPORT_OPTIONS) })}
                          type="button"
                        >
                          Support Options
                        </button>
                        <button
                          className="rounded-full border border-zinc-800 bg-zinc-900/40 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-900/70"
                          onClick={() => setMoreCard({ title: 'Understanding PPD', body: pickRandom(UNDERSTANDING_PPD) })}
                          type="button"
                        >
                          Understanding PPD
                        </button>
                        <button
                          className="rounded-full border border-zinc-800 bg-zinc-900/40 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-900/70"
                          onClick={() => setMoreCard({ title: 'Others try', body: pickRandom(OTHERS_TRY) })}
                          type="button"
                        >
                          Others try
                        </button>
                      </div>
                      {moreCard ? (
                        <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
                          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
                            {moreCard.title}
                          </div>
                          <div className="text-sm text-zinc-100">{moreCard.body}</div>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        className="rounded-full border border-zinc-800 bg-zinc-900/40 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-900/70"
                        onClick={() => {
                          setShowMore((v) => !v);
                          setMoreCard(null);
                        }}
                        type="button"
                      >
                        {showMore ? 'Back' : 'Show more'}
                      </button>
                      <button
                        className="rounded-full border border-zinc-800 bg-zinc-900/40 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-900/70"
                        onClick={() => setOpen(false)}
                        type="button"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-zinc-300" />
                )}
              </div>
            </>
          ) : null}

          <button
            aria-label="Cat"
            className="relative z-50"
            onClick={() => {
              const next = !open;
              setOpen(next);
              setShowMore(false);
              setMoreCard(null);
              if (!next) return;

              if (listenOnly) {
                setStatus({ type: 'message', message: "I'm only listening. I'll be here if you need me..." });
                return;
              }

              void fetchPatterns();
            }}
            onMouseEnter={() => setIsHover(true)}
            onMouseLeave={() => setIsHover(false)}
            type="button"
          >
            <div
              className="overflow-hidden"
              style={{
                width: `${size}px`,
                height: `calc(${size}px * ${peek})`,
                transition: 'height 200ms ease-out'
              }}
            >
              <Image alt="" height={size} priority={false} src="/cat-therapist.png" width={size} />
            </div>
          </button>
        </div>
      </div>
    </>
  );
}

