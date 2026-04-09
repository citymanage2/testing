import { useCallback, useEffect, useState } from 'react';
import client from '../api/client';
import {
  C, CARD, INPUT, LBL, MODAL, OVERLAY, TD, TH,
  btnDanger, btnGhost, btnOutline, btnPrimary,
} from '../ui';

type PeriodType = 'week' | 'month';

interface ScheduleItem {
  id: string;
  name: string;
  unit: string;
  total_quantity: number;
}

interface Entry {
  period_label: string;
  period_type: PeriodType;
  planned_qty: number;
  actual_qty: number;
}

interface ItemWithEntries extends ScheduleItem {
  entries: Entry[];
}

function genMonthPeriods(start: string, end: string): string[] {
  // start/end: "YYYY-MM"
  const result: string[] = [];
  if (!start || !end) return result;
  let [sy, sm] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  while (sy < ey || (sy === ey && sm <= em)) {
    result.push(`${sy}-${String(sm).padStart(2, '0')}`);
    sm++;
    if (sm > 12) { sm = 1; sy++; }
    if (result.length > 120) break; // safety
  }
  return result;
}

function genWeekPeriods(start: string, end: string): string[] {
  // start/end: "YYYY-MM" — generate ISO weeks that fall within the month range
  const result: string[] = [];
  if (!start || !end) return result;
  const startDate = new Date(`${start}-01`);
  const [ey, em] = end.split('-').map(Number);
  const endDate = new Date(ey, em, 0); // last day of end month
  let d = new Date(startDate);
  // move to Monday of week containing startDate
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  while (d <= endDate) {
    const year = d.getFullYear();
    // ISO week number
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    result.push(`${year}-W${String(week).padStart(2, '0')}`);
    d.setDate(d.getDate() + 7);
    if (result.length > 200) break;
  }
  return result;
}

function periodLabel(p: string, type: PeriodType): string {
  if (type === 'week') return p; // already "YYYY-W01"
  const [y, m] = p.split('-');
  const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
  return `${months[parseInt(m) - 1]} ${y}`;
}

function cellColor(plan: number, fact: number): string {
  if (plan === 0 && fact === 0) return 'transparent';
  if (fact > plan) return C.successBg;
  if (plan > 0 && fact < plan) return C.warningBg;
  return 'transparent';
}

const defaultStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const defaultEnd = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 5);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function WorkSchedule({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<ItemWithEntries[]>([]);
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [startPeriod, setStartPeriod] = useState(defaultStart);
  const [endPeriod, setEndPeriod] = useState(defaultEnd);
  const [loading, setLoading] = useState(false);

  // local edits: {itemId: {periodLabel: {planned_qty, actual_qty}}}
  const [edits, setEdits] = useState<Record<string, Record<string, { planned_qty: number; actual_qty: number }>>>({});
  const [saving, setSaving] = useState<string | null>(null);

  // add/edit item modal
  const [itemModal, setItemModal] = useState<null | 'new' | ItemWithEntries>(null);
  const [itemForm, setItemForm] = useState({ name: '', unit: '', total_quantity: '' });
  const [savingItem, setSavingItem] = useState(false);

  const periods = periodType === 'month'
    ? genMonthPeriods(startPeriod, endPeriod)
    : genWeekPeriods(startPeriod, endPeriod);

  const load = useCallback(() => {
    setLoading(true);
    client.get(`/projects/${projectId}/schedule/items`)
      .then(r => setItems(r.data))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const getEntry = (item: ItemWithEntries, period: string): Entry => {
    const e = item.entries?.find(e => e.period_label === period);
    return e ?? { period_label: period, period_type: periodType, planned_qty: 0, actual_qty: 0 };
  };

  const getEdit = (itemId: string, period: string, base: Entry) => {
    return edits[itemId]?.[period] ?? { planned_qty: base.planned_qty, actual_qty: base.actual_qty };
  };

  const setEdit = (itemId: string, period: string, field: 'planned_qty' | 'actual_qty', val: string) => {
    setEdits(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [period]: {
          ...((prev[itemId]?.[period]) ?? { planned_qty: 0, actual_qty: 0 }),
          [field]: parseFloat(val) || 0,
        },
      },
    }));
  };

  const saveRow = async (item: ItemWithEntries) => {
    setSaving(item.id);
    const itemEdits = edits[item.id] ?? {};
    const entries: Entry[] = periods.map(p => {
      const base = getEntry(item, p);
      const edit = itemEdits[p];
      return {
        period_label: p,
        period_type: periodType,
        planned_qty: edit?.planned_qty ?? base.planned_qty,
        actual_qty: edit?.actual_qty ?? base.actual_qty,
      };
    });
    try {
      await client.put(`/projects/${projectId}/schedule/items/${item.id}/entries`, entries);
      load();
      setEdits(prev => { const n = { ...prev }; delete n[item.id]; return n; });
    } finally { setSaving(null); }
  };

  const loadFromEstimates = async () => {
    await client.post(`/projects/${projectId}/schedule/items/from-estimates`).catch(() => {});
    load();
  };

  const openNew = () => { setItemForm({ name: '', unit: '', total_quantity: '' }); setItemModal('new'); };
  const openEditItem = (item: ItemWithEntries) => {
    setItemForm({ name: item.name, unit: item.unit, total_quantity: String(item.total_quantity) });
    setItemModal(item);
  };

  const saveItem = async () => {
    setSavingItem(true);
    try {
      const payload = { name: itemForm.name, unit: itemForm.unit, total_quantity: parseFloat(itemForm.total_quantity) || 0 };
      if (itemModal === 'new') {
        await client.post(`/projects/${projectId}/schedule/items`, payload);
      } else if (itemModal) {
        await client.patch(`/projects/${projectId}/schedule/items/${(itemModal as ItemWithEntries).id}`, payload);
      }
      setItemModal(null);
      load();
    } finally { setSavingItem(false); }
  };

  const deleteItem = async (id: string) => {
    if (!confirm('Удалить строку?')) return;
    await client.delete(`/projects/${projectId}/schedule/items/${id}`);
    load();
  };

  // totals per period
  const planTotals = periods.map(p =>
    items.reduce((sum, item) => {
      const base = getEntry(item, p);
      return sum + (edits[item.id]?.[p]?.planned_qty ?? base.planned_qty);
    }, 0)
  );
  const factTotals = periods.map(p =>
    items.reduce((sum, item) => {
      const base = getEntry(item, p);
      return sum + (edits[item.id]?.[p]?.actual_qty ?? base.actual_qty);
    }, 0)
  );

  const leftColW = 220;
  const cellW = 70;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 2 }}>
          {(['month', 'week'] as PeriodType[]).map(pt => (
            <button
              key={pt}
              style={{
                ...btnOutline('sm'),
                background: periodType === pt ? C.primary : C.surface,
                color: periodType === pt ? '#fff' : C.text,
                border: `1px solid ${periodType === pt ? C.primary : C.border}`,
              }}
              onClick={() => setPeriodType(pt)}
            >
              {pt === 'month' ? 'Месяцы' : 'Недели'}
            </button>
          ))}
        </div>
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          С:
          <input style={{ ...INPUT, width: 130 }} type="month" value={startPeriod} onChange={e => setStartPeriod(e.target.value)} />
        </label>
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          По:
          <input style={{ ...INPUT, width: 130 }} type="month" value={endPeriod} onChange={e => setEndPeriod(e.target.value)} />
        </label>
        <button style={btnOutline('sm')} onClick={loadFromEstimates}>Из сметы</button>
        <button style={btnPrimary('sm')} onClick={openNew}>+ Добавить строку</button>
        <button style={btnGhost('sm')} onClick={async () => {
          const resp = await client.get(`/projects/${projectId}/schedule/export-excel`, { responseType: 'blob' });
          const url = URL.createObjectURL(resp.data);
          const a = document.createElement('a'); a.href = url; a.download = 'gpr.xlsx'; a.click();
          URL.revokeObjectURL(url);
        }}>⬇ Excel</button>
      </div>

      {/* Schedule table */}
      <div style={{ ...CARD, padding: 0, overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: C.textMuted }}>Загрузка...</div>
        ) : (
          <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ ...TH, width: leftColW, minWidth: leftColW, position: 'sticky', left: 0, zIndex: 2 }}>
                  Наименование / Ед. / Кол-во
                </th>
                {periods.map(p => (
                  <th key={p} style={{ ...TH, width: cellW, minWidth: cellW, textAlign: 'center' }}>
                    <div style={{ fontSize: 11 }}>{periodLabel(p, periodType)}</div>
                    <div style={{ fontSize: 10, color: C.textMuted, display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <span>П</span><span>Ф</span>
                    </div>
                  </th>
                ))}
                <th style={TH}></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td style={{ ...TD, position: 'sticky', left: 0, background: C.surface, zIndex: 1, width: leftColW, minWidth: leftColW }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>{item.unit} · {item.total_quantity}</div>
                  </td>
                  {periods.map(p => {
                    const base = getEntry(item, p);
                    const { planned_qty, actual_qty } = getEdit(item.id, p, base);
                    return (
                      <td key={p} style={{ ...TD, padding: 2, background: cellColor(planned_qty, actual_qty), width: cellW }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <input
                            type="number"
                            value={planned_qty || ''}
                            onChange={e => setEdit(item.id, p, 'planned_qty', e.target.value)}
                            style={{ width: '100%', fontSize: 11, padding: '2px 3px', border: `1px solid ${C.border}`, borderRadius: 3, textAlign: 'center', background: 'transparent', outline: 'none', boxSizing: 'border-box' }}
                            placeholder="П"
                          />
                          <input
                            type="number"
                            value={actual_qty || ''}
                            onChange={e => setEdit(item.id, p, 'actual_qty', e.target.value)}
                            style={{ width: '100%', fontSize: 11, padding: '2px 3px', border: `1px solid ${C.border}`, borderRadius: 3, textAlign: 'center', background: 'transparent', outline: 'none', boxSizing: 'border-box' }}
                            placeholder="Ф"
                          />
                        </div>
                      </td>
                    );
                  })}
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                    {edits[item.id] && (
                      <button style={btnPrimary('sm')} onClick={() => saveRow(item)} disabled={saving === item.id}>
                        {saving === item.id ? '...' : 'Сохранить'}
                      </button>
                    )}{' '}
                    <button style={btnGhost('sm')} onClick={() => openEditItem(item)}>✏️</button>
                    <button style={btnDanger('sm')} onClick={() => deleteItem(item.id)}>✕</button>
                  </td>
                </tr>
              ))}

              {/* Plan totals row */}
              <tr style={{ background: C.primaryBg }}>
                <td style={{ ...TD, position: 'sticky', left: 0, background: C.primaryBg, fontWeight: 600, fontSize: 12, zIndex: 1 }}>
                  Итого план
                </td>
                {planTotals.map((t, i) => (
                  <td key={i} style={{ ...TD, textAlign: 'center', fontWeight: 600, fontSize: 12 }}>
                    {t > 0 ? t.toFixed(1) : ''}
                  </td>
                ))}
                <td style={TD}></td>
              </tr>

              {/* Fact totals row */}
              <tr style={{ background: C.successBg }}>
                <td style={{ ...TD, position: 'sticky', left: 0, background: C.successBg, fontWeight: 600, fontSize: 12, zIndex: 1 }}>
                  Итого факт
                </td>
                {factTotals.map((t, i) => (
                  <td key={i} style={{ ...TD, textAlign: 'center', fontWeight: 600, fontSize: 12 }}>
                    {t > 0 ? t.toFixed(1) : ''}
                  </td>
                ))}
                <td style={TD}></td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit item modal */}
      {itemModal !== null && (
        <div style={OVERLAY} onClick={e => { if (e.target === e.currentTarget) setItemModal(null); }}>
          <div style={{ ...MODAL, maxWidth: 400 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>
              {itemModal === 'new' ? 'Новая строка' : 'Редактировать строку'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={LBL}>
                Наименование
                <input style={INPUT} value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={LBL}>
                  Единица
                  <input style={INPUT} value={itemForm.unit} onChange={e => setItemForm(f => ({ ...f, unit: e.target.value }))} />
                </label>
                <label style={LBL}>
                  Кол-во
                  <input style={INPUT} type="number" value={itemForm.total_quantity} onChange={e => setItemForm(f => ({ ...f, total_quantity: e.target.value }))} />
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={btnOutline()} onClick={() => setItemModal(null)}>Отмена</button>
              <button style={btnPrimary()} onClick={saveItem} disabled={savingItem}>
                {savingItem ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
