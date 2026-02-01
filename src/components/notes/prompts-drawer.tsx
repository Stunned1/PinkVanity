"use client";

import { useEffect, useState } from 'react';

export function PromptsDrawer(props: {
  readonly prompts: readonly string[];
  readonly p1Answer: string;
  readonly p2Answer: string;
  readonly onChangeAnswers: (next: { readonly p1Answer: string; readonly p2Answer: string }) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  function toggle() {
    setIsOpen((v) => !v);
  }

  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  return (
    <>
      {/* Click-away backdrop: click anywhere except the tab/drawer to close */}
      {isOpen ? (
        <button
          aria-label="Close prompts"
          className="absolute inset-0 z-10 cursor-default bg-transparent"
          onClick={() => setIsOpen(false)}
          type="button"
        />
      ) : null}

      {/* Drawer + attached handle (move together) */}
      <div
        className={[
          'absolute right-0 top-0 z-20 h-full w-[26rem] max-w-[95vw]',
          'transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-[22rem]'
        ].join(' ')}
      >
        {/* Handle tab (attached to drawer) */}
        <button
          className={[
            'absolute right-[22rem] top-1/2 z-30 -translate-y-1/2',
            'rounded-l-xl rounded-r-none border border-zinc-800 bg-zinc-950/80 px-3 py-2',
            'text-xs font-medium text-zinc-100 backdrop-blur hover:border-zinc-700'
          ].join(' ')}
          onClick={toggle}
          type="button"
        >
          ?
        </button>

        <aside
          className={[
            'absolute right-0 top-0 h-full w-[22rem] max-w-[95vw]',
            'flex flex-col border-l border-zinc-900 bg-zinc-950/95 backdrop-blur'
          ].join(' ')}
        >
          <div className="flex items-center justify-between gap-3 border-b border-zinc-900 px-4 py-3">
            <div className="text-sm font-semibold text-zinc-100">Question prompts</div>
          </div>

          <div className="stylized-scrollbar flex-1 overflow-auto p-4">
            <div className="space-y-3">
              <div className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-3">
                <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Prompt 1
                </div>
                <div className="mt-1 text-sm text-zinc-200">
                  {props.prompts[0] ?? '—'}
                </div>
                <textarea
                  className="stylized-scrollbar mt-2 w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none placeholder:text-zinc-600 focus:border-zinc-600"
                  placeholder="Your answer…"
                  rows={3}
                  value={props.p1Answer}
                  onChange={(e) =>
                    props.onChangeAnswers({ p1Answer: e.target.value, p2Answer: props.p2Answer })
                  }
                />
              </div>

              <div className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-3">
                <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Prompt 2
                </div>
                <div className="mt-1 text-sm text-zinc-200">
                  {props.prompts[1] ?? '—'}
                </div>
                <textarea
                  className="stylized-scrollbar mt-2 w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none placeholder:text-zinc-600 focus:border-zinc-600"
                  placeholder="Your answer…"
                  rows={3}
                  value={props.p2Answer}
                  onChange={(e) =>
                    props.onChangeAnswers({ p1Answer: props.p1Answer, p2Answer: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

