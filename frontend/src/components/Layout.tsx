import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAuthStore } from '../store/auth';
import ProjectsSidebar from './ProjectsSidebar';
import NotificationBell from './NotificationBell';
import { C } from '../ui';
import client from '../api/client';

const NAV_LINKS = [
  { path: '/catalog',          icon: '📋', label: 'Каталог расценок' },
  { path: '/contractors',      icon: '🏢', label: 'Контрагенты' },
  { path: '/calculator',       icon: '📐', label: 'Калькулятор' },
  { path: '/settings/company', icon: '⚙️',  label: 'Настройки' },
];

const PAGE_TITLES: Record<string, string> = {
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
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const [logMenuOpen, setLogMenuOpen] = useState(false);

  const SB_W = collapsed ? 64 : 240;

  // resolve current page title
  const pageTitle = (() => {
    for (const [path, title] of Object.entries(PAGE_TITLES)) {
      if (location.pathname === path) return title;
    }
    if (location.pathname.startsWith('/projects/')) return 'Проект';
    if (location.pathname.startsWith('/task/')) return 'Смета';
    return 'СМ Смета';
  })();

  const showToast = (msg: string) => {
    setCopyToast(msg);
    setTimeout(() => setCopyToast(null), 2500);
  };

  const fetchLogLines = async () => {
    const r = await client.get('/notifications?limit=200');
    const entries = r.data as {created_at: string; title: string; body?: string}[];
    return entries.map(n =>
      `[${new Date(n.created_at).toLocaleString('ru-RU')}] ${n.title}${n.body ? ': ' + n.body : ''}`
    );
  };

  const copyLogs = async () => {
    try {
      const lines = await fetchLogLines();
      const text = lines.length ? lines.join('\n') : '(нет записей)';
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast(`✓ Скопировано ${lines.length} записей`);
    } catch {
      showToast('✗ Ошибка копирования');
    }
    setLogMenuOpen(false);
  };

  const downloadLogs = async () => {
    try {
      const lines = await fetchLogLines();
      const text = lines.length ? lines.join('\n') : '(нет записей)';
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `logs_${new Date().toISOString().slice(0, 10)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`✓ Скачано ${lines.length} записей`);
    } catch {
      showToast('✗ Ошибка скачивания');
    }
    setLogMenuOpen(false);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: C.pageBg }}>
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside style={{
        width: SB_W, flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: C.sidebarBg, borderRight: `1px solid ${C.border}`,
        transition: 'width 200ms ease', overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{
          height: 56, display: 'flex', alignItems: 'center', gap: 10,
          padding: collapsed ? '0 18px' : '0 16px', flexShrink: 0,
          borderBottom: `1px solid ${C.border}`,
        }}>
          <div
            onClick={() => navigate('/task/create')}
            style={{ width: 28, height: 28, borderRadius: 6, background: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff', cursor: 'pointer', flexShrink: 0 }}
          >С</div>
          {!collapsed && (
            <span style={{ fontSize: 15, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', letterSpacing: '-.2px' }}>СМ Смета</span>
          )}
        </div>

        {/* + Новая задача */}
        <div style={{ padding: collapsed ? '10px 8px' : '10px 12px', flexShrink: 0 }}>
          <button
            onClick={() => navigate('/task/create')}
            data-tooltip="Создать новую задачу ИИ: смета из ТЗ, из проекта, распознавание скана и другие типы"
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
              gap: 6, padding: collapsed ? '7px' : '7px 12px',
              background: C.primary, color: '#fff', border: 'none', borderRadius: 8,
              cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>+</span>
            {!collapsed && 'Новая задача'}
          </button>
        </div>

        {/* Projects section */}
        {!collapsed && (
          <div style={{ padding: '4px 16px 4px', fontSize: 11, fontWeight: 600, color: C.textMuted, letterSpacing: '.06em', textTransform: 'uppercase', flexShrink: 0 }}>
            Проекты
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
          <ProjectsSidebar collapsed={collapsed} />
        </div>

        {/* Tools nav section */}
        <div style={{ flexShrink: 0, borderTop: `1px solid ${C.border}`, paddingTop: 6 }}>
          {!collapsed && (
            <div style={{ padding: '4px 16px 4px', fontSize: 11, fontWeight: 600, color: C.textMuted, letterSpacing: '.06em', textTransform: 'uppercase' }}>
              Инструменты
            </div>
          )}
          {NAV_LINKS.map(({ path, icon, label }) => {
            const active = location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                title={collapsed ? label : undefined}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  gap: 10, padding: collapsed ? '9px 0' : '9px 16px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  background: active ? C.primaryBg : 'transparent',
                  border: 'none', borderLeft: active ? `2px solid ${C.primary}` : '2px solid transparent',
                  cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 400,
                  color: active ? C.primary : C.textSec,
                  whiteSpace: 'nowrap', transition: 'background .15s, color .15s',
                }}
              >
                <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
                {!collapsed && label}
              </button>
            );
          })}
          {isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              title={collapsed ? 'Администрирование' : undefined}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                gap: 10, padding: collapsed ? '9px 0' : '9px 16px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                background: location.pathname === '/admin' ? C.primaryBg : 'transparent',
                border: 'none', borderLeft: location.pathname === '/admin' ? `2px solid ${C.primary}` : '2px solid transparent',
                cursor: 'pointer', fontSize: 13, fontWeight: location.pathname === '/admin' ? 600 : 400,
                color: location.pathname === '/admin' ? C.primary : C.textSec,
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>🛡</span>
              {!collapsed && 'Администрирование'}
            </button>
          )}
        </div>

        {/* Collapse toggle */}
        <div style={{ flexShrink: 0, borderTop: `1px solid ${C.border}`, padding: '6px 8px' }}>
          <button
            onClick={() => setCollapsed(v => !v)}
            data-tooltip={collapsed ? 'Развернуть боковое меню' : 'Свернуть боковое меню'}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
              gap: 8, padding: '7px 8px',
              background: 'transparent', border: 'none', borderRadius: 6,
              cursor: 'pointer', fontSize: 12, color: C.textMuted,
            }}
          >
            <span style={{ fontSize: 14 }}>{collapsed ? '›' : '‹'}</span>
            {!collapsed && 'Свернуть'}
          </button>
        </div>
      </aside>

      {/* ── Right column (top bar + content) ────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <header style={{
          height: 56, flexShrink: 0, display: 'flex', alignItems: 'center',
          padding: '0 20px', gap: 12,
          background: C.surface, borderBottom: `1px solid ${C.border}`,
        }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: C.text, flex: 1 }}>{pageTitle}</span>

          <button
            onClick={copyLogs}
            data-tooltip="Скопировать лог активности в буфер обмена"
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: C.surface, border: `1px solid ${C.border}`,
              cursor: 'pointer', fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >📋</button>

          <NotificationBell />

          <div style={{ width: 1, height: 24, background: C.border }} />

          {/* User menu */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setUserMenuOpen(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
                background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8,
                color: C.text, cursor: 'pointer', fontSize: 13,
              }}
            >
              <span>👤</span>
              <span style={{ fontSize: 11, color: C.textSec }}>▾</span>
            </button>
            {userMenuOpen && (
              <div
                onMouseLeave={() => setUserMenuOpen(false)}
                style={{
                  position: 'absolute', right: 0, top: 40,
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 10, boxShadow: '0 8px 30px rgba(0,0,0,.12)',
                  minWidth: 180, zIndex: 999, overflow: 'hidden',
                }}
              >
                <div style={{ padding: '8px 16px', fontSize: 12, color: C.textSec, borderBottom: `1px solid ${C.border}` }}>Аккаунт</div>
                <button
                  onClick={() => { logout(); navigate('/login'); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    padding: '9px 16px', border: 'none', background: C.surface,
                    color: C.danger, cursor: 'pointer', fontSize: 13,
                  }}
                >
                  ↩ Выйти
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Main content */}
        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', background: C.pageBg, padding: '12px 4px' }}>
          <Outlet />
        </main>
      </div>

      {/* Floating log buttons — bottom right */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 500, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        {logMenuOpen && (
          <>
            <button
              onClick={copyLogs}
              data-tooltip="Скопировать все логи активности в буфер обмена"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 14px', borderRadius: 8, border: 'none',
                background: '#1565c0', color: '#fff',
                cursor: 'pointer', fontSize: 13, fontWeight: 500,
                boxShadow: '0 2px 8px rgba(0,0,0,.2)',
                whiteSpace: 'nowrap',
              }}
            >
              📋 Скопировать логи
            </button>
            <button
              onClick={downloadLogs}
              data-tooltip="Скачать все логи активности в текстовый файл (.txt)"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 14px', borderRadius: 8, border: 'none',
                background: '#2e7d32', color: '#fff',
                cursor: 'pointer', fontSize: 13, fontWeight: 500,
                boxShadow: '0 2px 8px rgba(0,0,0,.2)',
                whiteSpace: 'nowrap',
              }}
            >
              ⬇ Скачать логи (.txt)
            </button>
          </>
        )}
        <button
          onClick={() => setLogMenuOpen(v => !v)}
          data-tooltip={logMenuOpen ? 'Закрыть меню логов' : 'Открыть меню логов активности'}
          style={{
            width: 44, height: 44, borderRadius: '50%', border: 'none',
            background: logMenuOpen ? '#555' : '#333', color: '#fff',
            cursor: 'pointer', fontSize: 18,
            boxShadow: '0 4px 14px rgba(0,0,0,.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background .15s',
          }}
        >
          {logMenuOpen ? '✕' : '📋'}
        </button>
      </div>

      {/* Toast notification */}
      {copyToast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 501,
          background: C.text, color: '#fff', borderRadius: 8,
          padding: '8px 14px', fontSize: 13, fontWeight: 500,
          boxShadow: '0 4px 12px rgba(0,0,0,.2)',
          pointerEvents: 'none',
        }}>
          {copyToast}
        </div>
      )}
    </div>
  );
}
