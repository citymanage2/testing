import { useCallback, useEffect, useState } from 'react';
import client from '../api/client';
import {
  C, CARD, INPUT, LBL, MODAL, OVERLAY, TD, TH,
  badge, btnDanger, btnGhost, btnOutline, btnPrimary,
} from '../ui';

interface Contractor { id: string; name: string }

type PurchaseStatus = 'draft' | 'confirmed' | 'cancelled';

interface Purchase {
  id: string;
  title: string;
  status: PurchaseStatus;
  items_count: number;
  total_amount: number;
  created_at: string;
  notes?: string;
}

interface PurchaseItem {
  id?: string;
  estimate_item_id?: string;
  name: string;
  unit: string;
  qty_requested: number | string;
  supplier_id?: string;
  unit_price?: number | string;
  notes?: string;
}

interface EstimateMaterial {
  estimate_item_id?: string;
  name: string;
  unit: string;
  quantity_in_estimate: number;
  quantity_requested: number;
  quantity_delivered: number;
}

function statusBadge(s: string) {
  if (s === 'confirmed' || s === 'delivered') return <span style={badge(C.success, C.successBg)}>Подтверждено</span>;
  if (s === 'cancelled') return <span style={badge(C.danger, C.dangerBg)}>Отменено</span>;
  return <span style={badge(C.textMuted, '#f1f5f9')}>Черновик</span>;
}

function fmt(d: string) { return d ? new Date(d).toLocaleDateString('ru-RU') : '—'; }
function num(v: number | string | undefined) { return Number(v) || 0; }

const emptyItem = (): PurchaseItem => ({ name: '', unit: '', qty_requested: '', supplier_id: '', unit_price: '', notes: '' });

