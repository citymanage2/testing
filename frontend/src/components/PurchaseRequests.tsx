import React, { useCallback, useEffect, useState } from 'react';
import client from '../api/client';
import {
  C, CARD, INPUT, LBL, MODAL, OVERLAY, TD, TH,
  badge, btnDanger, btnGhost, btnOutline, btnPrimary,
} from '../ui';

interface Contractor { id: string; name: string }

type PurchaseStatus = 'draft' | 'submitted' | 'approved' | 'ordered' | 'delivered' | 'cancelled';

interface Purchase {
  id: string;
  title: string;
  status: PurchaseStatus;
  items_count: number;
  total_amount: number;
  created_at: string;
}

interface PurchaseItem {
  id?: string;
  name: string;
  unit: string;
  qty_requested: number | string;
  qty_delivered: number | string;
  supplier_id: string;
  unit_price: number | string;
  notes: string;
}

const STATUS_LABELS: Record<PurchaseStatus, string> = {
  draft: 'Черновик', submitted: 'На согласовании', approved: 'Согласовано',
  ordered: 'Заказано', delivered: 'Доставлено', cancelled: 'Отменено',
};

const ALL_STATUSES: PurchaseStatus[] = ['draft', 'submitted', 'approved', 'ordered', 'delivered', 'cancelled'];

function statusBadge(s: PurchaseStatus) {
  const map: Record<PurchaseStatus, [string, string]> = {
    draft: [C.textMuted, '#f1f5f9'],
    submitted: [C.primary, C.primaryBg],
    approved: [C.success, C.successBg],
    ordered: ['#7c3aed', '#f5f3ff'],
    delivered: [C.success, C.successBg],
    cancelled: [C.danger, C.dangerBg],
  };
  const [color, bg] = map[s];
  const style = s === 'delivered' ? { ...badge(color, bg), fontWeight: 700 } : badge(color, bg);
  return <span style={style}>{STATUS_LABELS[s]}</span>;
}

function fmt(d: string) { return d ? new Date(d).toLocaleDateString('ru-RU') : '—' }
function num(v: number | string) { return Number(v) || 0 }

const emptyItem = (): PurchaseItem => ({ name: '', unit: '', qty_requested: '', qty_delivered: 0, supplier_id: '', unit_price: '', notes: '' });

