"use client";

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';

type Pos = { readonly left: number; readonly top: number };

export function VentingHintOverlay(props: {
  readonly targetSelector: string;
}) {
  const [pos, setPos] = useState<Pos | null>(null);

  const size = useMemo(() => ({ width: 360, height: 240 }), []);

  useEffect(() => {
    let raf: number | null = null;

    function recompute() {
      raf = null;
      const el = document.querySelector(props.targetSelector) as HTMLElement | null;
      if (!el) {
        setPos(null);
        return;
      }

      const r = el.getBoundingClientRect();

      // Position the hint above-left of the ribbon.
      const left = Math.max(8, r.left - size.width + 16);
      const top = Math.max(8, r.top - size.height - 12);
      setPos({ left, top });
    }

    function schedule() {
      if (raf != null) return;
      raf = window.requestAnimationFrame(recompute);
    }

    schedule();
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, { passive: true });

    return () => {
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule);
      if (raf != null) window.cancelAnimationFrame(raf);
    };
  }, [props.targetSelector, size.height, size.width]);

  if (!pos) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none hidden sm:block"
      style={{ position: 'fixed', right: 175, top: 20, zIndex: 10001 }}
    >
      <Image alt="" height={200} src="/justventing.png" width={200} />
    </div>
  );
}

