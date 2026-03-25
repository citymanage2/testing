import { Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import ProjectsSidebar from './ProjectsSidebar';

export default function Layout() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          height: 56,
          background: '#1976d2',
          color: '#fff',
          flexShrink: 0,
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
        }}
      >
        <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: 0.5 }}>Smeta AI</span>
        <button
          onClick={handleLogout}
          style={{
            padding: '6px 14px',
            background: 'rgba(255,255,255,0.15)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          Выйти
        </button>
      </header>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <aside
          style={{
            width: 240,
            flexShrink: 0,
            borderRight: '1px solid #e0e0e0',
            overflowY: 'auto',
            background: '#fafafa',
          }}
        >
          <ProjectsSidebar />
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
