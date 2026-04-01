import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAuthStore } from '../store/auth';
import ProjectsSidebar from './ProjectsSidebar';
import NotificationBell from './NotificationBell';
import { C } from '../ui';

const NAV_LINKS = [
  { path: '/catalog',           icon: '📋', label: 'Каталог расценок' },
  { path: '/contractors',       icon: '🏢', label: 'Контрагенты' },
  { path: '/calculator',        icon: '📐', label: 'Калькулятор' },
  { path: '/settings/company',  icon: '⚙️',  label: 'Реквизиты компании' },
];

export default function Layout() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const logout     = useAuthStore((s) => s.logout);
  const isAdmin    = useAuthStore.getState().role === 'admin';
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: C.surfaceAlt }}>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', padding: '0 20px', height: 52,
        background: C.headerBg, color: '#fff', flexShrink: 0, gap: 12,
        borderBottom: '1px solid rgba(255,255,255,.08)',
      }}>
        {/* Logo */}
        <div onClick={() => navigate('/task/create')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff' }}>С</div>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.3px' }}>СМ Смета</span>
        </div>

        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,.12)', margin: '0 4px' }} />

        {/* New task */}
        <button
          onClick={() => navigate('/task/create')}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: C.primary, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Новая задача
        </button>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Nav links — inline on wide screens, dropdown on narrow */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {NAV_LINKS.map(({ path, icon, label }) => (
            <button key={path} onClick={() => navigate(path)}
              style={{
                padding: '5px 10px', border: 'none', background: location.pathname === path ? 'rgba(255,255,255,.12)' : 'transparent',
                color: location.pathname === path ? '#fff' : 'rgba(255,255,255,.65)',
                borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 4,
              }}
              title={label}
            >
              {icon} <span style={{ display: 'none' }}>{label}</span>
            </button>
          ))}
        </nav>

        <NotificationBell />

        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,.12)', margin: '0 4px' }} />

        {/* User actions */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setMenuOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.18)', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 13 }}>
            <span>👤</span>
            <span style={{ fontSize: 12, opacity: .8 }}>▾</span>
          </button>
          {menuOpen && (
            <div onMouseLeave={() => setMenuOpen(false)}
              style={{ position: 'absolute', right: 0, top: 40, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: '0 8px 30px rgba(0,0,0,.12)', minWidth: 180, zIndex: 999, overflow: 'hidden' }}>
              <div style={{ padding: '8px 16px', fontSize: 12, color: C.textSec, borderBottom: `1px solid ${C.border}` }}>Аккаунт</div>
              {NAV_LINKS.map(({ path, icon, label }) => (
                <button key={path} onClick={() => { navigate(path); setMenuOpen(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 16px', border: 'none', background: location.pathname === path ? C.primaryBg : '#fff', color: location.pathname === path ? C.primary : C.text, cursor: 'pointer', fontSize: 13, textAlign: 'left' }}>
                  {icon} {label}
                </button>
              ))}
              {isAdmin && (
                <button onClick={() => { navigate('/admin'); setMenuOpen(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 16px', border: 'none', background: '#fff', color: C.text, cursor: 'pointer', fontSize: 13, borderTop: `1px solid ${C.border}` }}>
                  🛡 Администрирование
                </button>
              )}
              <button onClick={() => { logout(); navigate('/login'); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 16px', border: 'none', background: '#fff', color: C.danger, cursor: 'pointer', fontSize: 13, borderTop: `1px solid ${C.border}` }}>
                ↩ Выйти
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <aside style={{ width: 244, flexShrink: 0, borderRight: `1px solid ${C.border}`, overflowY: 'auto', background: C.sidebarBg }}>
          <ProjectsSidebar />
        </aside>
        <main style={{ flex: 1, overflowY: 'auto', background: C.surfaceAlt }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
