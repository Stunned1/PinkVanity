"use client";

export function VentingRibbon(props: {
  readonly active: boolean;
  readonly onToggle: () => void;
  readonly className?: string;
}) {
  return (
    <button
      data-venting-ribbon
      aria-pressed={props.active}
      aria-label={props.active ? 'Venting enabled' : 'Mark as venting'}
      className={[
        'venting-ribbon group relative h-10 w-8 shrink-0',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950'
        ,
        props.className ?? ''
      ].join(' ')}
      onClick={(e) => {
        e.stopPropagation();
        props.onToggle();
      }}
      title={props.active ? 'Venting (on)' : 'Venting (off)'}
      type="button"
    >
      {/* Bookmark / ribbon shape */}
      <svg
        className={[
          'venting-ribbon__icon h-10 w-8 drop-shadow-sm transition-colors',
          props.active ? 'text-red-500' : 'text-red-900/40 group-hover:text-red-700/60'
        ].join(' ')}
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        {/* Simple bookmark with notch */}
        <path d="M7 3c-1.1 0-2 .9-2 2v16l7-4 7 4V5c0-1.1-.9-2-2-2H7z" />
      </svg>

    </button>
  );
}

