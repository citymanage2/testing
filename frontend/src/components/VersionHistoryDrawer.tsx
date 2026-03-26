import { useEffect, useState } from 'react';
import client from '../api/client';

interface Version { id: string; version_number: number; created_at: string; change_type: string; change_description: string; }

export default function VersionHistoryDrawer({ taskId, onClose, onRestored }: { taskId: string; onClose: () => void; onRestored: () => void; }) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    client.get<Version[]>(`/projects/estimates/${taskId}/versions`)
      .then(({ data }) => setVersions(data))
      .catch(() => setVersions([]))
      .finally(() => setLoading(false));
  }, [taskId]);

  async function restore(vid: string, num: number) {
    if (!confirm(`Восстановить версию ${num}?`)) return;
    setRestoring(vid);
    try { await client.post(`/projects/estimates/${taskId}/versions/${vid}/restore`); onRestored(); onClose(); }
    catch { alert('Ошибка восстановления'); }
    finally { setRestoring(null); }
  }

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 400, background: '#fff', boxShadow: '-4px 0 16px rgba(0,0,0,0.15)', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>История версий</h3>
        <button onClick={onClose} style={closeBtn}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading ? <p style={{ color: '#aaa' }}>Загрузка...</p>
          : versions.length === 0 ? <p style={{ color: '#aaa' }}>Нет версий</p>
          : versions.map((v) => (
            <div key={v.id} style={{ border: '1px solid #e0e0e0', borderRadius: 6, padding: 12, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <strong>Версия {v.version_number}</strong>
                <span style={{ fontSize: 12, color: '#888' }}>{new Date(v.created_at).toLocaleString('ru-RU')}</span>
              </div>
              <p style={{ margin: '0 0 6px', fontSize: 13, color: '#666' }}>{v.change_type} — {v.change_description}</p>
              <button onClick={() => restore(v.id, v.version_number)} disabled={restoring === v.id} style={{ padding: '4px 12px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>
                {restoring === v.id ? 'Восстановление...' : 'Восстановить'}
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}

const closeBtn: React.CSSProperties = { border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: '#555' };
