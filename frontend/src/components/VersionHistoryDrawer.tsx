import { useEffect, useState } from 'react';
import client from '../api/client';

interface Version {
  id: string;
  version_number: number;
  created_at: string;
  change_type: string;
  change_description: string;
}

interface Props {
  taskId: string;
  onClose: () => void;
  onRestored: () => void;
}

export default function VersionHistoryDrawer({ taskId, onClose, onRestored }: Props) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    client
      .get<Version[]>(`/projects/estimates/${taskId}/versions`)
      .then(({ data }) => setVersions(data))
      .catch(() => setVersions([]))
      .finally(() => setLoading(false));
  }, [taskId]);

  async function handleRestore(vid: string, versionNumber: number) {
    if (!confirm(`Восстановить версию ${versionNumber}? Текущая версия будет сохранена в истории.`)) return;
    setRestoring(vid);
    try {
      await client.post(`/projects/estimates/${taskId}/versions/${vid}/restore`);
      onRestored();
      onClose();
    } catch {
      alert('Ошибка при восстановлении версии');
    } finally {
      setRestoring(null);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 420,
        background: '#fff',
        boxShadow: '-4px 0 12px rgba(0,0,0,0.15)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h3 style={{ margin: 0 }}>История версий</h3>
        <button
          onClick={onClose}
          style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: '#555' }}
        >
          ×
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading ? (
          <p style={{ color: '#aaa' }}>Загрузка...</p>
        ) : versions.length === 0 ? (
          <p style={{ color: '#aaa' }}>Нет версий</p>
        ) : (
          versions.map((v) => (
            <div
              key={v.id}
              style={{
                border: '1px solid #e0e0e0',
                borderRadius: 6,
                padding: 12,
                marginBottom: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <strong>Версия {v.version_number}</strong>
                <span style={{ fontSize: 12, color: '#888' }}>
                  {new Date(v.created_at).toLocaleString('ru-RU')}
                </span>
              </div>
              <p style={{ margin: '0 0 4px', fontSize: 13, color: '#666' }}>
                <strong>Тип:</strong> {v.change_type}
              </p>
              <p style={{ margin: '0 0 8px', fontSize: 13 }}>{v.change_description}</p>
              <button
                onClick={() => handleRestore(v.id, v.version_number)}
                disabled={restoring === v.id}
                style={{
                  padding: '4px 12px',
                  background: '#1976d2',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: restoring === v.id ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                }}
              >
                {restoring === v.id ? 'Восстановление...' : 'Восстановить'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
