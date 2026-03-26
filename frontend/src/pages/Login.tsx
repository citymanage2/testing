import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useAuthStore } from '../store/auth';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await client.post('/auth/login', { username, password });
      login(data.access_token, data.role);
      navigate(data.role === 'admin' ? '/admin' : '/task/create');
    } catch {
      setError('Неверный логин или пароль');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f4ff' }}>
      <div style={{ background: '#fff', padding: '40px 36px', borderRadius: 8, boxShadow: '0 2px 16px rgba(0,0,0,0.1)', width: 320 }}>
        <h2 style={{ margin: '0 0 24px', textAlign: 'center', color: '#1565c0' }}>СМ Смета</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Логин" required disabled={loading} style={inputStyle} />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Пароль" required disabled={loading} style={inputStyle} />
          {error && <p style={{ color: '#f44336', margin: 0, fontSize: 13 }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ padding: '10px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 4, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 600 }}>
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = { padding: '9px 12px', fontSize: 14, borderRadius: 4, border: '1px solid #ccc' };
