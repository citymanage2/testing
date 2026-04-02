// ─── Palette ──────────────────────────────────────────────────────────────────
export const C = {
    primary: '#2563EB',
    primaryDark: '#1D4ED8',
    primaryBg: '#EFF6FF',
    surface: '#FFFFFF',
    surfaceAlt: '#F9FAFB', // table header bg, zebra rows
    pageBg: '#F4F6F9', // page / layout background
    surfaceHover: '#EFF6FF', // row hover
    border: '#E5E7EB',
    borderFocus: '#93C5FD',
    text: '#111827',
    textSec: '#6B7280',
    textMuted: '#9CA3AF',
    danger: '#EF4444',
    dangerBg: '#FEF2F2',
    dangerBorder: '#FECACA',
    success: '#10B981',
    successBg: '#D1FAE5',
    warning: '#F59E0B',
    warningBg: '#FEF3C7',
    sidebarBg: '#FFFFFF',
};
// ─── Typography ───────────────────────────────────────────────────────────────
export const T = {
    h1: { fontSize: 24, fontWeight: 700, color: C.text, margin: 0 },
    h2: { fontSize: 18, fontWeight: 600, color: C.text, margin: 0 },
    h3: { fontSize: 14, fontWeight: 600, color: C.text, margin: 0 },
    body: { fontSize: 13, color: C.text },
    small: { fontSize: 12, color: C.textSec },
    label: { fontSize: 13, fontWeight: 500, color: C.text, display: 'block', marginBottom: 4 },
};
// ─── Buttons ──────────────────────────────────────────────────────────────────
const BASE_BTN = {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    border: 'none', borderRadius: 8, cursor: 'pointer',
    fontFamily: 'inherit', fontWeight: 500, lineHeight: 1, whiteSpace: 'nowrap',
    transition: 'opacity .15s, background .15s',
};
export function btnPrimary(size = 'md') {
    return { ...BASE_BTN, ...SIZES[size], background: C.primary, color: '#fff' };
}
export function btnOutline(size = 'md') {
    return { ...BASE_BTN, ...SIZES[size], background: C.surface, color: C.text, border: `1px solid ${C.border}` };
}
export function btnGhost(size = 'md') {
    return { ...BASE_BTN, ...SIZES[size], background: 'transparent', color: C.textSec, border: 'none' };
}
export function btnDanger(size = 'md') {
    return { ...BASE_BTN, ...SIZES[size], background: C.dangerBg, color: C.danger, border: `1px solid ${C.dangerBorder}` };
}
const SIZES = {
    sm: { fontSize: 12, padding: '4px 10px' },
    md: { fontSize: 13, padding: '7px 14px' },
    lg: { fontSize: 14, padding: '10px 20px', fontWeight: 600 },
};
// ─── Inputs ───────────────────────────────────────────────────────────────────
export const INPUT = {
    padding: '7px 11px', border: `1px solid ${C.border}`, borderRadius: 6,
    fontSize: 13, color: C.text, background: C.surface, outline: 'none',
    width: '100%', boxSizing: 'border-box', fontFamily: 'inherit',
};
export const LBL = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 500, color: C.text };
// ─── Cards & surfaces ─────────────────────────────────────────────────────────
export const CARD = {
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 12, padding: '16px 20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
};
// ─── Table cells ──────────────────────────────────────────────────────────────
export const TH = {
    padding: '8px 8px', textAlign: 'left', fontWeight: 600, fontSize: 12,
    color: C.textSec, background: C.surfaceAlt, borderBottom: `1px solid ${C.border}`,
    whiteSpace: 'nowrap',
};
export const TD = {
    padding: '7px 8px', borderBottom: `1px solid ${C.border}`,
    fontSize: 13, color: C.text, verticalAlign: 'middle',
    fontVariantNumeric: 'tabular-nums',
};
// ─── Toolbar / action groups ──────────────────────────────────────────────────
export const TOOLBAR = {
    display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
};
export const TOOLBAR_SEP = {
    width: 1, height: 20, background: C.border, margin: '0 4px', flexShrink: 0,
};
// ─── Badge ────────────────────────────────────────────────────────────────────
export function badge(color, bg) {
    return { display: 'inline-block', padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 500, background: bg, color };
}
// ─── Overlay / modal ──────────────────────────────────────────────────────────
export const OVERLAY = {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
export const MODAL = {
    background: C.surface, borderRadius: 12, padding: '24px 28px',
    width: '90%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,.18)',
};
