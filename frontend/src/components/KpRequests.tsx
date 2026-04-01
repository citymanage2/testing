import { useEffect, useState } from 'react';
import client from '../api/client';
import { C, btnPrimary, btnOutline, btnDanger, badge, INPUT, LBL, CARD, TH, TD, OVERLAY, MODAL } from '../ui';

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

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидается',
  received: 'Получено',
  accepted: 'Принято',
  rejected: 'Отклонено',
};

function statusBadge(s: string) {
  if (s === 'pending') return <span style={badge(C.textMuted, '#f1f5f9')}>{STATUS_LABELS[s]}</span>;
  if (s === 'received') return <span style={badge(C.primary, C.primaryBg)}>{STATUS_LABELS[s]}</span>;
  if (s === 'accepted') return <span style={badge(C.success, C.successBg)}>{STATUS_LABELS[s]}</span>;
  if (s === 'rejected') return <span style={badge(C.danger, '#fef2f2')}>{STATUS_LABELS[s]}</span>;
  return <span style={badge(C.textMuted, '#f1f5f9')}>{s}</span>;
}

const emptyForm = () => ({
  item_name: '',
  unit: '',
  quantity: '1',
  unit_price: '0',
  supplier_id: '',
  notes: '',
});

function fmt(n: number) {
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function KpRequests({ projectId }: { projectId: string }) {
  const [requests, setRequests] = useState<KpRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<null | 'new' | KpRequest>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await client.get(`/projects/${projectId}/kp-requests`);
      setRequests(r.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [projectId]);

  const openNew = () => {
    setForm(emptyForm());
    setModal('new');
  };

  const openEdit = (req: KpRequest) => {
    setForm({
      item_name: req.item_name,
      unit: req.unit || '',
      quantity: String(req.quantity),
      unit_price: String(req.unit_price),
      supplier_id: req.supplier_id || '',
      notes: req.notes || '',
    });
    setModal(req);
  };

  const computedTotal = () => {
    const qty = parseFloat(form.quantity) || 0;
    const price = parseFloat(form.unit_price) || 0;
    return qty * price;
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        item_name: form.item_name,
        unit: form.unit || undefined,
        quantity: parseFloat(form.quantity) || 0,
        unit_price: parseFloat(form.unit_price) || 0,
        total: computedTotal(),
        supplier_id: form.supplier_id || undefined,
        notes: form.notes || undefined,
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
    if (!confirm('Удалить запрос КП?')) return;
    await client.delete(`/projects/${projectId}/kp-requests/${id}`);
    load();
  };

  const changeStatus = async (id: string, newStatus: string) => {
    await client.patch(`/projects/${projectId}/kp-requests/${id}`, { status: newStatus });
    load();
  };

  const fld = (field: keyof ReturnType<typeof emptyForm>, val: string) =>
    setForm(f => ({ ...f, [field]: val }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button style={btnPrimary('sm')} onClick={openNew}>+ Добавить КП</button>
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: C.textMuted }}>Загрузка...</div>
      ) : requests.length === 0 ? (
        <div style={{ ...CARD, padding: 40, textAlign: 'center', color: C.textMuted }}>Нет запросов КП</div>
      ) : (
        <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={TH}>Позиция</th>
                <th style={TH}>Ед.изм</th>
                <th style={TH}>Кол-во</th>
                <th style={TH}>Поставщик</th>
                <th style={TH}>Цена за ед.</th>
                <th style={TH}>Сумма</th>
                <th style={TH}>Статус</th>
                <th style={TH}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(req => (
                <tr key={req.id}>
                  <td style={TD}>
                    <div style={{ fontWeight: 500 }}>{req.item_name}</div>
                    {req.notes && (
                      <div style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>{req.notes}</div>
                    )}
                  </td>
                  <td style={TD}>{req.unit || '—'}</td>
                  <td style={TD}>{req.quantity}</td>
                  <td style={TD}>{req.supplier_name || req.supplier_id || '—'}</td>
                  <td style={TD}>{fmt(req.unit_price)} ₽</td>
                  <td style={{ ...TD, fontWeight: 600 }}>{fmt(req.total)} ₽</td>
                  <td style={TD}>
                    <select
                      value={req.status}
                      onChange={e => changeStatus(req.id, e.target.value)}
                      style={{ ...INPUT, fontSize: 12, padding: '2px 6px', width: 'auto' }}
                    >
                      {Object.entries(STATUS_LABELS).map(([val, lbl]) => (
                        <option key={val} value={val}>{lbl}</option>
                      ))}
                    </select>
                  </td>
                  <td style={TD}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button style={btnOutline('sm')} onClick={() => openEdit(req)}>Изменить</button>
                      <button style={btnDanger('sm')} onClick={() => deleteRequest(req.id)}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal !== null && (
        <div style={OVERLAY} onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div style={{ ...MODAL, maxWidth: 480 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>
              {modal === 'new' ? 'Добавить запрос КП' : 'Редактировать запрос КП'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={LBL}>
                Наименование позиции *
                <input
                  style={INPUT}
                  value={form.item_name}
                  onChange={e => fld('item_name', e.target.value)}
                  placeholder="Название материала или позиции"
                />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={LBL}>
                  Единица измерения
                  <input
                    style={INPUT}
                    value={form.unit}
                    onChange={e => fld('unit', e.target.value)}
                    placeholder="шт, м², кг..."
                  />
                </label>
                <label style={LBL}>
                  Количество
                  <input
                    style={INPUT}
                    type="number"
                    min="0"
                    value={form.quantity}
                    onChange={e => fld('quantity', e.target.value)}
                  />
                </label>
              </div>
              <label style={LBL}>
                Цена за единицу ₽
                <input
                  style={INPUT}
                  type="number"
                  min="0"
                  value={form.unit_price}
                  onChange={e => fld('unit_price', e.target.value)}
                />
              </label>
              <div style={{ padding: '8px 12px', background: C.primaryBg, borderRadius: 6, fontSize: 13 }}>
                <span style={{ color: C.textSec }}>Итого: </span>
                <strong style={{ color: C.primary }}>{fmt(computedTotal())} ₽</strong>
              </div>
              <label style={LBL}>
                Поставщик (ID или название)
                <input
                  style={INPUT}
                  value={form.supplier_id}
                  onChange={e => fld('supplier_id', e.target.value)}
                  placeholder="ID или название поставщика"
                />
              </label>
              <label style={LBL}>
                Примечания
                <textarea
                  style={{ ...INPUT, marginTop: 4, resize: 'vertical' }}
                  rows={2}
                  value={form.notes}
                  onChange={e => fld('notes', e.target.value)}
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={btnOutline()} onClick={() => setModal(null)}>Отмена</button>
              <button
                style={btnPrimary()}
                onClick={save}
                disabled={saving || !form.item_name.trim()}
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
