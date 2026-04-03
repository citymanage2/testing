import { useEffect, useState } from 'react';
import client from '../api/client';
import { C, btnPrimary, btnOutline, OVERLAY, MODAL } from '../ui';

interface Item { id: string; name: string; type: string; }
interface Analogue { id: string; name: string; price: number; unit: string; supplier: string; economy_pct: number; source_url: string | null; }
interface ItemResult { item: Item; analogues: Analogue[]; loading: boolean; error: string; selected: string | null; }

interface Props {
  taskId: string;
  items: Item[];
  onClose: () => void;
  onApplied: () => void;
}

const fmt = (n: number) => n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BatchAnalogueModal({ taskId, items, onClose, onApplied }: Props) {
  const base = `/projects/estimates/${taskId}/items`;
  const [results, setResults] = useState<ItemResult[]>(
    items.map(item => ({ item, analogues: [], loading: true, error: '', selected: null }))
  );
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    items.forEach((item, idx) => {
      client.post<Analogue[]>(`${base}/${item.id}/find-analogues`)
        .then(({ data }) => {
          setResults(prev => prev.map((r, i) =>
            i === idx ? { ...r, loading: false, analogues: data, selected: data[0]?.id ?? null } : r
          ));
        })
        .catch(() => {
          setResults(prev => prev.map((r, i) =>
            i === idx ? { ...r, loading: false, error: 'Не найдено' } : r
          ));
        });
    });
  }, [taskId]);

  function toggleSelected(idx: number, analogueId: string) {
    setResults(prev => prev.map((r, i) =>
      i === idx ? { ...r, selected: r.selected === analogueId ? null : analogueId } : r
    ));
  }

  async function applyAll() {
    setApplying(true);
    let applied = 0;
    for (const r of results) {
      if (!r.selected) continue;
      try {
        await client.post(`${base}/${r.item.id}/apply-analogue`, { analogue_id: r.selected });
        applied++;
      } catch {}
    }
    setApplying(false);
    if (applied > 0) onApplied();
    else onClose();
  }

  const readyCount = results.filter(r => r.selected).length;

  return (
    <div style={OVERLAY}>
      <div style={{ ...MODAL, maxWidth: 680, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Подбор аналогов ({items.length} позиций)</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: C.textMuted }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {results.map((r, idx) => (
            <div key={r.item.id} style={{ border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 12, overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', background: C.surfaceAlt, borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{r.item.name}</span>
              </div>
              <div style={{ padding: '8px 12px' }}>
                {r.loading && <p style={{ margin: 0, fontSize: 13, color: C.textMuted }}>Поиск...</p>}
                {r.error && <p style={{ margin: 0, fontSize: 13, color: C.danger }}>{r.error}</p>}
                {!r.loading && !r.error && r.analogues.length === 0 && (
                  <p style={{ margin: 0, fontSize: 13, color: C.textMuted }}>Аналоги не найдены</p>
                )}
                {r.analogues.map(a => (
                  <div key={a.id} onClick={() => toggleSelected(idx, a.id)}
                    style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '7px 10px', borderRadius: 6, marginBottom: 6, cursor: 'pointer', border: `1px solid ${r.selected === a.id ? C.primary : C.border}`, background: r.selected === a.id ? C.primaryBg : C.surface }}>
                    <input type="radio" checked={r.selected === a.id} onChange={() => toggleSelected(idx, a.id)} style={{ marginTop: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{a.name}</div>
                      <div style={{ fontSize: 12, color: C.textSec, marginTop: 2 }}>
                        {fmt(a.price)} ₽/{a.unit} · {a.supplier}
                        {a.economy_pct > 0 && <span style={{ marginLeft: 8, color: C.success, fontWeight: 600 }}>−{a.economy_pct.toFixed(1)}%</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 12, borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
          <button onClick={applyAll} disabled={applying || readyCount === 0} style={{ ...btnPrimary(), opacity: readyCount === 0 ? 0.5 : 1 }}>
            {applying ? 'Применение...' : `Применить (${readyCount})`}
          </button>
          <button onClick={onClose} style={btnOutline()}>Отмена</button>
        </div>
      </div>
    </div>
  );
}
