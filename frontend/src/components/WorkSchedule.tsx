import { useCallback, useEffect, useRef, useState } from 'react';
import client from '../api/client';
import {
  C, CARD, INPUT, LBL, MODAL, OVERLAY,
  btnDanger, btnGhost, btnOutline, btnPrimary,
} from '../ui';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScheduleItem {
  id: string;
  name: string;
  unit: string;
  total_quantity: number;
  sort_order: number;
  estimate_item_id?: string;
  plan_start?: string; // YYYY-MM-DD
  plan_end?: string;   // YYYY-MM-DD
}

interface Entry {
  period_label: string;
  period_type: string;
  planned_qty: number;
  actual_qty: number;
}

interface ItemWithEntries extends ScheduleItem {
  entries: Entry[];
}

type ZoomLevel = 'day' | 'week' | 'month';

// ─── Date helpers ──────────────────────────────────────────────────────────────

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

const MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

function defaultStart(): string {
  const d = new Date();
  d.setDate(1);
  return formatDate(d);
}

function defaultEnd(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  d.setDate(0);
  return formatDate(d);
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_PX: Record<ZoomLevel, number> = { day: 28, week: 14, month: 5 };
const LEFT_W = 290;
const ROW_H = 42;
const HDR_H = 44;
const GANTT_H = 520; // max height of the scrollable area

// ─── Component ────────────────────────────────────────────────────────────────

export default function WorkSchedule({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<ItemWithEntries[]>([]);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState<ZoomLevel>('week');
  const [viewStart, setViewStart] = useState(defaultStart);
  const [viewEnd, setViewEnd] = useState(defaultEnd);

  const rightRef = useRef<HTMLDivElement>(null);
  const leftBodyRef = useRef<HTMLDivElement>(null);

  // item modal
  const [itemModal, setItemModal] = useState<null | 'new' | ItemWithEntries>(null);
  const [itemForm, setItemForm] = useState({ name: '', unit: '', total_quantity: '', plan_start: '', plan_end: '' });
  const [savingItem, setSavingItem] = useState(false);

  // fact % dialog
  const [factDialog, setFactDialog] = useState<ItemWithEntries | null>(null);
  const [factPct, setFactPct] = useState('');
  const [savingFact, setSavingFact] = useState(false);

  const dpx = DAY_PX[zoom];

  const load = useCallback(() => {
    setLoading(true);
    client.get(`/projects/${projectId}/schedule/items`)
      .then(r => {
        const loaded = r.data as ItemWithEntries[];
        setItems(loaded);
        // auto-fit view range to item dates
        const starts = loaded.filter(i => i.plan_start).map(i => i.plan_start!).sort();
        const ends = loaded.filter(i => i.plan_end).map(i => i.plan_end!).sort();
        if (starts.length && ends.length) {
          const s = parseDate(starts[0]);
          s.setDate(1);
          const e = parseDate(ends[ends.length - 1]);
          e.setMonth(e.getMonth() + 1);
          e.setDate(0);
          setViewStart(formatDate(s));
          setViewEnd(formatDate(e));
        }
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  // sync vertical scroll: right → left
  const onRightScroll = () => {
    if (rightRef.current && leftBodyRef.current) {
      leftBodyRef.current.scrollTop = rightRef.current.scrollTop;
    }
  };

  // progress from entries
  const getProgress = (item: ItemWithEntries): number => {
    if (!item.total_quantity) return 0;
    const actioned = (item.entries ?? []).reduce((s, e) => s + (e.actual_qty || 0), 0);
    return Math.min(100, Math.round((actioned / item.total_quantity) * 100));
  };

  // geometry
  const vStart = parseDate(viewStart);
  const vEnd = parseDate(viewEnd);
  const totalDays = Math.max(daysBetween(vStart, vEnd), 1);
  const chartWidth = totalDays * dpx;

  // month header segments
  interface MonthSeg { label: string; left: number; width: number }
  const monthSegs: MonthSeg[] = [];
  {
    let cur = new Date(vStart.getFullYear(), vStart.getMonth(), 1);
    while (cur <= vEnd) {
      const segStart = cur < vStart ? vStart : new Date(cur);
      const nextMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      const segEnd = nextMonth > vEnd ? vEnd : new Date(nextMonth.getTime() - 86400000);
      if (segEnd >= vStart) {
        const left = Math.max(0, daysBetween(vStart, segStart)) * dpx;
        const width = (daysBetween(segStart, segEnd) + 1) * dpx;
        monthSegs.push({ label: `${MONTHS[cur.getMonth()]} ${cur.getFullYear()}`, left, width });
      }
      cur = nextMonth;
    }
  }

  const todayOffset = daysBetween(vStart, new Date()) * dpx;
  const todayVisible = todayOffset >= 0 && todayOffset <= chartWidth;

  interface BarGeo { left: number; width: number; progressWidth: number; pct: number; isDelayed: boolean }
  const barGeo = (item: ItemWithEntries): BarGeo | null => {
    if (!item.plan_start || !item.plan_end) return null;
    const s = parseDate(item.plan_start);
    const e = parseDate(item.plan_end);
    const left = daysBetween(vStart, s) * dpx;
    const width = Math.max((daysBetween(s, e) + 1) * dpx, dpx);
    const pct = getProgress(item);
    const progressWidth = Math.round(width * pct / 100);

    let isDelayed = false;
    const today = new Date();
    if (today > s && pct < 100) {
      const dur = daysBetween(s, e);
      const elapsed = Math.min(daysBetween(s, today), dur);
      const expectedPct = dur > 0 ? Math.round((elapsed / dur) * 100) : 0;
      isDelayed = pct < expectedPct - 5;
    }
    return { left, width, progressWidth, pct, isDelayed };
  };

  const scrollToToday = () => {
    if (rightRef.current) {
      rightRef.current.scrollLeft = Math.max(0, todayOffset - 200);
    }
  };

  // item CRUD
  const openNew = () => {
    setItemForm({
      name: '',
      unit: '',
      total_quantity: '',
      plan_start: formatDate(new Date()),
      plan_end: formatDate(addDays(new Date(), 30)),
    });
    setItemModal('new');
  };

  const openEdit = (item: ItemWithEntries) => {
    setItemForm({
      name: item.name,
      unit: item.unit || '',
      total_quantity: String(item.total_quantity || ''),
      plan_start: item.plan_start || '',
      plan_end: item.plan_end || '',
    });
    setItemModal(item);
  };

  const saveItem = async () => {
    setSavingItem(true);
    try {
      const payload = {
        name: itemForm.name,
        unit: itemForm.unit,
        total_quantity: parseFloat(itemForm.total_quantity) || 0,
        plan_start: itemForm.plan_start || null,
        plan_end: itemForm.plan_end || null,
      };
      if (itemModal === 'new') {
        await client.post(`/projects/${projectId}/schedule/items`, payload);
      } else {
        await client.patch(`/projects/${projectId}/schedule/items/${(itemModal as ItemWithEntries).id}`, payload);
      }
      setItemModal(null);
      load();
    } finally { setSavingItem(false); }
  };

  const deleteItem = async (id: string) => {
    if (!confirm('Удалить строку ГПР?')) return;
    await client.delete(`/projects/${projectId}/schedule/items/${id}`);
    load();
  };

  const loadFromEstimates = async () => {
    await client.post(`/projects/${projectId}/schedule/items/from-estimates`).catch(() => {});
    load();
  };

  // fact %
  const openFact = (item: ItemWithEntries) => {
    setFactDialog(item);
    setFactPct(String(getProgress(item)));
  };

  const saveFact = async () => {
    if (!factDialog) return;
    setSavingFact(true);
    try {
      const pct = Math.min(100, Math.max(0, parseFloat(factPct) || 0));
      const qty = (pct / 100) * factDialog.total_quantity;
      const now = new Date();
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const otherEntries = (factDialog.entries ?? []).filter(e => e.period_type !== 'month');
      const totalOtherActual = otherEntries.reduce((s, e) => s + (e.actual_qty || 0), 0);
      const newActual = Math.max(0, qty - totalOtherActual);
      const existingPlanned = factDialog.entries?.find(e => e.period_label === period && e.period_type === 'month')?.planned_qty ?? 0;
      const newEntries = [
        ...otherEntries,
        { period_label: period, period_type: 'month', planned_qty: existingPlanned, actual_qty: newActual },
      ];
      await client.put(`/projects/${projectId}/schedule/items/${factDialog.id}/entries`, newEntries);
      load();
    } catch { alert('Ошибка сохранения'); }
    setSavingFact(false);
    setFactDialog(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {/* Zoom */}
        <div style={{ display: 'flex', gap: 2 }}>
          {(['day', 'week', 'month'] as ZoomLevel[]).map(z => (
            <button key={z}
              style={{ ...btnOutline('sm'), background: zoom === z ? C.primary : C.surface, color: zoom === z ? '#fff' : C.text, border: `1px solid ${zoom === z ? C.primary : C.border}` }}
              onClick={() => setZoom(z)}>
              {z === 'day' ? 'Дни' : z === 'week' ? 'Недели' : 'Месяцы'}
            </button>
          ))}
        </div>
        <button style={btnOutline('sm')} onClick={scrollToToday}>Сегодня</button>
        {/* Date range */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 12 }}>
          <span style={{ color: C.textSec }}>С</span>
          <input type="date" value={viewStart} onChange={e => setViewStart(e.target.value)}
            style={{ ...INPUT, width: 136, padding: '3px 8px', fontSize: 12 }} />
          <span style={{ color: C.textSec }}>по</span>
          <input type="date" value={viewEnd} onChange={e => setViewEnd(e.target.value)}
            style={{ ...INPUT, width: 136, padding: '3px 8px', fontSize: 12 }} />
        </div>
        <div style={{ flex: 1 }} />
        <button style={btnOutline('sm')} onClick={loadFromEstimates}>Из сметы</button>
        <button style={btnPrimary('sm')} onClick={openNew}>+ Строка</button>
        <button style={btnGhost('sm')} onClick={async () => {
          const resp = await client.get(`/projects/${projectId}/schedule/export-excel`, { responseType: 'blob' });
          const url = URL.createObjectURL(resp.data);
          const a = document.createElement('a'); a.href = url; a.download = 'gpr.xlsx'; a.click();
          URL.revokeObjectURL(url);
        }}>⬇ Excel</button>
      </div>

      {/* ── Legend ── */}
      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: C.textSec, alignItems: 'center', flexWrap: 'wrap' }}>
        {[
          { color: '#BFDBFE', border: '#93C5FD', label: 'План' },
          { color: C.success, border: C.success, label: 'Факт' },
          { color: C.warning, border: C.warning, label: 'Отставание' },
        ].map(({ color, border, label }) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 22, height: 8, background: color, border: `1px solid ${border}`, borderRadius: 2, display: 'inline-block' }} />
            {label}
          </span>
        ))}
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 2, height: 14, background: C.danger, display: 'inline-block' }} />
          Сегодня
        </span>
      </div>

      {/* ── Gantt ── */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: C.textMuted }}>Загрузка...</div>
      ) : (
        <div style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', height: items.length > 0 ? Math.min(HDR_H + items.length * ROW_H + 2, GANTT_H) : HDR_H + 80 }}>

            {/* ── Left panel (fixed) ── */}
            <div style={{ width: LEFT_W, minWidth: LEFT_W, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${C.border}` }}>
              {/* Header */}
              <div style={{ height: HDR_H, flexShrink: 0, background: C.surfaceAlt, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 12, fontWeight: 600, color: C.textSec }}>
                Наименование работ
              </div>
              {/* Rows (scroll synced with right) */}
              <div ref={leftBodyRef} style={{ flex: 1, overflowY: 'hidden' }}>
                {items.map((item, idx) => {
                  const pct = getProgress(item);
                  return (
                    <div key={item.id} style={{ height: ROW_H, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', padding: '0 8px', gap: 6, background: idx % 2 === 0 ? C.surface : C.surfaceAlt, boxSizing: 'border-box' }}>
                      <span style={{ fontSize: 11, color: C.textMuted, width: 20, textAlign: 'right', flexShrink: 0 }}>{idx + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.name}>
                          {item.name}
                        </div>
                        {/* Mini progress bar */}
                        <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ flex: 1, height: 4, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, transition: 'width .3s', background: pct >= 100 ? C.success : pct > 0 ? C.primary : C.border }} />
                          </div>
                          <span style={{ fontSize: 10, color: C.textSec, flexShrink: 0, minWidth: 26, textAlign: 'right' }}>{pct}%</span>
                        </div>
                      </div>
                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                        <button
                          style={{ ...btnGhost('sm'), padding: '2px 6px', fontSize: 11, color: C.primary }}
                          title="Отметить факт выполнения"
                          onClick={() => openFact(item)}>
                          %
                        </button>
                        <button
                          style={{ ...btnGhost('sm'), padding: '2px 6px', fontSize: 11 }}
                          title="Редактировать"
                          onClick={() => openEdit(item)}>
                          ✏
                        </button>
                        <button
                          style={{ ...btnDanger('sm'), padding: '2px 6px', fontSize: 11 }}
                          title="Удалить"
                          onClick={() => deleteItem(item.id)}>
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <div style={{ padding: '24px 16px', color: C.textMuted, fontSize: 12, textAlign: 'center' }}>
                    Нет строк. Добавьте вручную или загрузите из сметы.
                  </div>
                )}
              </div>
            </div>

            {/* ── Right Gantt panel (scrollable) ── */}
            <div
              ref={rightRef}
              onScroll={onRightScroll}
              style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
              <div style={{ width: Math.max(chartWidth, 200), minWidth: '100%', position: 'relative' }}>

                {/* Month header */}
                <div style={{ height: HDR_H, position: 'sticky', top: 0, background: C.surfaceAlt, borderBottom: `1px solid ${C.border}`, zIndex: 3 }}>
                  <div style={{ position: 'relative', height: '100%' }}>
                    {monthSegs.map((seg, i) => (
                      <div key={i} style={{ position: 'absolute', left: seg.left, width: seg.width, height: '100%', borderRight: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: C.textSec, overflow: 'hidden', padding: '0 4px', boxSizing: 'border-box' }}>
                        {seg.width > 28 ? seg.label : ''}
                      </div>
                    ))}
                    {/* Today marker in header */}
                    {todayVisible && (
                      <div style={{ position: 'absolute', left: todayOffset, top: 0, bottom: 0, width: 2, background: C.danger, zIndex: 4 }}>
                        <div style={{ position: 'absolute', top: 4, left: 3, fontSize: 9, fontWeight: 700, color: C.danger, whiteSpace: 'nowrap' }}>
                          сег.
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Item rows */}
                {items.map((item, idx) => {
                  const geo = barGeo(item);
                  return (
                    <div key={item.id} style={{ height: ROW_H, borderBottom: `1px solid ${C.border}`, position: 'relative', background: idx % 2 === 0 ? C.surface : C.surfaceAlt, boxSizing: 'border-box' }}>
                      {/* Month grid dividers */}
                      {monthSegs.map((seg, si) => (
                        <div key={si} style={{ position: 'absolute', left: seg.left + seg.width - 1, top: 0, bottom: 0, width: 1, background: C.border, opacity: 0.35, pointerEvents: 'none' }} />
                      ))}

                      {/* Gantt bar */}
                      {geo && (
                        <div
                          title={`${item.plan_start} — ${item.plan_end} · ${geo.pct}%`}
                          style={{ position: 'absolute', top: 11, height: 20, left: geo.left, width: geo.width, background: geo.isDelayed ? '#FDE68A' : '#DBEAFE', border: `1px solid ${geo.isDelayed ? C.warning : '#93C5FD'}`, borderRadius: 4, overflow: 'hidden', cursor: 'pointer', boxSizing: 'border-box' }}
                          onClick={() => openEdit(item)}>
                          {/* Progress fill */}
                          {geo.pct > 0 && (
                            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: geo.progressWidth, background: geo.isDelayed ? C.warning : C.success, opacity: 0.75, pointerEvents: 'none' }} />
                          )}
                          {/* Label */}
                          {geo.width > 36 && (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#1e3a5f', zIndex: 1, pointerEvents: 'none' }}>
                              {geo.pct}%
                            </div>
                          )}
                        </div>
                      )}

                      {/* Today line */}
                      {todayVisible && (
                        <div style={{ position: 'absolute', left: todayOffset, top: 0, bottom: 0, width: 2, background: `${C.danger}99`, zIndex: 2, pointerEvents: 'none' }} />
                      )}

                      {/* No dates placeholder */}
                      {!item.plan_start && (
                        <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontSize: 11, color: C.textMuted, fontStyle: 'italic' }}>
                          нет дат — нажмите ✏
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── Item modal ── */}
      {itemModal !== null && (
        <div style={OVERLAY} onClick={e => { if (e.target === e.currentTarget) setItemModal(null); }}>
          <div style={{ ...MODAL, maxWidth: 460 }}>
            <h3 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 600 }}>
              {itemModal === 'new' ? 'Новая строка ГПР' : 'Редактировать строку'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={LBL}>
                Наименование
                <input style={INPUT} value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} autoFocus />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={LBL}>
                  Единица измерения
                  <input style={INPUT} value={itemForm.unit} onChange={e => setItemForm(f => ({ ...f, unit: e.target.value }))} />
                </label>
                <label style={LBL}>
                  Общий объём
                  <input style={INPUT} type="number" min="0" step="any" value={itemForm.total_quantity} onChange={e => setItemForm(f => ({ ...f, total_quantity: e.target.value }))} />
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={LBL}>
                  Дата начала (план)
                  <input style={INPUT} type="date" value={itemForm.plan_start} onChange={e => setItemForm(f => ({ ...f, plan_start: e.target.value }))} />
                </label>
                <label style={LBL}>
                  Дата окончания (план)
                  <input style={INPUT} type="date" value={itemForm.plan_end} onChange={e => setItemForm(f => ({ ...f, plan_end: e.target.value }))} />
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 22, justifyContent: 'flex-end' }}>
              <button style={btnOutline()} onClick={() => setItemModal(null)}>Отмена</button>
              <button style={btnPrimary()} onClick={saveItem} disabled={savingItem || !itemForm.name}>
                {savingItem ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Fact % dialog ── */}
      {factDialog && (
        <div style={OVERLAY} onClick={e => { if (e.target === e.currentTarget) setFactDialog(null); }}>
          <div style={{ ...MODAL, maxWidth: 360 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 600 }}>Факт выполнения</h3>
            <div style={{ fontSize: 13, color: C.textSec, marginBottom: 16 }}>
              <div style={{ fontWeight: 500, color: C.text }}>{factDialog.name}</div>
              <div style={{ marginTop: 4 }}>
                Объём: {factDialog.total_quantity} {factDialog.unit} · Текущий прогресс: {getProgress(factDialog)}%
              </div>
              {factDialog.plan_start && factDialog.plan_end && (
                <div style={{ marginTop: 2, fontSize: 12 }}>
                  По плану: {factDialog.plan_start} — {factDialog.plan_end}
                </div>
              )}
            </div>
            <label style={LBL}>
              Выполнено, % (0–100)
              <input
                autoFocus
                type="number"
                min="0"
                max="100"
                step="1"
                value={factPct}
                onChange={e => setFactPct(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveFact(); if (e.key === 'Escape') setFactDialog(null); }}
                style={{ ...INPUT, marginTop: 4 }}
              />
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
              <button style={btnOutline()} onClick={() => setFactDialog(null)}>Отмена</button>
              <button style={btnPrimary()} onClick={saveFact} disabled={savingFact}>
                {savingFact ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
