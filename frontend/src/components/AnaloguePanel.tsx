import { useEffect, useState } from 'react';
import client from '../api/client';

interface Analogue {
  id: string;
  name: string;
  price: number;
  unit: string;
  supplier: string;
  economy_pct: number;
  source_url: string | null;
}

interface Props {
  taskId: string;
  itemId: string;
  isAnalogue: boolean;
  onClose: () => void;
  onApplied: () => void;
}

export default function AnaloguePanel({ taskId, itemId, isAnalogue, onClose, onApplied }: Props) {
  const [analogues, setAnalogues] = useState<Analogue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [applying, setApplying] = useState<string | null>(null);
  const [reverting, setReverting] = useState(false);

  const baseUrl = `/projects/estimates/${taskId}/items/${itemId}`;

  useEffect(() => {
    client
      .post<Analogue[]>(`${baseUrl}/find-analogues`)
      .then(({ data }) => setAnalogues(data))
      .catch(() => setError('Ошибка поиска аналогов'))
      .finally(() => setLoading(false));
  }, [taskId, itemId]);

  async function handleApply(analogueId: string) {
    setApplying(analogueId);
    try {
      await client.post(`${baseUrl}/apply-analogue`, { analogue_id: analogueId });
      onApplied();
    } catch {
      alert('Ошибка при применении аналога');
    } finally {
      setApplying(null);
    }
  }

  async function handleRevert() {
    setReverting(true);
    try {
      await client.post(`${baseUrl}/revert-analogue`);
      onApplied();
    } catch {
      alert('Ошибка при отмене аналога');
    } finally {
      setReverting(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 440,
        background: '#fff',
        boxShadow: '-4px 0 16px rgba(0,0,0,0.15)',
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h3 style={{ margin: 0 }}>Аналоги</h3>
        <button
          onClick={onClose}
          style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: '#555' }}
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* Revert button if already using an analogue */}
        {isAnalogue && (
          <div
            style={{
              padding: '10px 14px',
              background: '#fff3e0',
              border: '1px solid #ffcc02',
              borderRadius: 6,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: 14, color: '#e65100' }}>Используется аналог</span>
            <button
              onClick={handleRevert}
              disabled={reverting}
              style={{
                padding: '5px 12px',
                background: '#ff9800',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: reverting ? 'not-allowed' : 'pointer',
                fontSize: 13,
              }}
            >
              {reverting ? 'Отмена...' : 'Отменить'}
            </button>
          </div>
        )}

        {loading && <p style={{ color: '#aaa' }}>Поиск аналогов...</p>}
        {error && <p style={{ color: '#f44336' }}>{error}</p>}
        {!loading && !error && analogues.length === 0 && (
          <p style={{ color: '#aaa' }}>Аналоги не найдены</p>
        )}

        {!loading && !error && analogues.map((analogue) => (
          <div
            key={analogue.id}
            style={{
              border: '1px solid #e0e0e0',
              borderRadius: 6,
              padding: '12px 14px',
              marginBottom: 10,
              background: '#fafafa',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{analogue.name}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 13, color: '#555', marginBottom: 8 }}>
              <span>
                <strong>Цена:</strong> {analogue.price.toLocaleString('ru-RU')} ₽ / {analogue.unit}
              </span>
              <span>
                <strong>Поставщик:</strong> {analogue.supplier}
              </span>
              <span style={{ color: analogue.economy_pct > 0 ? '#4caf50' : '#f44336', fontWeight: 600 }}>
                Экономия: {analogue.economy_pct.toFixed(1)}%
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {analogue.source_url && (
                <a
                  href={analogue.source_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 12, color: '#1976d2' }}
                >
                  Источник ↗
                </a>
              )}
              <button
                onClick={() => handleApply(analogue.id)}
                disabled={applying === analogue.id}
                style={{
                  padding: '5px 14px',
                  background: applying === analogue.id ? '#bdbdbd' : '#1976d2',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: applying === analogue.id ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  marginLeft: 'auto',
                }}
              >
                {applying === analogue.id ? 'Применение...' : 'Применить'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
