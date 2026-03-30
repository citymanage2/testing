import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAuthStore } from '../store/auth';
import ProjectsSidebar from './ProjectsSidebar';
export default function Layout() {
    const navigate = useNavigate();
    const location = useLocation();
    const logout = useAuthStore((s) => s.logout);
    const [showToolsMenu, setShowToolsMenu] = useState(false);
    const toolLinks = [
        { path: '/catalog', label: 'Каталог расценок' },
        { path: '/contractors', label: 'Контрагенты' },
        { path: '/calculator', label: 'Калькулятор' },
        { path: '/settings/company', label: 'Реквизиты компании' },
    ];
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }, children: [_jsxs("header", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: 52, background: '#1565c0', color: '#fff', flexShrink: 0 }, children: [_jsx("span", { style: { fontSize: 18, fontWeight: 700 }, children: "\u0421\u041C \u0421\u043C\u0435\u0442\u0430" }), _jsxs("div", { style: { display: 'flex', gap: 12, alignItems: 'center' }, children: [_jsx("button", { onClick: () => navigate('/task/create'), style: { ...headerBtn, background: '#fff', color: '#1565c0', fontWeight: 700, border: '2px solid #fff' }, children: "+ \u041D\u043E\u0432\u0430\u044F \u0437\u0430\u0434\u0430\u0447\u0430" }), _jsxs("div", { style: { position: 'relative' }, children: [_jsx("button", { onClick: () => setShowToolsMenu(v => !v), style: headerBtn, children: "\u0418\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B \u25BE" }), showToolsMenu && (_jsx("div", { style: { position: 'absolute', top: 36, right: 0, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 999, minWidth: 200 }, onMouseLeave: () => setShowToolsMenu(false), children: toolLinks.map(({ path, label }) => (_jsx("button", { onClick: () => { navigate(path); setShowToolsMenu(false); }, style: { display: 'block', width: '100%', textAlign: 'left', padding: '9px 16px', border: 'none', background: location.pathname === path ? '#e3f2fd' : '#fff', cursor: 'pointer', fontSize: 13, color: '#333' }, children: label }, path))) }))] }), useAuthStore.getState().role === 'admin' && (_jsx("button", { onClick: () => navigate('/admin'), style: headerBtn, children: "\u0410\u0434\u043C\u0438\u043D" })), _jsx("button", { onClick: () => { logout(); navigate('/login'); }, style: headerBtn, children: "\u0412\u044B\u0439\u0442\u0438" })] })] }), _jsxs("div", { style: { display: 'flex', flex: 1, overflow: 'hidden' }, children: [_jsx("aside", { style: { width: 240, flexShrink: 0, borderRight: '1px solid #e0e0e0', overflowY: 'auto', background: '#fafafa' }, children: _jsx(ProjectsSidebar, {}) }), _jsx("main", { style: { flex: 1, overflowY: 'auto' }, children: _jsx(Outlet, {}) })] })] }));
}
const headerBtn = {
    padding: '5px 12px', background: 'rgba(255,255,255,0.15)', color: '#fff',
    border: '1px solid rgba(255,255,255,0.4)', borderRadius: 4, cursor: 'pointer', fontSize: 13,
};
