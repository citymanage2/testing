import { useEffect, useState } from 'react';
import client from '../api/client';

interface OptimizationItem {
  id: string;
  name: string;
  current_price: number;
  optimized_price: number;
  savings: number;
  description: string;
}

interface PlanResponse {
  items: OptimizationItem[];
  total_savings: number;
}

interface Props {
  taskId: string;
  onClose: () => void;
  onOptimized: () => void;
}

export default function OptimizationChecklist({ taskId, onClose, onOptimized }: Props) {
  const [items, setItems] = useState<OptimizationItem[]>([]);
  const [totalSavings, setTotalSavings] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    client
      .post<PlanResponse>(`/projects/estimates/${taskId}/optimize/plan`)
      .then(({ data }) => {
        setItems(data.items);
        setTotalSavings(data.total_savings);
        setSelected(new Set(data.items.map((i) => i.id)));
      })
      .catch(() => setError('Ошибка получения плана оптимизации'))
      .finally(() => setLoading(false));
  }, [taskId]);

  function toggleItem(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleExecute() {
    if (selected.size === 0) {
      alert('Выберите хотя бы одну позицию');
      return;
    }
    setExecuting(true);
    try {
      await client.post(`/projects/estimates/${taskId}/optimize/execute`, {
        item_ids: Array.from(selected),
      });
      onOptimized();
    } catch {
      alert('Ошибка при выполнении оптимизации');
    } finally {
      setExecuting(false);
    }
  }

  const selectedSavings = items
    .filter((i) => selected.has(i.id))
    .reduce((sum, i) => sum + i.savings, 0);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 1500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          width: '90%',
          maxWidth: 640,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
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
          <h3 style={{ margin: 0 }}>Оптимизация сметы</h3>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: '#555' }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {loading && <p style={{ color: '#aaa' }}>Анализ сметы...</p>}
          {error && <p style={{ color: '#f44336' }}>{error}</p>}
          {!loading && !error && items.length === 0 && (
            <p style={{ color: '#aaa' }}>Нет позиций для оптимизации</p>
          )}
          {!loading && !error && items.length > 0 && (
            <>
              <p style={{ margin: '0 0 12px', fontSize: 14, color: '#555' }}>
                Максимальная экономия:{' '}
                <strong>{formatMoney(totalSavings)} ₽</strong>
              </p>
              {items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '10px 12px',
                    border: '1px solid #e0e0e0',
                    borderRadius: 6,
                    marginBottom: 8,
                    background: selected.has(item.id) ? '#f3f8ff' : '#fafafa',
                    cursor: 'pointer',
                  }}
                  onClick={() => toggleItem(item.id)}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    onChange={() => toggleItem(item.id)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ marginTop: 3, flexShrink: 0 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 2 }}>{item.name}</div>
                    <div style={{ fontSize: 12, color: '#555', marginBottom: 2 }}>{item.description}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>
                      {formatMoney(item.current_price)} ₽ →{' '}
                      <span style={{ color: '#4caf50', fontWeight: 600 }}>
                        {formatMoney(item.optimized_price)} ₽
                      </span>{' '}
                      (экономия: {formatMoney(item.savings)} ₽)
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && !error && items.length > 0 && (
          <div
            style={{
              padding: '14px 20px',
              borderTop: '1px solid #e0e0e0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <span style={{ fontSize: 14, color: '#555' }}>
              Выбрано позиций: {selected.size} | Экономия:{' '}
              <strong style={{ color: '#4caf50' }}>{formatMoney(selectedSavings)} ₽</strong>
            </span>
            <button
              onClick={handleExecute}
              disabled={executing || selected.size === 0}
              style={{
                padding: '9px 20px',
                background: executing || selected.size === 0 ? '#bdbdbd' : '#4caf50',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: executing || selected.size === 0 ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              {executing ? 'Выполняется...' : 'Запустить оптимизацию'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function formatMoney(value: number): string {
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
