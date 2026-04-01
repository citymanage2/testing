import { useCallback, useEffect, useState } from 'react';
import client from '../api/client';
import {
  C, CARD, INPUT, LBL, MODAL, OVERLAY, TD, TH,
  badge, btnDanger, btnGhost, btnOutline, btnPrimary,
} from '../ui';

interface Contractor { id: string; name: string }

interface Contract {
  id: string;
  contract_number: string;
  contractor_id: string;
  contractor_name: string;
  status: 'draft' | 'approval' | 'signed';
  advance_pct: number;
  guarantee_pct: number;
  signed_at: string | null;
  total_amount?: number;
}

interface ContractItem {
  id?: string;
  name: string;
  unit: string;
  quantity: number | string;
  unit_price: number | string;
  notes: string;
}

const STATUS_LABELS: Record<string, string> = { draft: 'Черновик', approval: 'На согласовании', signed: 'Подписан' };

function statusBadge(s: string) {
  if (s === 'signed') return <span style={badge(C.success, C.successBg)}>{STATUS_LABELS[s]}</span>;
  if (s === 'approval') return <span style={badge(C.warning, C.warningBg)}>{STATUS_LABELS[s]}</span>;
  return <span style={badge(C.textMuted, '#f1f5f9')}>{STATUS_LABELS[s] ?? s}</span>;
}

function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString('ru-RU') : '—' }
function num(v: number | string) { return Number(v) || 0 }

const emptyItem = (): ContractItem => ({ name: '', unit: '', quantity: '', unit_price: '', notes: '' });

const emptyContract: { contract_number: string; contractor_id: string; status: 'draft' | 'approval' | 'signed'; advance_pct: number; guarantee_pct: number; signed_at: string } = { contract_number: '', contractor_id: '', status: 'draft', advance_pct: 0, guarantee_pct: 0, signed_at: '' };

