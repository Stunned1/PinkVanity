"use client";

import { useEffect, useRef, useState } from 'react';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
}

function isCoarsePointer(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
}

export function CursorGlow() {
  const [enabled, setEnabled] = useState(false);
  const [visible, setVisible] = useState(false);
  const rafRef = useRef<number | null>(null);
  const targetRef = useRef<{ x: number; y: number } | null>(null);
  const currentRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (isCoarsePointer()) return;

    setEnabled(true);
    document.body.classList.add('custom-dot-cursor');

    const clickableSelector =
      'a,button,[role="button"],input,textarea,select,summary,label,[data-clickable="true"]';

    function onMove(e: MouseEvent) {
      setVisible(true);
      targetRef.current = { x: e.clientX, y: e.clientY };
      if (!currentRef.current) currentRef.current = { x: e.clientX, y: e.clientY };

      // Dot follows instantly (no delay).
      document.documentElement.style.setProperty('--cursor-dot-x', `${e.clientX}px`);
      document.documentElement.style.setProperty('--cursor-dot-y', `${e.clientY}px`);

      if (rafRef.current == null) rafRef.current = window.requestAnimationFrame(tick);
    }

    function setHoverClickable(next: boolean) {
      document.body.classList.toggle('cursor-over-clickable', next);
    }

    function isClickableElement(el: Element | null): boolean {
      if (!el) return false;
      return Boolean(el.closest(clickableSelector));
    }

    function onMouseOver(e: MouseEvent) {
      setHoverClickable(isClickableElement(e.target as Element | null));
    }

    function onMouseOut(e: MouseEvent) {
      const related = e.relatedTarget as Element | null;
      setHoverClickable(isClickableElement(related));
    }

    function onLeave() {
      setVisible(false);
      setHoverClickable(false);
    }

    function tick() {
      rafRef.current = null;

      const target = targetRef.current;
      const current = currentRef.current;
      if (!target || !current) return;

      // “Delay” feel: ease the glow toward the cursor instead of snapping.
      const lerp = 0.12;
      const nextX = current.x + (target.x - current.x) * lerp;
      const nextY = current.y + (target.y - current.y) * lerp;
      currentRef.current = { x: nextX, y: nextY };

      // Glow follows with delay.
      document.documentElement.style.setProperty('--cursor-x', `${nextX}px`);
      document.documentElement.style.setProperty('--cursor-y', `${nextY}px`);

      const dx = target.x - nextX;
      const dy = target.y - nextY;
      const stillMoving = Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5;

      if (stillMoving) {
        rafRef.current = window.requestAnimationFrame(tick);
      }
    }

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseover', onMouseOver, true);
    window.addEventListener('mouseout', onMouseOut, true);
    window.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseover', onMouseOver, true);
      window.removeEventListener('mouseout', onMouseOut, true);
      window.removeEventListener('mouseleave', onLeave);
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      targetRef.current = null;
      currentRef.current = null;
      document.body.classList.remove('cursor-over-clickable');
      document.body.classList.remove('custom-dot-cursor');
    };
  }, []);

  if (!enabled) return null;

  return (
    <>
      <div aria-hidden className="cursor-glow" />
      {visible ? <div aria-hidden className="cursor-dot" /> : null}
    </>
  );
}

