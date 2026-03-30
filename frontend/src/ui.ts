/** Единая дизайн-система СМ Смета */
import type { CSSProperties } from 'react';

// ─── Palette ──────────────────────────────────────────────────────────────────
export const C = {
  primary:       '#2563eb',
  primaryDark:   '#1d4ed8',
  primaryBg:     '#eff6ff',
  surface:       '#ffffff',
  surfaceAlt:    '#f8fafc',
  surfaceHover:  '#f1f5f9',
  border:        '#e2e8f0',
  borderFocus:   '#93c5fd',
  text:          '#0f172a',
  textSec:       '#64748b',
  textMuted:     '#94a3b8',
  danger:        '#dc2626',
  dangerBg:      '#fef2f2',
  dangerBorder:  '#fecaca',
  success:       '#16a34a',
  successBg:     '#f0fdf4',
  warning:       '#d97706',
  warningBg:     '#fffbeb',
  headerBg:      '#0f172a',
  sidebarBg:     '#f8fafc',
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────
export const T = {
  h1: { fontSize: 22, fontWeight: 700, color: C.text, margin: 0 } as CSSProperties,
  h2: { fontSize: 18, fontWeight: 600, color: C.text, margin: 0 } as CSSProperties,
  h3: { fontSize: 15, fontWeight: 600, color: C.text, margin: 0 } as CSSProperties,
  body: { fontSize: 13, color: C.text } as CSSProperties,
  small: { fontSize: 12, color: C.textSec } as CSSProperties,
  label: { fontSize: 13, fontWeight: 500, color: C.text, display: 'block', marginBottom: 4 } as CSSProperties,
} as const;

// ─── Buttons ──────────────────────────────────────────────────────────────────
const BASE_BTN: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  border: 'none', borderRadius: 6, cursor: 'pointer',
  fontFamily: 'inherit', fontWeight: 500, lineHeight: 1, whiteSpace: 'nowrap',
  transition: 'opacity .15s',
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
  md:  { fontSize: 13, padding: '6px 14px' },
  lg:  { fontSize: 14, padding: '9px 20px', fontWeight: 600 },
} as const;

// ─── Inputs ───────────────────────────────────────────────────────────────────
export const INPUT: CSSProperties = {
  padding: '7px 11px', border: `1px solid ${C.border}`, borderRadius: 6,
  fontSize: 13, color: C.text, background: C.surface, outline: 'none',
  width: '100%', boxSizing: 'border-box',
};
export const LBL: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 500, color: C.text };

// ─── Cards & surfaces ─────────────────────────────────────────────────────────
export const CARD: CSSProperties = {
  background: C.surface, border: `1px solid ${C.border}`,
  borderRadius: 8, padding: '16px 20px',
};

// ─── Table cells ──────────────────────────────────────────────────────────────
export const TH: CSSProperties = {
  padding: '9px 10px', textAlign: 'left', fontWeight: 600, fontSize: 12,
  color: C.textSec, background: C.surfaceAlt, borderBottom: `1px solid ${C.border}`,
  whiteSpace: 'nowrap',
};
export const TD: CSSProperties = {
  padding: '8px 10px', borderBottom: `1px solid ${C.border}`,
  fontSize: 13, color: C.text, verticalAlign: 'middle',
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
  return { display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500, background: bg, color };
}

// ─── Overlay / modal ──────────────────────────────────────────────────────────
export const OVERLAY: CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
export const MODAL: CSSProperties = {
  background: C.surface, borderRadius: 10, padding: '24px 28px',
  width: '90%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,.2)',
};
