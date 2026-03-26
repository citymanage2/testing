import { useEffect, useState } from 'react';
import client from '../api/client';

interface Analogue { id: string; name: string; price: number; unit: string; supplier: string; economy_pct: number; source_url: string | null; }

export default function AnaloguePanel({ taskId, itemId, isAnalogue, onClose, onApplied }: { taskId: string; itemId: string; isAnalogue: boolean; onClose: () => void; onApplied: () => void; }) {
  const [analogues, setAnalogues] = useState<Analogue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [applying, setApplying] = useState<string | null>(null);
  const [reverting, setReverting] = useState(false);
  const base = `/projects/estimates/${taskId}/items/${itemId}`;

  useEffect(() => {
    client.post<Analogue[]>(`${base}/find-analogues`)
      .then(({ data }) => setAnalogues(data))
      .catch(() => setError('Ошибка поиска аналогов'))
      .finally(() => setLoading(false));
  }, [taskId, itemId]);

  async function apply(id: string) {
    setApplying(id);
    try { await client.post(`${base}/apply-analogue`, { analogue_id: id }); onApplied(); }
    catch { alert('Ошибка применения'); }
    finally { setApplying(null); }
  }

  async function revert() {
    setReverting(true);
    try { await client.post(`${base}/revert-analogue`); onApplied(); }
    catch { alert('Ошибка отмены'); }
    finally { setReverting(false); }
  }

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, background: '#fff', boxShadow: '-4px 0 16px rgba(0,0,0,0.15)', zIndex: 1200, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Аналоги</h3>
        <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer' }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {isAnalogue && (
          <div style={{ padding: '10px 14px', background: '#fff3e0', border: '1px solid #ffcc02', borderRadius: 6, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, color: '#e65100' }}>Используется аналог</span>
            <button onClick={revert} disabled={reverting} style={{ padding: '5px 12px', background: '#ff9800', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>
              {reverting ? 'Отмена...' : 'Отменить'}
            </button>
          </div>
        )}
        {loading && <p style={{ color: '#aaa' }}>Поиск...</p>}
        {error && <p style={{ color: '#f44336' }}>{error}</p>}
        {!loading && !error && analogues.length === 0 && <p style={{ color: '#aaa' }}>Аналоги не найдены</p>}
        {analogues.map((a) => (
          <div key={a.id} style={{ border: '1px solid #e0e0e0', borderRadius: 6, padding: '12px 14px', marginBottom: 10 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{a.name}</div>
            <div style={{ fontSize: 13, color: '#555', marginBottom: 6 }}>
              {a.price.toLocaleString('ru-RU')} ₽ / {a.unit} — {a.supplier}
              <span style={{ marginLeft: 8, color: a.economy_pct > 0 ? '#4caf50' : '#f44336', fontWeight: 600 }}>{a.economy_pct.toFixed(1)}%</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {a.source_url && <a href={a.source_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#1565c0' }}>Источник ↗</a>}
              <button onClick={() => apply(a.id)} disabled={applying === a.id} style={{ marginLeft: 'auto', padding: '5px 14px', background: applying === a.id ? '#bdbdbd' : '#1565c0', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>
                {applying === a.id ? '...' : 'Применить'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