export default function PurchaseRequests({ projectId }: { projectId: string }) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [estimateMaterials, setEstimateMaterials] = useState<EstimateMaterial[]>([]);
  const [loading, setLoading] = useState(false);

  // new purchase modal
  const [newModal, setNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [savingNew, setSavingNew] = useState(false);

  // items editor modal
  const [itemsModal, setItemsModal] = useState<Purchase | null>(null);
  const [editItems, setEditItems] = useState<PurchaseItem[]>([]);
  const [itemsTab, setItemsTab] = useState<'estimate' | 'manual'>('estimate');
  const [savingItems, setSavingItems] = useState(false);

  // estimate materials selection state (for items modal)
  const [selectedMaterials, setSelectedMaterials] = useState<Record<string, { qty: string; supplier_id: string; unit_price: string }>>({});

  // view items modal (for confirmed)
  const [viewModal, setViewModal] = useState<Purchase | null>(null);
  const [viewItems, setViewItems] = useState<PurchaseItem[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      client.get(`/projects/${projectId}/purchases`),
      client.get('/contractors'),
      client.get(`/projects/${projectId}/purchases/materials-summary`),
    ]).then(([pr, cr, mr]) => {
      setPurchases(pr.data);
      setContractors(cr.data);
      setEstimateMaterials(mr.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const createPurchase = async () => {
    if (!newTitle.trim()) return;
    setSavingNew(true);
    try {
      await client.post(`/projects/${projectId}/purchases`, { title: newTitle });
      setNewModal(false);
      setNewTitle('');
      load();
    } finally { setSavingNew(false); }
  };

  const confirmPurchase = async (p: Purchase) => {
    if (!confirm(`Подтвердить заявку "${p.title}"? Позиции будут учтены в расходе.`)) return;
    await client.patch(`/projects/${projectId}/purchases/${p.id}`, { status: 'confirmed' });
    load();
  };

  const deletePurchase = async (id: string) => {
    if (!confirm('Удалить заявку?')) return;
    await client.delete(`/projects/${projectId}/purchases/${id}`);
    load();
  };

  const openItemsEditor = async (p: Purchase) => {
    // Load existing items
    try {
      const r = await client.get(`/projects/${projectId}/purchases/${p.id}/items`);
      const existing: PurchaseItem[] = r.data.map((i: PurchaseItem & { qty_requested?: number; quantity_requested?: number }) => ({
        id: i.id,
        estimate_item_id: i.estimate_item_id,
        name: i.name,
        unit: i.unit,
        qty_requested: i.qty_requested ?? (i as { quantity_requested?: number }).quantity_requested ?? 0,
        supplier_id: i.supplier_id || '',
        unit_price: i.unit_price ?? '',
        notes: i.notes || '',
      }));
      setEditItems(existing);

      // Pre-populate selectedMaterials from existing items linked to estimates
      const sel: Record<string, { qty: string; supplier_id: string; unit_price: string }> = {};
      existing.forEach(it => {
        if (it.estimate_item_id) {
          sel[it.estimate_item_id] = {
            qty: String(it.qty_requested),
            supplier_id: it.supplier_id || '',
            unit_price: String(it.unit_price ?? ''),
          };
        }
      });
      setSelectedMaterials(sel);
    } catch {
      setEditItems([]);
      setSelectedMaterials({});
    }
    setItemsTab('estimate');
    setItemsModal(p);
  };

  const openViewModal = async (p: Purchase) => {
    try {
      const r = await client.get(`/projects/${projectId}/purchases/${p.id}/items`);
      setViewItems(r.data);
    } catch { setViewItems([]); }
    setViewModal(p);
  };

  const saveItems = async () => {
    if (!itemsModal) return;
    setSavingItems(true);
    try {
      // Combine estimate-linked items + manual items
      const estimateLinked = Object.entries(selectedMaterials)
        .filter(([, v]) => num(v.qty) > 0)
        .map(([eid, v]) => {
          const mat = estimateMaterials.find(m => m.estimate_item_id === eid);
          return {
            estimate_item_id: eid,
            name: mat?.name || eid,
            unit: mat?.unit || '',
            quantity_requested: num(v.qty),
            supplier_id: v.supplier_id || null,
            unit_price: num(v.unit_price) || null,
          };
        });

      const manual = editItems
        .filter(it => !it.estimate_item_id && it.name.trim())
        .map(it => ({
          name: it.name,
          unit: it.unit,
          quantity_requested: num(it.qty_requested),
          supplier_id: it.supplier_id || null,
          unit_price: num(it.unit_price) || null,
          notes: it.notes || null,
        }));

      await client.put(`/projects/${projectId}/purchases/${itemsModal.id}/items`, [...estimateLinked, ...manual]);
      load();
      setItemsModal(null);
    } finally { setSavingItems(false); }
  };

  const tabStyle = (active: boolean) => ({
    padding: '5px 14px', border: 'none', cursor: 'pointer', fontSize: 13,
    fontWeight: active ? 600 : 400,
    background: active ? C.primary : C.surfaceAlt,
    color: active ? '#fff' : C.textSec,
    borderRadius: 6,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button style={btnPrimary('sm')} onClick={() => setNewModal(true)} data-tooltip="Создать новую заявку на закупку материалов">+ Новая заявка</button>
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: C.textMuted }}>Загрузка...</div>
      ) : purchases.length === 0 ? (
        <div style={{ ...CARD, padding: 32, textAlign: 'center', color: C.textMuted }}>
          Нет заявок на закупку. Заявка подтверждает расход материалов.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {purchases.map(p => (
            <div key={p.id} style={{ ...CARD, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{p.title}</span>
                  {statusBadge(p.status)}
                </div>
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>
                  {fmt(p.created_at)} · Позиций: {p.items_count}
                  {p.total_amount > 0 && <span style={{ marginLeft: 8, fontWeight: 600, color: C.text }}>{p.total_amount.toLocaleString('ru-RU')} ₽</span>}
                  {p.status === 'confirmed' && <span style={{ marginLeft: 8, color: C.success }}>✓ Учтено в КС-2</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                {p.status === 'draft' ? (
                  <>
                    <button style={btnOutline('sm')} onClick={() => openItemsEditor(p)} data-tooltip="Редактировать позиции заявки на закупку">Редактировать</button>
                    <button style={btnPrimary('sm')} onClick={() => confirmPurchase(p)} data-tooltip="Подтвердить заявку — материалы учтутся в расходах по КС-2">Подтвердить</button>
                    <button style={btnDanger('sm')} onClick={() => deletePurchase(p.id)} data-tooltip="Удалить заявку на закупку">✕</button>
                  </>
                ) : p.status === 'confirmed' ? (
                  <>
                    <button style={btnGhost('sm')} onClick={() => openViewModal(p)} data-tooltip="Просмотреть позиции подтверждённой заявки">Просмотр</button>
                  </>
                ) : (
                  <button style={btnGhost('sm')} onClick={() => openViewModal(p)} data-tooltip="Просмотреть позиции заявки">Просмотр</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Purchase Modal */}
      {newModal && (
        <div style={OVERLAY} onClick={ev => { if (ev.target === ev.currentTarget) setNewModal(false); }}>
          <div style={{ ...MODAL, maxWidth: 400 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>Новая заявка на закупку</h3>
            <label style={LBL}>
              Название
              <input style={INPUT} value={newTitle} onChange={ev => setNewTitle(ev.target.value)}
                placeholder="Напр: Арматура, апрель" autoFocus
                onKeyDown={ev => { if (ev.key === 'Enter' && newTitle.trim()) createPurchase(); }} />
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button style={btnOutline()} onClick={() => setNewModal(false)} data-tooltip="Закрыть без создания">Отмена</button>
              <button style={btnPrimary()} onClick={createPurchase} disabled={!newTitle.trim() || savingNew} data-tooltip="Создать новую заявку на закупку">
                {savingNew ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Items Editor Modal */}
      {itemsModal && (
        <div style={OVERLAY} onClick={ev => { if (ev.target === ev.currentTarget) setItemsModal(null); }}>
          <div style={{ ...MODAL, maxWidth: 860, width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>Позиции — {itemsModal.title}</h3>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
              <button style={tabStyle(itemsTab === 'estimate')} onClick={() => setItemsTab('estimate')} data-tooltip="Выбрать материалы из сметы проекта">Из сметы</button>
              <button style={tabStyle(itemsTab === 'manual')} onClick={() => setItemsTab('manual')} data-tooltip="Добавить позиции закупки вручную">Вручную</button>
            </div>

            <div style={{ flex: 1, overflow: 'auto' }}>
              {itemsTab === 'estimate' ? (
                <div>
                  {estimateMaterials.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: C.textMuted }}>
                      Нет материалов в смете проекта
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 12, color: C.textMuted }}>
                        <button style={btnGhost('sm')} onClick={() => {
                          const sel: typeof selectedMaterials = {};
                          estimateMaterials.forEach(m => {
                            if (m.estimate_item_id) sel[m.estimate_item_id] = { qty: String(m.quantity_in_estimate), supplier_id: '', unit_price: '' };
                          });
                          setSelectedMaterials(sel);
                        }}>Выбрать все</button>
                        <button style={btnGhost('sm')} onClick={() => setSelectedMaterials({})}>Снять все</button>
                        <span style={{ alignSelf: 'center' }}>Отмечено: {Object.values(selectedMaterials).filter(v => num(v.qty) > 0).length} / {estimateMaterials.length}</span>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr>
                            <th style={{ ...TH, width: 32 }}></th>
                            <th style={TH}>Материал</th>
                            <th style={TH}>Ед.</th>
                            <th style={TH}>В смете</th>
                            <th style={TH}>Количество</th>
                            <th style={TH}>Поставщик</th>
                            <th style={TH}>Цена, ₽</th>
                          </tr>
                        </thead>
                        <tbody>
                          {estimateMaterials.map(mat => {
                            const eid = mat.estimate_item_id || mat.name;
                            const sel = selectedMaterials[eid];
                            const checked = !!sel && num(sel.qty) > 0;
                            return (
                              <tr key={eid} style={{ background: checked ? C.successBg : 'transparent' }}>
                                <td style={{ ...TD, textAlign: 'center' }}>
                                  <input type="checkbox" checked={checked}
                                    onChange={chev => {
                                      if (chev.target.checked) {
                                        setSelectedMaterials(prev => ({ ...prev, [eid]: { qty: String(mat.quantity_in_estimate), supplier_id: '', unit_price: '' } }));
                                      } else {
                                        setSelectedMaterials(prev => { const n = { ...prev }; delete n[eid]; return n; });
                                      }
                                    }} />
                                </td>
                                <td style={TD}>{mat.name}</td>
                                <td style={TD}>{mat.unit}</td>
                                <td style={{ ...TD, color: C.textMuted }}>{mat.quantity_in_estimate}</td>
                                <td style={TD}>
                                  <input type="number" style={{ ...INPUT, width: 90 }}
                                    value={sel?.qty ?? ''}
                                    placeholder={checked ? '' : '—'}
                                    onChange={qev => {
                                      const v = qev.target.value;
                                      setSelectedMaterials(prev => ({
                                        ...prev,
                                        [eid]: { ...prev[eid] ?? { supplier_id: '', unit_price: '' }, qty: v },
                                      }));
                                    }}
                                    onFocus={() => {
                                      if (!selectedMaterials[eid]) {
                                        setSelectedMaterials(prev => ({ ...prev, [eid]: { qty: String(mat.quantity_in_estimate), supplier_id: '', unit_price: '' } }));
                                      }
                                    }}
                                  />
                                </td>
                                <td style={TD}>
                                  <select style={{ ...INPUT, minWidth: 120 }}
                                    value={sel?.supplier_id ?? ''}
                                    onChange={sev => setSelectedMaterials(prev => ({
                                      ...prev,
                                      [eid]: { ...prev[eid] ?? { qty: String(mat.quantity_in_estimate), unit_price: '' }, supplier_id: sev.target.value },
                                    }))}>
                                    <option value="">— не указан —</option>
                                    {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                  </select>
                                </td>
                                <td style={TD}>
                                  <input type="number" style={{ ...INPUT, width: 90 }}
                                    value={sel?.unit_price ?? ''}
                                    onChange={pev => setSelectedMaterials(prev => ({
                                      ...prev,
                                      [eid]: { ...prev[eid] ?? { qty: String(mat.quantity_in_estimate), supplier_id: '' }, unit_price: pev.target.value },
                                    }))}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              ) : (
                <div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={TH}>Наименование</th>
                        <th style={TH}>Ед.</th>
                        <th style={TH}>Кол-во</th>
                        <th style={TH}>Поставщик</th>
                        <th style={TH}>Цена</th>
                        <th style={TH}>Примечание</th>
                        <th style={TH}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {editItems.filter(it => !it.estimate_item_id).map((it, i) => (
                        <tr key={i}>
                          <td style={TD}><input style={{ ...INPUT, minWidth: 140 }} value={it.name} onChange={ev => setEditItems(items => items.map((x, j) => j === i ? { ...x, name: ev.target.value } : x))} /></td>
                          <td style={TD}><input style={{ ...INPUT, width: 60 }} value={it.unit} onChange={ev => setEditItems(items => items.map((x, j) => j === i ? { ...x, unit: ev.target.value } : x))} /></td>
                          <td style={TD}><input style={{ ...INPUT, width: 80 }} type="number" value={it.qty_requested} onChange={ev => setEditItems(items => items.map((x, j) => j === i ? { ...x, qty_requested: ev.target.value } : x))} /></td>
                          <td style={TD}>
                            <select style={{ ...INPUT, minWidth: 120 }} value={it.supplier_id ?? ''} onChange={ev => setEditItems(items => items.map((x, j) => j === i ? { ...x, supplier_id: ev.target.value } : x))}>
                              <option value="">— не указан —</option>
                              {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </td>
                          <td style={TD}><input style={{ ...INPUT, width: 100 }} type="number" value={it.unit_price ?? ''} onChange={ev => setEditItems(items => items.map((x, j) => j === i ? { ...x, unit_price: ev.target.value } : x))} /></td>
                          <td style={TD}><input style={{ ...INPUT, minWidth: 100 }} value={it.notes ?? ''} onChange={ev => setEditItems(items => items.map((x, j) => j === i ? { ...x, notes: ev.target.value } : x))} /></td>
                          <td style={TD}><button style={btnDanger('sm')} onClick={() => setEditItems(items => items.filter((_, j) => j !== i))}>✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button style={{ ...btnOutline('sm'), marginTop: 8 }} onClick={() => setEditItems(items => [...items, emptyItem()])}>+ Добавить строку</button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 12, borderTop: `1px solid ${C.border}`, justifyContent: 'flex-end' }}>
              <button style={btnOutline()} onClick={() => setItemsModal(null)}>Отмена</button>
              <button style={btnPrimary()} onClick={saveItems} disabled={savingItems}>
                {savingItems ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal (for confirmed/cancelled) */}
      {viewModal && (
        <div style={OVERLAY} onClick={ev => { if (ev.target === ev.currentTarget) setViewModal(null); }}>
          <div style={{ ...MODAL, maxWidth: 700, width: '95%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{viewModal.title}</h3>
              {statusBadge(viewModal.status)}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={TH}>Материал</th>
                  <th style={TH}>Ед.</th>
                  <th style={TH}>Кол-во</th>
                  <th style={TH}>Поставщик</th>
                  <th style={TH}>Цена</th>
                  <th style={TH}>Сумма</th>
                </tr>
              </thead>
              <tbody>
                {viewItems.map((it, i) => {
                  const supplier = contractors.find(c => c.id === it.supplier_id);
                  return (
                    <tr key={i}>
                      <td style={TD}>{it.name}</td>
                      <td style={TD}>{it.unit}</td>
                      <td style={TD}>{num(it.qty_requested)}</td>
                      <td style={TD}>{supplier?.name || '—'}</td>
                      <td style={TD}>{num(it.unit_price).toLocaleString('ru-RU') || '—'}</td>
                      <td style={{ ...TD, fontWeight: 600 }}>{(num(it.qty_requested) * num(it.unit_price)).toLocaleString('ru-RU')}</td>
                    </tr>
                  );
                })}
                {viewItems.length === 0 && (
                  <tr><td colSpan={6} style={{ ...TD, textAlign: 'center', color: C.textMuted }}>Нет позиций</td></tr>
                )}
              </tbody>
            </table>
            {viewModal.status === 'confirmed' && (
              <div style={{ marginTop: 12, padding: '8px 12px', background: C.successBg, borderRadius: 6, fontSize: 13, color: C.success }}>
                ✓ Подтверждено — материалы учтены в расходе и отражены в актировании КС-2
              </div>
            )}
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button style={btnOutline()} onClick={() => setViewModal(null)}>Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
