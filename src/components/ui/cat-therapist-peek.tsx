"use client";

import Image from 'next/image';
import { useMemo, useState } from 'react';

import { useListenOnly } from '@/components/settings/listen-only-provider';

export function CatTherapistPeek() {
  const { listenOnly } = useListenOnly();
  const [isHover, setIsHover] = useState(false);

  // Resting peek:
  // - normal: ~30% (half eyes)
  // - listen-only: ~20% (ears only)
  const restPeek = listenOnly ? 0.2 : 0.3;
  const hoverPeek = 0.5;

  const peek = isHover ? hoverPeek : restPeek;
  const size = useMemo(() => 260, []);

  return (
    <button
      aria-label="Open therapist (coming soon)"
      className="fixed bottom-0 left-1/2 z-40 -translate-x-1/2 select-none"
      onClick={() => {
        // TODO: wire to therapist chat / panel
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
        <Image
          alt=""
          height={size}
          priority={false}
          src="/cat-therapist.png"
          width={size}
        />
      </div>
    </button>
  );
}

