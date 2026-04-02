/** Единая дизайн-система СМ Смета */
import type { CSSProperties } from 'react';

// ─── Palette ──────────────────────────────────────────────────────────────────
export const C = {
  primary:       '#2563EB',
  primaryDark:   '#1D4ED8',
  primaryBg:     '#EFF6FF',
  surface:       '#FFFFFF',
  surfaceAlt:    '#F9FAFB',   // table header bg, zebra rows
  pageBg:        '#F4F6F9',   // page / layout background
  surfaceHover:  '#EFF6FF',   // row hover
  border:        '#E5E7EB',
  borderFocus:   '#93C5FD',
  text:          '#111827',
  textSec:       '#6B7280',
  textMuted:     '#9CA3AF',
  danger:        '#EF4444',
  dangerBg:      '#FEF2F2',
  dangerBorder:  '#FECACA',
  success:       '#10B981',
  successBg:     '#D1FAE5',
  warning:       '#F59E0B',
  warningBg:     '#FEF3C7',
  sidebarBg:     '#FFFFFF',
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────
export const T = {
  h1: { fontSize: 24, fontWeight: 700, color: C.text, margin: 0 } as CSSProperties,
  h2: { fontSize: 18, fontWeight: 600, color: C.text, margin: 0 } as CSSProperties,
  h3: { fontSize: 14, fontWeight: 600, color: C.text, margin: 0 } as CSSProperties,
  body: { fontSize: 13, color: C.text } as CSSProperties,
  small: { fontSize: 12, color: C.textSec } as CSSProperties,
  label: { fontSize: 13, fontWeight: 500, color: C.text, display: 'block', marginBottom: 4 } as CSSProperties,
} as const;

// ─── Buttons ──────────────────────────────────────────────────────────────────
const BASE_BTN: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  border: 'none', borderRadius: 8, cursor: 'pointer',
  fontFamily: 'inherit', fontWeight: 500, lineHeight: 1, whiteSpace: 'nowrap',
  transition: 'opacity .15s, background .15s',
};

export function btnPrimary(size: 'sm' | 'md' | 'lg' = 'md'): CSSProperties {
  return { ...BASE_BTN, ...SIZES[size], background: C.primary, color: '#fff' };
}
export function btnOutline(size: 'sm' | 'md' | 'lg' = 'md'): CSSProperties {
  return { ...BASE_BTN, ...SIZES[size], background: C.surface, color: C.text, border: `1px solid ${C.border}` };
}
export function btnGhost(size: 'sm' | 'md' | 'lg' = 'md'): CSSProperties {
  return { ...BASE_BTN, ...SIZES[size], background: 'transparent', color: C.textSec, border: 'none' };
}
export function btnDanger(size: 'sm' | 'md' | 'lg' = 'md'): CSSProperties {
  return { ...BASE_BTN, ...SIZES[size], background: C.dangerBg, color: C.danger, border: `1px solid ${C.dangerBorder}` };
}

const SIZES = {
  sm:  { fontSize: 12, padding: '4px 10px' },
  md:  { fontSize: 13, padding: '7px 14px' },
  lg:  { fontSize: 14, padding: '10px 20px', fontWeight: 600 },
} as const;

// ─── Inputs ───────────────────────────────────────────────────────────────────
export const INPUT: CSSProperties = {
  padding: '7px 11px', border: `1px solid ${C.border}`, borderRadius: 6,
  fontSize: 13, color: C.text, background: C.surface, outline: 'none',
  width: '100%', boxSizing: 'border-box', fontFamily: 'inherit',
};
export const LBL: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 500, color: C.text };

// ─── Cards & surfaces ─────────────────────────────────────────────────────────
export const CARD: CSSProperties = {
  background: C.surface, border: `1px solid ${C.border}`,
  borderRadius: 12, padding: '16px 20px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
};

// ─── Table cells ──────────────────────────────────────────────────────────────
export const TH: CSSProperties = {
  padding: '8px 8px', textAlign: 'left', fontWeight: 600, fontSize: 12,
  color: C.textSec, background: C.surfaceAlt, borderBottom: `1px solid ${C.border}`,
  whiteSpace: 'nowrap',
};
export const TD: CSSProperties = {
  padding: '7px 8px', borderBottom: `1px solid ${C.border}`,
  fontSize: 13, color: C.text, verticalAlign: 'middle',
  fontVariantNumeric: 'tabular-nums',
};

// ─── Toolbar / action groups ──────────────────────────────────────────────────
export const TOOLBAR: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
};
export const TOOLBAR_SEP: CSSProperties = {
  width: 1, height: 20, background: C.border, margin: '0 4px', flexShrink: 0,
};

// ─── Badge ────────────────────────────────────────────────────────────────────
export function badge(color: string, bg: string): CSSProperties {
  return { display: 'inline-block', padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 500, background: bg, color };
}

// ─── Overlay / modal ──────────────────────────────────────────────────────────
export const OVERLAY: CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
export const MODAL: CSSProperties = {
  background: C.surface, borderRadius: 12, padding: '24px 28px',
  width: '90%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,.18)',
};
