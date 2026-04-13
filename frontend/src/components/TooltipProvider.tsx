/**
 * Global tooltip provider.
 * Any element with data-tooltip="..." will show a styled tooltip on hover.
 * Usage: <button data-tooltip="Описание кнопки">...</button>
 */
import { useEffect, useRef, useCallback } from 'react';

const PAD = 12;        // gap between cursor and tooltip box
const MAX_W = 280;     // max tooltip width px

export default function TooltipProvider() {
  const boxRef = useRef<HTMLDivElement | null>(null);

  const show = useCallback((text: string, x: number, y: number) => {
    const box = boxRef.current;
    if (!box) return;
    box.textContent = text;
    box.style.display = 'block';

    // Position: prefer below-right, flip if near edge
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const bw = box.offsetWidth;
    const bh = box.offsetHeight;

    let left = x + PAD;
    let top  = y + PAD;
    if (left + bw > vw - 8) left = x - bw - PAD;
    if (top  + bh > vh - 8) top  = y - bh - PAD;

    box.style.left = `${Math.max(8, left)}px`;
    box.style.top  = `${Math.max(8, top)}px`;
  }, []);

  const hide = useCallback(() => {
    if (boxRef.current) boxRef.current.style.display = 'none';
  }, []);

  useEffect(() => {
    function findTooltip(el: Element | null): string | null {
      let cur = el;
      while (cur && cur !== document.body) {
        const t = (cur as HTMLElement).dataset?.tooltip;
        if (t) return t;
        cur = cur.parentElement;
      }
      return null;
    }

    function onMove(e: MouseEvent) {
      const text = findTooltip(e.target as Element);
      if (text) show(text, e.clientX, e.clientY);
      else hide();
    }

    function onOut(e: MouseEvent) {
      const to = e.relatedTarget as Element | null;
      if (!to || !findTooltip(to)) hide();
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseout', onOut);
    document.addEventListener('mouseleave', hide);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseout', onOut);
      document.removeEventListener('mouseleave', hide);
    };
  }, [show, hide]);

  return (
    <div
      ref={boxRef}
      style={{
        display: 'none',
        position: 'fixed',
        zIndex: 99999,
        maxWidth: MAX_W,
        padding: '7px 11px',
        background: 'rgba(30, 30, 40, 0.93)',
        color: '#fff',
        fontSize: 12.5,
        lineHeight: 1.45,
        borderRadius: 7,
        boxShadow: '0 4px 18px rgba(0,0,0,.28)',
        pointerEvents: 'none',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    />
  );
}
