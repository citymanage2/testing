import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import ProjectsSidebar from './ProjectsSidebar';
export default function Layout() {
    const navigate = useNavigate();
    const logout = useAuthStore((s) => s.logout);
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }, children: [_jsxs("header", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: 52, background: '#1565c0', color: '#fff', flexShrink: 0 }, children: [_jsx("span", { style: { fontSize: 18, fontWeight: 700 }, children: "\u0421\u041C \u0421\u043C\u0435\u0442\u0430" }), _jsxs("div", { style: { display: 'flex', gap: 12, alignItems: 'center' }, children: [_jsx("button", { onClick: () => navigate('/task/create'), style: { ...headerBtn, background: '#fff', color: '#1565c0', fontWeight: 700, border: '2px solid #fff' }, children: "+ \u041D\u043E\u0432\u0430\u044F \u0437\u0430\u0434\u0430\u0447\u0430" }), useAuthStore.getState().role === 'admin' && (_jsx("button", { onClick: () => navigate('/admin'), style: headerBtn, children: "\u0410\u0434\u043C\u0438\u043D" })), _jsx("button", { onClick: () => { logout(); navigate('/login'); }, style: headerBtn, children: "\u0412\u044B\u0439\u0442\u0438" })] })] }), _jsxs("div", { style: { display: 'flex', flex: 1, overflow: 'hidden' }, children: [_jsx("aside", { style: { width: 240, flexShrink: 0, borderRight: '1px solid #e0e0e0', overflowY: 'auto', background: '#fafafa' }, children: _jsx(ProjectsSidebar, {}) }), _jsx("main", { style: { flex: 1, overflowY: 'auto' }, children: _jsx(Outlet, {}) })] })] }));
}
const headerBtn = {
    padding: '5px 12px', background: 'rgba(255,255,255,0.15)', color: '#fff',
    border: '1px solid rgba(255,255,255,0.4)', borderRadius: 4, cursor: 'pointer', fontSize: 13,
};