export default function SubcontractorContracts({ projectId }: { projectId: string }) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [itemsMap, setItemsMap] = useState<Record<string, ContractItem[]>>({});
  const [loading, setLoading] = useState(false);

  // contract modal
  const [contractModal, setContractModal] = useState<null | 'new' | Contract>(null);
  const [form, setForm] = useState(emptyContract);
  const [saving, setSaving] = useState(false);

  // items editor modal
  const [itemsModal, setItemsModal] = useState<Contract | null>(null);
  const [editItems, setEditItems] = useState<ContractItem[]>([]);
  const [savingItems, setSavingItems] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      client.get(`/projects/${projectId}/contracts`),
      client.get('/contractors'),
    ]).then(([cr, contr]) => {
      setContracts(cr.data);
      setContractors(contr.data);
    }).finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const loadItems = async (contractId: string) => {
    const r = await client.get(`/projects/${projectId}/contracts/${contractId}/items`);
    setItemsMap(m => ({ ...m, [contractId]: r.data }));
  };

  const toggleExpand = (id: string) => {
    setExpanded(e => {
      const open = !e[id];
      if (open && !itemsMap[id]) loadItems(id);
      return { ...e, [id]: open };
    });
  };

  const openNew = () => { setForm(emptyContract); setContractModal('new'); };
  const openEdit = (c: Contract) => {
    setForm({ contract_number: c.contract_number, contractor_id: c.contractor_id, status: c.status, advance_pct: c.advance_pct, guarantee_pct: c.guarantee_pct, signed_at: c.signed_at ?? '' });
    setContractModal(c);
  };

  const saveContract = async () => {
    setSaving(true);
    try {
      if (contractModal === 'new') {
        await client.post(`/projects/${projectId}/contracts`, form);
      } else if (contractModal) {
        await client.patch(`/projects/${projectId}/contracts/${(contractModal as Contract).id}`, form);
      }
      setContractModal(null);
      load();
    } finally { setSaving(false); }
  };

  const deleteContract = async (id: string) => {
    if (!confirm('Удалить договор?')) return;
    await client.delete(`/projects/${projectId}/contracts/${id}`);
    load();
  };

  const openItemsEditor = async (c: Contract) => {
    const items = itemsMap[c.id] ?? [];
    setEditItems(items.length ? items.map(i => ({ ...i })) : [emptyItem()]);
    setItemsModal(c);
  };

  const saveItems = async () => {
    if (!itemsModal) return;
    setSavingItems(true);
    try {
      await client.put(`/projects/${projectId}/contracts/${itemsModal.id}/items`, editItems);
      await loadItems(itemsModal.id);
      setItemsModal(null);
    } finally { setSavingItems(false); }
  };

  const setItem = (idx: number, field: keyof ContractItem, val: string) => {
    setEditItems(items => items.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  };

  const addItem = () => setEditItems(items => [...items, emptyItem()]);
  const removeItem = (idx: number) => setEditItems(items => items.filter((_, i) => i !== idx));

  const fld = (field: keyof typeof form, val: string) => setForm(f => ({ ...f, [field]: val }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button style={btnPrimary('sm')} onClick={openNew}>+ Новый договор</button>
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: C.textMuted }}>Загрузка...</div>
      ) : contracts.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: C.textMuted }}>Нет договоров</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {contracts.map(c => (
            <div key={c.id} style={{ ...CARD, padding: 0 }}>
              {/* Contract row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', flexWrap: 'wrap' }}>
                <button style={btnGhost('sm')} onClick={() => toggleExpand(c.id)}>
                  {expanded[c.id] ? '▾' : '▸'}
                </button>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{c.contract_number}</span>
                <span style={{ fontSize: 13, color: C.textSec }}>{c.contractor_name}</span>
                {statusBadge(c.status)}
                <span style={{ fontSize: 12, color: C.textMuted }}>Аванс: {c.advance_pct}%</span>
                <span style={{ fontSize: 12, color: C.textMuted }}>Гарантия: {c.guarantee_pct}%</span>
                {c.signed_at && <span style={{ fontSize: 12, color: C.textMuted }}>Подписан: {fmt(c.signed_at)}</span>}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                  <button style={btnOutline('sm')} onClick={() => openEdit(c)}>Изменить</button>
                  <button style={btnDanger('sm')} onClick={() => deleteContract(c.id)}>✕</button>
                </div>
              </div>

              {/* Expanded items */}
              {expanded[c.id] && (
                <div style={{ borderTop: `1px solid ${C.border}`, padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>Позиции договора</span>
                    {c.status !== 'signed' && (
                      <button style={btnOutline('sm')} onClick={() => openItemsEditor(c)}>Редактировать позиции</button>
                    )}
                  </div>
                  {!itemsMap[c.id] ? (
                    <div style={{ color: C.textMuted, fontSize: 13 }}>Загрузка...</div>
                  ) : itemsMap[c.id].length === 0 ? (
                    <div style={{ color: C.textMuted, fontSize: 13 }}>Нет позиций</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={TH}>Наименование</th>
                            <th style={TH}>Ед.</th>
                            <th style={TH}>Кол-во</th>
                            <th style={TH}>Цена</th>
                            <th style={TH}>Сумма</th>
                            <th style={TH}>Примечание</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itemsMap[c.id].map((it, i) => (
                            <tr key={i}>
                              <td style={TD}>{it.name}</td>
                              <td style={TD}>{it.unit}</td>
                              <td style={TD}>{it.quantity}</td>
                              <td style={TD}>{num(it.unit_price).toLocaleString('ru-RU')}</td>
                              <td style={TD}>{(num(it.quantity) * num(it.unit_price)).toLocaleString('ru-RU')}</td>
                              <td style={{ ...TD, color: C.textSec, fontSize: 12 }}>{it.notes || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Contract modal */}
      {contractModal !== null && (
        <div style={OVERLAY} onClick={e => { if (e.target === e.currentTarget) setContractModal(null); }}>
          <div style={MODAL}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>
              {contractModal === 'new' ? 'Новый договор' : 'Редактировать договор'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={LBL}>
                Номер договора
                <input style={INPUT} value={form.contract_number} onChange={e => fld('contract_number', e.target.value)} />
              </label>
              <label style={LBL}>
                Подрядчик
                <select style={INPUT} value={form.contractor_id} onChange={e => fld('contractor_id', e.target.value)}>
                  <option value="">— Выберите —</option>
                  {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label style={LBL}>
                Статус
                <select style={INPUT} value={form.status} onChange={e => fld('status', e.target.value)}>
                  <option value="draft">Черновик</option>
                  <option value="approval">На согласовании</option>
                  <option value="signed">Подписан</option>
                </select>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={LBL}>
                  Аванс (%)
                  <input style={INPUT} type="number" min="0" max="100" value={form.advance_pct} onChange={e => fld('advance_pct', e.target.value)} />
                </label>
                <label style={LBL}>
                  Гарантия (%)
                  <input style={INPUT} type="number" min="0" max="100" value={form.guarantee_pct} onChange={e => fld('guarantee_pct', e.target.value)} />
                </label>
              </div>
              <label style={LBL}>
                Дата подписания
                <input style={INPUT} type="date" value={form.signed_at} onChange={e => fld('signed_at', e.target.value)} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={btnOutline()} onClick={() => setContractModal(null)}>Отмена</button>
              <button style={btnPrimary()} onClick={saveContract} disabled={saving}>
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Items editor modal */}
      {itemsModal && (
        <div style={OVERLAY} onClick={e => { if (e.target === e.currentTarget) setItemsModal(null); }}>
          <div style={{ ...MODAL, maxWidth: 800, width: '95%' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>
              Позиции — {itemsModal.contract_number}
            </h3>
            <div style={{ overflowX: 'auto', marginBottom: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={TH}>Наименование</th>
                    <th style={TH}>Ед.</th>
                    <th style={TH}>Кол-во</th>
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
                        <input style={{ ...INPUT, minWidth: 140 }} value={it.name} onChange={e => setItem(i, 'name', e.target.value)} />
                      </td>
                      <td style={TD}>
                        <input style={{ ...INPUT, width: 60 }} value={it.unit} onChange={e => setItem(i, 'unit', e.target.value)} />
                      </td>
                      <td style={TD}>
                        <input style={{ ...INPUT, width: 80 }} type="number" value={it.quantity} onChange={e => setItem(i, 'quantity', e.target.value)} />
                      </td>
                      <td style={TD}>
                        <input style={{ ...INPUT, width: 100 }} type="number" value={it.unit_price} onChange={e => setItem(i, 'unit_price', e.target.value)} />
                      </td>
                      <td style={{ ...TD, fontWeight: 500 }}>
                        {(num(it.quantity) * num(it.unit_price)).toLocaleString('ru-RU')}
                      </td>
                      <td style={TD}>
                        <input style={{ ...INPUT, minWidth: 100 }} value={it.notes} onChange={e => setItem(i, 'notes', e.target.value)} />
                      </td>
                      <td style={TD}>
                        <button style={btnDanger('sm')} onClick={() => removeItem(i)}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginBottom: 16 }}>
              <button style={btnOutline('sm')} onClick={addItem}>+ Добавить строку</button>
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
