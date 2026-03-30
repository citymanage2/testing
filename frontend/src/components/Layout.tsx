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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: 52, background: '#1565c0', color: '#fff', flexShrink: 0 }}>
        <span style={{ fontSize: 18, fontWeight: 700 }}>СМ Смета</span>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button onClick={() => navigate('/task/create')} style={{ ...headerBtn, background: '#fff', color: '#1565c0', fontWeight: 700, border: '2px solid #fff' }}>+ Новая задача</button>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowToolsMenu(v => !v)} style={headerBtn}>Инструменты ▾</button>
            {showToolsMenu && (
              <div style={{ position: 'absolute', top: 36, right: 0, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 999, minWidth: 200 }}
                onMouseLeave={() => setShowToolsMenu(false)}>
                {toolLinks.map(({ path, label }) => (
                  <button key={path} onClick={() => { navigate(path); setShowToolsMenu(false); }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 16px', border: 'none', background: location.pathname === path ? '#e3f2fd' : '#fff', cursor: 'pointer', fontSize: 13, color: '#333' }}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {useAuthStore.getState().role === 'admin' && (
            <button onClick={() => navigate('/admin')} style={headerBtn}>Админ</button>
          )}
          <button onClick={() => { logout(); navigate('/login'); }} style={headerBtn}>Выйти</button>
        </div>
      </header>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <aside style={{ width: 240, flexShrink: 0, borderRight: '1px solid #e0e0e0', overflowY: 'auto', background: '#fafafa' }}>
          <ProjectsSidebar />
        </aside>
        <main style={{ flex: 1, overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const headerBtn: React.CSSProperties = {
  padding: '5px 12px', background: 'rgba(255,255,255,0.15)', color: '#fff',
  border: '1px solid rgba(255,255,255,0.4)', borderRadius: 4, cursor: 'pointer', fontSize: 13,
};
