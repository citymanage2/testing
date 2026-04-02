import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAuthStore } from '../store/auth';
import ProjectsSidebar from './ProjectsSidebar';
import NotificationBell from './NotificationBell';
import { C } from '../ui';
import client from '../api/client';
const NAV_LINKS = [
    { path: '/catalog', icon: '📋', label: 'Каталог расценок' },
    { path: '/contractors', icon: '🏢', label: 'Контрагенты' },
    { path: '/calculator', icon: '📐', label: 'Калькулятор' },
    { path: '/settings/company', icon: '⚙️', label: 'Реквизиты компании' },
];
export default function Layout() {
    const navigate = useNavigate();
    const location = useLocation();
    const logout = useAuthStore((s) => s.logout);
    const isAdmin = useAuthStore.getState().role === 'admin';
    const [menuOpen, setMenuOpen] = useState(false);
    const copyLogs = async () => {
        try {
            const r = await client.get('/notifications?limit=50');
            const lines = r.data.map(n => `[${new Date(n.created_at).toLocaleString('ru-RU')}] ${n.title}${n.body ? ': ' + n.body : ''}`);
            const text = lines.length ? lines.join('\n') : '(нет записей)';
            // Try modern clipboard API first, fall back to execCommand
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            }
            else {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            alert('Лог скопирован в буфер обмена');
        }
        catch {
            alert('Не удалось скопировать лог');
        }
    };
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: C.surfaceAlt }, children: [_jsxs("header", { style: {
                    display: 'flex', alignItems: 'center', padding: '0 20px', height: 52,
                    background: C.headerBg, color: '#fff', flexShrink: 0, gap: 12,
                    borderBottom: '1px solid rgba(255,255,255,.08)',
                }, children: [_jsxs("div", { onClick: () => navigate('/task/create'), style: { cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }, children: [_jsx("div", { style: { width: 28, height: 28, borderRadius: 6, background: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff' }, children: "\u0421" }), _jsx("span", { style: { fontSize: 15, fontWeight: 700, letterSpacing: '-.3px' }, children: "\u0421\u041C \u0421\u043C\u0435\u0442\u0430" })] }), _jsx("div", { style: { width: 1, height: 24, background: 'rgba(255,255,255,.12)', margin: '0 4px' } }), _jsxs("button", { onClick: () => navigate('/task/create'), style: { display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: C.primary, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }, children: [_jsx("span", { style: { fontSize: 16, lineHeight: 1 }, children: "+" }), " \u041D\u043E\u0432\u0430\u044F \u0437\u0430\u0434\u0430\u0447\u0430"] }), _jsx("div", { style: { flex: 1 } }), _jsx("nav", { style: { display: 'flex', alignItems: 'center', gap: 2 }, children: NAV_LINKS.map(({ path, icon, label }) => (_jsxs("button", { onClick: () => navigate(path), style: {
                                padding: '5px 10px', border: 'none', background: location.pathname === path ? 'rgba(255,255,255,.12)' : 'transparent',
                                color: location.pathname === path ? '#fff' : 'rgba(255,255,255,.65)',
                                borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500,
                                display: 'flex', alignItems: 'center', gap: 4,
                            }, title: label, children: [icon, " ", _jsx("span", { style: { display: 'none' }, children: label })] }, path))) }), _jsx(NotificationBell, {}), _jsx("div", { style: { width: 1, height: 24, background: 'rgba(255,255,255,.12)', margin: '0 4px' } }), _jsxs("div", { style: { position: 'relative' }, children: [_jsxs("button", { onClick: () => setMenuOpen(v => !v), style: { display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.18)', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 13 }, children: [_jsx("span", { children: "\uD83D\uDC64" }), _jsx("span", { style: { fontSize: 12, opacity: .8 }, children: "\u25BE" })] }), menuOpen && (_jsxs("div", { onMouseLeave: () => setMenuOpen(false), style: { position: 'absolute', right: 0, top: 40, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: '0 8px 30px rgba(0,0,0,.12)', minWidth: 180, zIndex: 999, overflow: 'hidden' }, children: [_jsx("div", { style: { padding: '8px 16px', fontSize: 12, color: C.textSec, borderBottom: `1px solid ${C.border}` }, children: "\u0410\u043A\u043A\u0430\u0443\u043D\u0442" }), NAV_LINKS.map(({ path, icon, label }) => (_jsxs("button", { onClick: () => { navigate(path); setMenuOpen(false); }, style: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 16px', border: 'none', background: location.pathname === path ? C.primaryBg : '#fff', color: location.pathname === path ? C.primary : C.text, cursor: 'pointer', fontSize: 13, textAlign: 'left' }, children: [icon, " ", label] }, path))), isAdmin && (_jsx("button", { onClick: () => { navigate('/admin'); setMenuOpen(false); }, style: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 16px', border: 'none', background: '#fff', color: C.text, cursor: 'pointer', fontSize: 13, borderTop: `1px solid ${C.border}` }, children: "\uD83D\uDEE1 \u0410\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435" })), _jsx("button", { onClick: () => { logout(); navigate('/login'); }, style: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 16px', border: 'none', background: '#fff', color: C.danger, cursor: 'pointer', fontSize: 13, borderTop: `1px solid ${C.border}` }, children: "\u21A9 \u0412\u044B\u0439\u0442\u0438" })] }))] })] }), _jsxs("div", { style: { display: 'flex', flex: 1, overflow: 'hidden' }, children: [_jsx("aside", { style: { width: 244, flexShrink: 0, borderRight: `1px solid ${C.border}`, overflowY: 'auto', background: C.sidebarBg }, children: _jsx(ProjectsSidebar, {}) }), _jsx("main", { style: { flex: 1, overflowY: 'auto', background: C.surfaceAlt }, children: _jsx(Outlet, {}) })] }), _jsx("button", { onClick: copyLogs, title: "\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043B\u043E\u0433 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0441\u0442\u0438", style: {
                    position: 'fixed', bottom: 24, right: 24, zIndex: 500,
                    width: 36, height: 36, borderRadius: '50%',
                    background: C.surface, border: `1px solid ${C.border}`,
                    boxShadow: '0 2px 8px rgba(0,0,0,.12)',
                    cursor: 'pointer', fontSize: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }, children: "\uD83D\uDCCB" })] }));
}
