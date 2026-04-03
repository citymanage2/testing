import { useEffect, useState, useMemo } from 'react';
import client from '../api/client';
import { C, btnPrimary, btnOutline, btnDanger, INPUT, LBL, CARD, TH, TD, OVERLAY, MODAL } from '../ui';

interface KpRequest {
  id: string;
  project_id: string;
  estimate_item_id?: string;
  supplier_id?: string;
  supplier_name?: string;
  item_name: string;
  unit?: string;
  quantity: number;
  unit_price: number;
  total: number;
  notes?: string;
  status: 'pending' | 'received' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
}

interface EstimateItemForKp {
  id: string;
  task_id: string;
  task_name: string;
  section: string;
  name: string;
  unit: string;
  quantity: number;
  row_type: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидается',
  received: 'Получено',
  accepted: 'Принято',
  rejected: 'Отклонено',
};

function fmt(n: number) {
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const emptyForm = () => ({
  item_name: '',
  unit: '',
  quantity: '',
  unit_price: '0',
  supplier_id: '',
  notes: '',
  estimate_item_id: '',
  max_qty: Infinity as number,
  mode: 'estimate' as 'estimate' | 'custom',
});

export default function KpRequests({ projectId }: { projectId: string }) {
  const [requests, setRequests] = useState<KpRequest[]>([]);
  const [estimateItems, setEstimateItems] = useState<EstimateItemForKp[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<null | 'new' | KpRequest>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [reqR, eiR] = await Promise.all([
        client.get(`/projects/${projectId}/kp-requests`),
        client.get(`/projects/${projectId}/kp-estimate-items`),
      ]);
      setRequests(reqR.data);
      setEstimateItems(eiR.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [projectId]);

  const estimateReqs = useMemo(() => requests.filter(r => r.estimate_item_id), [requests]);
  const extraReqs = useMemo(() => requests.filter(r => !r.estimate_item_id), [requests]);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? estimateItems.filter(i => i.name.toLowerCase().includes(q) || i.section.toLowerCase().includes(q))
      : estimateItems;
    const map = new Map<string, EstimateItemForKp[]>();
    for (const item of filtered) {
      const key = [item.task_name, item.section].filter(Boolean).join(' — ') || 'Без раздела';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [estimateItems, search]);

  const openNew = () => { setForm(emptyForm()); setSearch(''); setModal('new'); };

  const openEdit = (req: KpRequest) => {
    setForm({
      item_name: req.item_name,
      unit: req.unit || '',
      quantity: String(req.quantity),
      unit_price: String(req.unit_price),
      supplier_id: req.supplier_id || '',
      notes: req.notes || '',
      estimate_item_id: req.estimate_item_id || '',
      max_qty: Infinity,
      mode: req.estimate_item_id ? 'estimate' : 'custom',
    });
    setModal(req);
  };

  const selectEstimateItem = (item: EstimateItemForKp) => {
    setForm(f => ({ ...f, item_name: item.name, unit: item.unit, quantity: String(item.quantity), estimate_item_id: item.id, max_qty: item.quantity }));
    setSearch('');
  };

  const computedTotal = () => (parseFloat(form.quantity) || 0) * (parseFloat(form.unit_price) || 0);

  const save = async () => {
    setSaving(true);
    try {
      const qty = Math.min(parseFloat(form.quantity) || 0, form.max_qty === Infinity ? Infinity : form.max_qty);
      const payload = {
        item_name: form.item_name,
        unit: form.unit || undefined,
        quantity: qty,
        unit_price: parseFloat(form.unit_price) || 0,
        supplier_id: form.supplier_id || undefined,
        notes: form.notes || undefined,
        estimate_item_id: form.estimate_item_id || undefined,
      };
      if (modal === 'new') {
        await client.post(`/projects/${projectId}/kp-requests`, payload);
      } else if (modal) {
        await client.patch(`/projects/${projectId}/kp-requests/${(modal as KpRequest).id}`, payload);
      }
      setModal(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const deleteRequest = async (id: string) => {
    if (!confirm('Удалить?')) return;
    await client.delete(`/projects/${projectId}/kp-requests/${id}`);
    load();
  };

  const changeStatus = async (id: string, s: string) => {
    await client.patch(`/projects/${projectId}/kp-requests/${id}`, { status: s });
    load();
  };

  const fld = (field: keyof ReturnType<typeof emptyForm>, val: string | number) =>
    setForm(f => ({ ...f, [field]: val }));

  const renderTable = (rows: KpRequest[], title: string, extra?: boolean) => (
    <div style={{ borderRadius: 8, border: `1px solid ${extra ? C.dangerBorder : C.border}`, overflow: 'hidden', marginBottom: 10 }}>
      <div style={{ padding: '8px 14px', background: extra ? C.dangerBg : C.primaryBg, borderBottom: `1px solid ${extra ? C.dangerBorder : C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: extra ? C.danger : C.primary }}>{title}</span>
        <span style={{ fontSize: 12, color: C.textSec }}>Итого: {fmt(rows.reduce((s, r) => s + r.total, 0))} ₽</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={TH}>Позиция</th>
            <th style={TH}>Ед.</th>
            <th style={TH}>Кол-во</th>
            <th style={TH}>Цена</th>
            <th style={TH}>Сумма</th>
            <th style={TH}>Статус</th>
            <th style={TH}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(req => (
            <tr key={req.id}>
              <td style={TD}>
                <div style={{ fontWeight: 500 }}>{req.item_name}</div>
                {req.notes && <div style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>{req.notes}</div>}
              </td>
              <td style={TD}>{req.unit || '—'}</td>
              <td style={TD}>{req.quantity}</td>
              <td style={TD}>{fmt(req.unit_price)} ₽</td>
              <td style={{ ...TD, fontWeight: 600 }}>{fmt(req.total)} ₽</td>
              <td style={TD}>
                <select value={req.status} onChange={e => changeStatus(req.id, e.target.value)}
                  style={{ ...INPUT, fontSize: 12, padding: '2px 6px', width: 'auto' }}>
                  {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </td>
              <td style={TD}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button style={btnOutline('sm')} onClick={() => openEdit(req)}>✎</button>
                  <button style={btnDanger('sm')} onClick={() => deleteRequest(req.id)}>✕</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button style={btnPrimary('sm')} onClick={openNew}>+ Добавить материал</button>
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: C.textMuted }}>Загрузка...</div>
      ) : requests.length === 0 ? (
        <div style={{ ...CARD, padding: 40, textAlign: 'center', color: C.textMuted }}>Нет заявок на материалы</div>
      ) : (
        <>
          {estimateReqs.length > 0 && renderTable(estimateReqs, 'Материалы по смете')}
          {extraReqs.length > 0 && renderTable(extraReqs, 'Дополнительные затраты', true)}
        </>
      )}

      {modal !== null && (
        <div style={OVERLAY} onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div style={{ ...MODAL, maxWidth: 540, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 600 }}>
              {modal === 'new' ? 'Добавить материал' : 'Редактировать'}
            </h3>

            {/* Mode toggle (only for new) */}
            {modal === 'new' && (
              <div style={{ display: 'flex', gap: 0, marginBottom: 14, borderRadius: 6, overflow: 'hidden', border: `1px solid ${C.border}` }}>
                {(['estimate', 'custom'] as const).map(m => (
                  <button key={m} onClick={() => { setForm(f => ({ ...f, mode: m, item_name: '', unit: '', quantity: '', estimate_item_id: '', max_qty: Infinity })); setSearch(''); }}
                    style={{ flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: form.mode === m ? C.primary : C.surfaceAlt, color: form.mode === m ? '#fff' : C.textSec }}>
                    {m === 'estimate' ? 'Из сметы' : 'Произвольно (доп. затраты)'}
                  </button>
                ))}
              </div>
            )}

            <div style={{ overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Estimate picker */}
              {form.mode === 'estimate' && (
                <div>
                  {form.estimate_item_id ? (
                    <div style={{ padding: '8px 12px', background: C.primaryBg, borderRadius: 6, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ color: C.primary, fontWeight: 600 }}>{form.item_name}</span>
                      <button onClick={() => setForm(f => ({ ...f, item_name: '', unit: '', quantity: '', estimate_item_id: '', max_qty: Infinity }))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textSec, fontSize: 12 }}>
                        Сменить
                      </button>
                    </div>
                  ) : (
                    <>
                      <input style={{ ...INPUT, marginBottom: 8 }} placeholder="Поиск по наименованию или разделу..." value={search} onChange={e => setSearch(e.target.value)} />
                      <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, maxHeight: 250, overflow: 'auto' }}>
                        {grouped.size === 0 && <div style={{ padding: 16, color: C.textMuted, fontSize: 13, textAlign: 'center' }}>Ничего не найдено</div>}
                        {Array.from(grouped.entries()).map(([section, items]) => (
                          <div key={section}>
                            <div style={{ padding: '5px 10px', fontSize: 11, fontWeight: 700, color: C.textSec, background: C.surfaceAlt, borderBottom: `1px solid ${C.border}` }}>
                              {section}
                            </div>
                            {items.map(item => (
                              <div key={item.id} onClick={() => selectEstimateItem(item)}
                                style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 13, borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                onMouseEnter={e => (e.currentTarget.style.background = C.primaryBg)}
                                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                                <span>{item.name}</span>
                                <span style={{ color: C.textSec, fontSize: 12, marginLeft: 8, whiteSpace: 'nowrap' }}>{item.quantity} {item.unit}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Custom name */}
              {form.mode === 'custom' && (
                <label style={LBL}>
                  Наименование *
                  <input style={INPUT} value={form.item_name} onChange={e => fld('item_name', e.target.value)} placeholder="Название материала или позиции" />
                </label>
              )}

              {/* Qty, unit, price — shown when item selected or custom mode */}
              {(form.estimate_item_id || form.mode === 'custom' || modal !== 'new') && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <label style={LBL}>
                      Количество{form.max_qty !== Infinity ? ` (макс. ${form.max_qty})` : ''}
                      <input style={INPUT} type="number" min="0" max={form.max_qty !== Infinity ? form.max_qty : undefined} step="any"
                        value={form.quantity}
                        onChange={e => {
                          const v = parseFloat(e.target.value) || 0;
                          fld('quantity', String(form.max_qty !== Infinity ? Math.min(v, form.max_qty) : v));
                        }} />
                    </label>
                    <label style={LBL}>
                      Ед. изм.
                      <input style={INPUT} value={form.unit} onChange={e => fld('unit', e.target.value)} placeholder="шт, м², кг..." readOnly={!!form.estimate_item_id && modal === 'new'} />
                    </label>
                  </div>
                  <label style={LBL}>
                    Цена за единицу ₽
                    <input style={INPUT} type="number" min="0" step="any" value={form.unit_price} onChange={e => fld('unit_price', e.target.value)} />
                  </label>
                  <div style={{ padding: '8px 12px', background: C.primaryBg, borderRadius: 6, fontSize: 13 }}>
                    <span style={{ color: C.textSec }}>Итого: </span>
                    <strong style={{ color: C.primary }}>{fmt(computedTotal())} ₽</strong>
                  </div>
                  <label style={LBL}>
                    Примечания
                    <textarea style={{ ...INPUT, marginTop: 4, resize: 'vertical' } as React.CSSProperties} rows={2} value={form.notes} onChange={e => fld('notes', e.target.value)} />
                  </label>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end', borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
              <button style={btnOutline()} onClick={() => setModal(null)}>Отмена</button>
              <button style={btnPrimary()} onClick={save}
                disabled={saving || !form.item_name.trim()}>
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
