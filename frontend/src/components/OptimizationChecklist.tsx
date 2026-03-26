import { useEffect, useState } from 'react';
import client from '../api/client';

interface OptItem { id: string; name: string; current_price: number; optimized_price: number; savings: number; description: string; }

export default function OptimizationChecklist({ taskId, onClose, onOptimized }: { taskId: string; onClose: () => void; onOptimized: () => void; }) {
  const [items, setItems] = useState<OptItem[]>([]);
  const [totalSavings, setTotalSavings] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    client.post<{ items: OptItem[]; total_savings: number }>(`/projects/estimates/${taskId}/optimize/plan`)
      .then(({ data }) => { setItems(data.items); setTotalSavings(data.total_savings); setSelected(new Set(data.items.map((i) => i.id))); })
      .catch(() => setError('Ошибка получения плана'))
      .finally(() => setLoading(false));
  }, [taskId]);

  function toggle(id: string) {
    setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  async function execute() {
    setExecuting(true);
    try { await client.post(`/projects/estimates/${taskId}/optimize/execute`, { item_ids: Array.from(selected) }); onOptimized(); }
    catch { alert('Ошибка оптимизации'); }
    finally { setExecuting(false); }
  }

  const selectedSavings = items.filter((i) => selected.has(i.id)).reduce((s, i) => s + i.savings, 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 8, width: '90%', maxWidth: 620, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Оптимизация сметы</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {loading && <p style={{ color: '#aaa' }}>Анализ...</p>}
          {error && <p style={{ color: '#f44336' }}>{error}</p>}
          {!loading && !error && items.length === 0 && <p style={{ color: '#aaa' }}>Нет позиций для оптимизации</p>}
          <p style={{ margin: '0 0 12px', fontSize: 14 }}>Максимальная экономия: <strong>{fmt(totalSavings)} ₽</strong></p>
          {items.map((item) => (
            <div key={item.id} onClick={() => toggle(item.id)} style={{ display: 'flex', gap: 12, padding: '10px 12px', border: '1px solid #e0e0e0', borderRadius: 6, marginBottom: 8, cursor: 'pointer', background: selected.has(item.id) ? '#f0f7ff' : '#fafafa' }}>
              <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} onClick={(e) => e.stopPropagation()} style={{ marginTop: 3 }} />
              <div>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{item.name}</div>
                <div style={{ fontSize: 12, color: '#666' }}>{item.description}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{fmt(item.current_price)} → <span style={{ color: '#4caf50', fontWeight: 600 }}>{fmt(item.optimized_price)} ₽</span> (экономия: {fmt(item.savings)} ₽)</div>
              </div>
            </div>
          ))}
        </div>
        {!loading && !error && items.length > 0 && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13 }}>Выбрано: {selected.size} | Экономия: <strong style={{ color: '#4caf50' }}>{fmt(selectedSavings)} ₽</strong></span>
            <button onClick={execute} disabled={executing || selected.size === 0} style={{ padding: '8px 18px', background: executing ? '#bdbdbd' : '#4caf50', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
              {executing ? 'Выполняется...' : 'Оптимизировать'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function fmt(v: number) { return v.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