export default function PurchaseRequests({ projectId }: { projectId: string }) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | PurchaseStatus>('all');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [itemsMap, setItemsMap] = useState<Record<string, PurchaseItem[]>>({});
  const [loading, setLoading] = useState(false);

  // new purchase modal
  const [newModal, setNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [savingNew, setSavingNew] = useState(false);

  // items editor modal
  const [itemsModal, setItemsModal] = useState<Purchase | null>(null);
  const [editItems, setEditItems] = useState<PurchaseItem[]>([]);
  const [savingItems, setSavingItems] = useState(false);

  // inline delivery edit
  const [deliveryEdit, setDeliveryEdit] = useState<Record<string, Record<string, string>>>({}); // purchaseId -> itemId -> qty

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      client.get(`/projects/${projectId}/purchases`),
      client.get('/contractors'),
    ]).then(([pr, cr]) => {
      setPurchases(pr.data);
      setContractors(cr.data);
    }).finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const loadItems = async (id: string) => {
    const r = await client.get(`/projects/${projectId}/purchases/${id}/items`);
    setItemsMap(m => ({ ...m, [id]: r.data }));
  };

  const toggleExpand = (id: string) => {
    setExpanded(e => {
      const open = !e[id];
      if (open && !itemsMap[id]) loadItems(id);
      return { ...e, [id]: open };
    });
  };

  const createPurchase = async () => {
    setSavingNew(true);
    try {
      await client.post(`/projects/${projectId}/purchases`, { title: newTitle });
      setNewModal(false);
      setNewTitle('');
      load();
    } finally { setSavingNew(false); }
  };

  const updateStatus = async (id: string, status: string) => {
    await client.patch(`/projects/${projectId}/purchases/${id}`, { status });
    load();
  };

  const deletePurchase = async (id: string) => {
    if (!confirm('Удалить заявку?')) return;
    await client.delete(`/projects/${projectId}/purchases/${id}`);
    load();
  };

  const openItemsEditor = (p: Purchase) => {
    const items = itemsMap[p.id] ?? [emptyItem()];
    setEditItems(items.map(i => ({ ...i })));
    setItemsModal(p);
  };

  const saveItems = async () => {
    if (!itemsModal) return;
    setSavingItems(true);
    try {
      await client.put(`/projects/${projectId}/purchases/${itemsModal.id}/items`, editItems);
      await loadItems(itemsModal.id);
      load();
      setItemsModal(null);
    } finally { setSavingItems(false); }
  };

  const setItemField = (idx: number, field: keyof PurchaseItem, val: string) => {
    setEditItems(items => items.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  };

  const saveDelivery = async (purchaseId: string, itemId: string, qty: string) => {
    await client.patch(`/projects/${projectId}/purchases/${purchaseId}/items/${itemId}`, { qty_delivered: Number(qty) });
    await loadItems(purchaseId);
    setDeliveryEdit(prev => {
      const n = { ...prev };
      if (n[purchaseId]) delete n[purchaseId][itemId];
      return n;
    });
  };

  const filtered = statusFilter === 'all' ? purchases : purchases.filter(p => p.status === statusFilter);

  const tabStyle = (active: boolean) => ({
    ...btnOutline('sm'),
    background: active ? C.primary : C.surface,
    color: active ? '#fff' : C.text,
    border: `1px solid ${active ? C.primary : C.border}`,
  });

  const statusActions = (p: Purchase) => {
    const btns: React.ReactNode[] = [];
    if (p.status === 'draft') {
      btns.push(<button key="submit" style={btnOutline('sm')} onClick={() => updateStatus(p.id, 'submitted')}>Отправить на согласование</button>);
      btns.push(<button key="del" style={btnDanger('sm')} onClick={() => deletePurchase(p.id)}>✕</button>);
    }
    if (p.status === 'submitted') {
      btns.push(<button key="approve" style={btnOutline('sm')} onClick={() => updateStatus(p.id, 'approved')}>Согласовать</button>);
      btns.push(<button key="cancel" style={btnDanger('sm')} onClick={() => updateStatus(p.id, 'cancelled')}>Отменить</button>);
    }
    if (p.status === 'approved') {
      btns.push(<button key="order" style={btnOutline('sm')} onClick={() => updateStatus(p.id, 'ordered')}>Заказать</button>);
      btns.push(<button key="cancel" style={btnDanger('sm')} onClick={() => updateStatus(p.id, 'cancelled')}>Отменить</button>);
    }
    if (p.status === 'ordered') {
      btns.push(<button key="deliver" style={btnPrimary('sm')} onClick={() => updateStatus(p.id, 'delivered')}>Отметить доставку</button>);
    }
    return btns;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Status filter tabs */}
      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <button style={tabStyle(statusFilter === 'all')} onClick={() => setStatusFilter('all')}>Все</button>
        {ALL_STATUSES.map(s => (
          <button key={s} style={tabStyle(statusFilter === s)} onClick={() => setStatusFilter(s)}>
            {STATUS_LABELS[s]}
          </button>
        ))}
        <button style={{ ...btnPrimary('sm'), marginLeft: 'auto' }} onClick={() => setNewModal(true)}>+ Новая заявка</button>
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: C.textMuted }}>Загрузка...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: C.textMuted }}>Нет заявок</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(p => (
            <div key={p.id} style={{ ...CARD, padding: 0 }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', flexWrap: 'wrap' }}>
                <button style={btnGhost('sm')} onClick={() => toggleExpand(p.id)}>
                  {expanded[p.id] ? '▾' : '▸'}
                </button>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{p.title}</span>
                {statusBadge(p.status)}
                <span style={{ fontSize: 12, color: C.textMuted }}>Позиций: {p.items_count}</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{p.total_amount?.toLocaleString('ru-RU')} ₽</span>
                <span style={{ fontSize: 12, color: C.textMuted }}>{fmt(p.created_at)}</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button style={btnOutline('sm')} onClick={() => openItemsEditor(p)}>Позиции</button>
                  {statusActions(p)}
                </div>
              </div>

              {/* Expanded items */}
              {expanded[p.id] && (
                <div style={{ borderTop: `1px solid ${C.border}`, padding: '12px 16px', overflowX: 'auto' }}>
                  {!itemsMap[p.id] ? (
                    <div style={{ color: C.textMuted, fontSize: 13 }}>Загрузка...</div>
                  ) : itemsMap[p.id].length === 0 ? (
                    <div style={{ color: C.textMuted, fontSize: 13 }}>Нет позиций</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={TH}>Наименование</th>
                          <th style={TH}>Ед.</th>
                          <th style={TH}>Заказано</th>
                          <th style={TH}>Доставлено</th>
                          <th style={TH}>Поставщик</th>
                          <th style={TH}>Цена</th>
                          <th style={TH}>Сумма</th>
                          <th style={TH}>Примечание</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemsMap[p.id].map(it => {
                          const itemId = it.id ?? '';
                          const editQty = deliveryEdit[p.id]?.[itemId];
                          const supplier = contractors.find(c => c.id === it.supplier_id);
                          return (
                            <tr key={itemId}>
                              <td style={TD}>{it.name}</td>
                              <td style={TD}>{it.unit}</td>
                              <td style={TD}>{it.qty_requested}</td>
                              <td style={{ ...TD }}>
                                {p.status === 'ordered' ? (
                                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                    <input
                                      type="number"
                                      style={{ ...INPUT, width: 70 }}
                                      value={editQty ?? String(it.qty_delivered)}
                                      onChange={e => setDeliveryEdit(prev => ({
                                        ...prev,
                                        [p.id]: { ...prev[p.id], [itemId]: e.target.value },
                                      }))}
                                    />
                                    {editQty !== undefined && (
                                      <button style={btnPrimary('sm')} onClick={() => saveDelivery(p.id, itemId, editQty)}>✓</button>
                                    )}
                                  </div>
                                ) : it.qty_delivered}
                              </td>
                              <td style={{ ...TD, fontSize: 12 }}>{supplier?.name ?? '—'}</td>
                              <td style={TD}>{num(it.unit_price).toLocaleString('ru-RU')}</td>
                              <td style={TD}>{(num(it.qty_requested) * num(it.unit_price)).toLocaleString('ru-RU')}</td>
                              <td style={{ ...TD, color: C.textSec, fontSize: 12 }}>{it.notes || '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New Purchase Modal */}
      {newModal && (
        <div style={OVERLAY} onClick={e => { if (e.target === e.currentTarget) setNewModal(false); }}>
          <div style={{ ...MODAL, maxWidth: 400 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>Новая заявка на закупку</h3>
            <label style={LBL}>
              Название
              <input style={INPUT} value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Напр: Закупка арматуры" autoFocus />
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={btnOutline()} onClick={() => setNewModal(false)}>Отмена</button>
              <button style={btnPrimary()} onClick={createPurchase} disabled={!newTitle.trim() || savingNew}>
                {savingNew ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Items editor modal */}
      {itemsModal && (
        <div style={OVERLAY} onClick={e => { if (e.target === e.currentTarget) setItemsModal(null); }}>
          <div style={{ ...MODAL, maxWidth: 920, width: '95%' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>
              Позиции — {itemsModal.title}
            </h3>
            <div style={{ overflowX: 'auto', marginBottom: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={TH}>Наименование</th>
                    <th style={TH}>Ед.</th>
                    <th style={TH}>Кол-во</th>
                    <th style={TH}>Поставщик</th>
                    <th style={TH}>Цена</th>
                    <th style={TH}>Сумма</th>
                    <th style={TH}>Примечание</th>
                    <th style={TH}></th>
                  </tr>
                </thead>
                <tbody>
                  {editItems.map((it, i) => (
                    <tr key={i}>
                      <td style={TD}>
                        <input style={{ ...INPUT, minWidth: 140 }} value={it.name} onChange={e => setItemField(i, 'name', e.target.value)} />
                      </td>
                      <td style={TD}>
                        <input style={{ ...INPUT, width: 60 }} value={it.unit} onChange={e => setItemField(i, 'unit', e.target.value)} />
                      </td>
                      <td style={TD}>
                        <input style={{ ...INPUT, width: 80 }} type="number" value={it.qty_requested} onChange={e => setItemField(i, 'qty_requested', e.target.value)} />
                      </td>
                      <td style={TD}>
                        <select style={{ ...INPUT, minWidth: 120 }} value={it.supplier_id} onChange={e => setItemField(i, 'supplier_id', e.target.value)}>
                          <option value="">—</option>
                          {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </td>
                      <td style={TD}>
                        <input style={{ ...INPUT, width: 100 }} type="number" value={it.unit_price} onChange={e => setItemField(i, 'unit_price', e.target.value)} />
                      </td>
                      <td style={{ ...TD, fontWeight: 500 }}>
                        {(num(it.qty_requested) * num(it.unit_price)).toLocaleString('ru-RU')}
                      </td>
                      <td style={TD}>
                        <input style={{ ...INPUT, minWidth: 100 }} value={it.notes} onChange={e => setItemField(i, 'notes', e.target.value)} />
                      </td>
                      <td style={TD}>
                        <button style={btnDanger('sm')} onClick={() => setEditItems(items => items.filter((_, j) => j !== i))}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginBottom: 12 }}>
              <button style={btnOutline('sm')} onClick={() => setEditItems(items => [...items, emptyItem()])}>+ Добавить строку</button>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={btnOutline()} onClick={() => setItemsModal(null)}>Отмена</button>
              <button style={btnPrimary()} onClick={saveItems} disabled={savingItems}>
                {savingItems ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
