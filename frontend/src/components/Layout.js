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
    { path: '/settings/company', icon: '⚙️', label: 'Настройки' },
];
const PAGE_TITLES = {
    '/catalog': 'Каталог расценок',
    '/contractors': 'Контрагенты',
    '/calculator': 'Калькулятор',
    '/settings/company': 'Настройки компании',
    '/admin': 'Администрирование',
};
export default function Layout() {
    const navigate = useNavigate();
    const location = useLocation();
    const logout = useAuthStore((s) => s.logout);
    const isAdmin = useAuthStore.getState().role === 'admin';
    const [collapsed, setCollapsed] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [copyToast, setCopyToast] = useState(null);
    const SB_W = collapsed ? 64 : 240;
    // resolve current page title
    const pageTitle = (() => {
        for (const [path, title] of Object.entries(PAGE_TITLES)) {
            if (location.pathname === path)
                return title;
        }
        if (location.pathname.startsWith('/projects/'))
            return 'Проект';
        if (location.pathname.startsWith('/task/'))
            return 'Смета';
        return 'СМ Смета';
    })();
    const showToast = (msg) => {
        setCopyToast(msg);
        setTimeout(() => setCopyToast(null), 2500);
    };
    const copyLogs = async () => {
        try {
            const r = await client.get('/notifications?limit=50');
            const lines = r.data.map(n => `[${new Date(n.created_at).toLocaleString('ru-RU')}] ${n.title}${n.body ? ': ' + n.body : ''}`);
            const text = lines.length ? lines.join('\n') : '(нет записей)';
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast(`✓ Скопировано ${lines.length} записей`);
        }
        catch {
            showToast('✗ Ошибка копирования');
        }
    };
    return (_jsxs("div", { style: { display: 'flex', height: '100vh', overflow: 'hidden', background: C.pageBg }, children: [_jsxs("aside", { style: {
                    width: SB_W, flexShrink: 0, display: 'flex', flexDirection: 'column',
                    background: C.sidebarBg, borderRight: `1px solid ${C.border}`,
                    transition: 'width 200ms ease', overflow: 'hidden',
                }, children: [_jsxs("div", { style: {
                            height: 56, display: 'flex', alignItems: 'center', gap: 10,
                            padding: collapsed ? '0 18px' : '0 16px', flexShrink: 0,
                            borderBottom: `1px solid ${C.border}`,
                        }, children: [_jsx("div", { onClick: () => navigate('/task/create'), style: { width: 28, height: 28, borderRadius: 6, background: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff', cursor: 'pointer', flexShrink: 0 }, children: "\u0421" }), !collapsed && (_jsx("span", { style: { fontSize: 15, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', letterSpacing: '-.2px' }, children: "\u0421\u041C \u0421\u043C\u0435\u0442\u0430" }))] }), _jsx("div", { style: { padding: collapsed ? '10px 8px' : '10px 12px', flexShrink: 0 }, children: _jsxs("button", { onClick: () => navigate('/task/create'), title: "\u041D\u043E\u0432\u0430\u044F \u0437\u0430\u0434\u0430\u0447\u0430", style: {
                                width: '100%', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
                                gap: 6, padding: collapsed ? '7px' : '7px 12px',
                                background: C.primary, color: '#fff', border: 'none', borderRadius: 8,
                                cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
                            }, children: [_jsx("span", { style: { fontSize: 16, lineHeight: 1, flexShrink: 0 }, children: "+" }), !collapsed && 'Новая задача'] }) }), !collapsed && (_jsx("div", { style: { padding: '4px 16px 4px', fontSize: 11, fontWeight: 600, color: C.textMuted, letterSpacing: '.06em', textTransform: 'uppercase', flexShrink: 0 }, children: "\u041F\u0440\u043E\u0435\u043A\u0442\u044B" })), _jsx("div", { style: { flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }, children: _jsx(ProjectsSidebar, { collapsed: collapsed }) }), _jsxs("div", { style: { flexShrink: 0, borderTop: `1px solid ${C.border}`, paddingTop: 6 }, children: [!collapsed && (_jsx("div", { style: { padding: '4px 16px 4px', fontSize: 11, fontWeight: 600, color: C.textMuted, letterSpacing: '.06em', textTransform: 'uppercase' }, children: "\u0418\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B" })), NAV_LINKS.map(({ path, icon, label }) => {
                                const active = location.pathname === path;
                                return (_jsxs("button", { onClick: () => navigate(path), title: collapsed ? label : undefined, style: {
                                        width: '100%', display: 'flex', alignItems: 'center',
                                        gap: 10, padding: collapsed ? '9px 0' : '9px 16px',
                                        justifyContent: collapsed ? 'center' : 'flex-start',
                                        background: active ? C.primaryBg : 'transparent',
                                        border: 'none', borderLeft: active ? `2px solid ${C.primary}` : '2px solid transparent',
                                        cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 400,
                                        color: active ? C.primary : C.textSec,
                                        whiteSpace: 'nowrap', transition: 'background .15s, color .15s',
                                    }, children: [_jsx("span", { style: { fontSize: 16, flexShrink: 0 }, children: icon }), !collapsed && label] }, path));
                            }), isAdmin && (_jsxs("button", { onClick: () => navigate('/admin'), title: collapsed ? 'Администрирование' : undefined, style: {
                                    width: '100%', display: 'flex', alignItems: 'center',
                                    gap: 10, padding: collapsed ? '9px 0' : '9px 16px',
                                    justifyContent: collapsed ? 'center' : 'flex-start',
                                    background: location.pathname === '/admin' ? C.primaryBg : 'transparent',
                                    border: 'none', borderLeft: location.pathname === '/admin' ? `2px solid ${C.primary}` : '2px solid transparent',
                                    cursor: 'pointer', fontSize: 13, fontWeight: location.pathname === '/admin' ? 600 : 400,
                                    color: location.pathname === '/admin' ? C.primary : C.textSec,
                                    whiteSpace: 'nowrap',
                                }, children: [_jsx("span", { style: { fontSize: 16, flexShrink: 0 }, children: "\uD83D\uDEE1" }), !collapsed && 'Администрирование'] }))] }), _jsx("div", { style: { flexShrink: 0, borderTop: `1px solid ${C.border}`, padding: '6px 8px' }, children: _jsxs("button", { onClick: () => setCollapsed(v => !v), title: collapsed ? 'Развернуть меню' : 'Свернуть меню', style: {
                                width: '100%', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
                                gap: 8, padding: '7px 8px',
                                background: 'transparent', border: 'none', borderRadius: 6,
                                cursor: 'pointer', fontSize: 12, color: C.textMuted,
                            }, children: [_jsx("span", { style: { fontSize: 14 }, children: collapsed ? '›' : '‹' }), !collapsed && 'Свернуть'] }) })] }), _jsxs("div", { style: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }, children: [_jsxs("header", { style: {
                            height: 56, flexShrink: 0, display: 'flex', alignItems: 'center',
                            padding: '0 20px', gap: 12,
                            background: C.surface, borderBottom: `1px solid ${C.border}`,
                        }, children: [_jsx("span", { style: { fontSize: 16, fontWeight: 700, color: C.text, flex: 1 }, children: pageTitle }), _jsx("button", { onClick: copyLogs, title: "\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043B\u043E\u0433 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0441\u0442\u0438", style: {
                                    width: 32, height: 32, borderRadius: 8,
                                    background: C.surface, border: `1px solid ${C.border}`,
                                    cursor: 'pointer', fontSize: 14,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }, children: "\uD83D\uDCCB" }), _jsx(NotificationBell, {}), _jsx("div", { style: { width: 1, height: 24, background: C.border } }), _jsxs("div", { style: { position: 'relative' }, children: [_jsxs("button", { onClick: () => setUserMenuOpen(v => !v), style: {
                                            display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
                                            background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8,
                                            color: C.text, cursor: 'pointer', fontSize: 13,
                                        }, children: [_jsx("span", { children: "\uD83D\uDC64" }), _jsx("span", { style: { fontSize: 11, color: C.textSec }, children: "\u25BE" })] }), userMenuOpen && (_jsxs("div", { onMouseLeave: () => setUserMenuOpen(false), style: {
                                            position: 'absolute', right: 0, top: 40,
                                            background: C.surface, border: `1px solid ${C.border}`,
                                            borderRadius: 10, boxShadow: '0 8px 30px rgba(0,0,0,.12)',
                                            minWidth: 180, zIndex: 999, overflow: 'hidden',
                                        }, children: [_jsx("div", { style: { padding: '8px 16px', fontSize: 12, color: C.textSec, borderBottom: `1px solid ${C.border}` }, children: "\u0410\u043A\u043A\u0430\u0443\u043D\u0442" }), _jsx("button", { onClick: () => { logout(); navigate('/login'); }, style: {
                                                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                                                    padding: '9px 16px', border: 'none', background: C.surface,
                                                    color: C.danger, cursor: 'pointer', fontSize: 13,
                                                }, children: "\u21A9 \u0412\u044B\u0439\u0442\u0438" })] }))] })] }), _jsx("main", { style: { flex: 1, overflowY: 'auto', overflowX: 'hidden', background: C.pageBg, padding: '12px 4px' }, children: _jsx(Outlet, {}) })] }), copyToast && (_jsx("div", { style: {
                    position: 'fixed', bottom: 24, right: 24, zIndex: 501,
                    background: C.text, color: '#fff', borderRadius: 8,
                    padding: '8px 14px', fontSize: 13, fontWeight: 500,
                    boxShadow: '0 4px 12px rgba(0,0,0,.2)',
                    pointerEvents: 'none',
                }, children: copyToast }))] }));
}
