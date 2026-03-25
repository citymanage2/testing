import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useAuthStore } from '../store/auth';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await client.post('/auth/login', { password });
      login(data.access_token, data.role);
      navigate(data.role === 'admin' ? '/admin' : '/task/create');
    } catch {
      setError('Неверный пароль');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f5f5f5' }}>
      <form
        onSubmit={handleSubmit}
        style={{
          width: 320,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          background: '#fff',
          padding: 32,
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        }}
      >
        <h2 style={{ margin: 0, marginBottom: 8, textAlign: 'center' }}>Smeta AI</h2>
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          style={{ padding: '8px 12px', fontSize: 16, borderRadius: 4, border: '1px solid #ccc' }}
        />
        {error && <p style={{ color: 'red', margin: 0 }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '10px 0',
            fontSize: 16,
            borderRadius: 4,
            border: 'none',
            background: '#1976d2',
            color: '#fff',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Вход...' : 'Войти'}
        </button>
      </form>
    </div>
  );
}
