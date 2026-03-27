import { Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import ProjectsSidebar from './ProjectsSidebar';

export default function Layout() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: 52, background: '#1565c0', color: '#fff', flexShrink: 0 }}>
        <span style={{ fontSize: 18, fontWeight: 700 }}>СМ Смета</span>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button onClick={() => navigate('/task/create')} style={{ ...headerBtn, background: '#fff', color: '#1565c0', fontWeight: 700, border: '2px solid #fff' }}>+ Новая задача</button>
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
