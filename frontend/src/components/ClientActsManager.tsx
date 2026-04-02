import { useCallback, useEffect, useState } from 'react';
import client from '../api/client';
import {
  C, CARD, INPUT, LBL, MODAL, OVERLAY, TD, TH,
  badge, btnDanger, btnGhost, btnOutline, btnPrimary,
} from '../ui';

interface Contractor { id: string; name: string }

interface Act {
  id: string;
  act_number: string;
  status: 'draft' | 'sent' | 'revision' | 'signed' | 'cancelled';
  total_amount: number;
  period_start: string;
  period_end: string;
  contractor_id: string;
  contractor_name: string;
}

interface ActItem {
  id?: string;
  estimate_item_id: string;
  name: string;
  unit: string;
  total_qty: number;
  already_actioned: number;
  remaining: number;
  quantity_presented: number | string;
  unit_price: number | string;
}

interface SummaryItem {
  estimate_item_id: string;
  name: string;
  unit: string;
  quantity_total: number;
  quantity_actioned: number;
  quantity_remaining: number;
  pct_actioned: number;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик', sent: 'Отправлен', revision: 'На доработке', signed: 'Подписан', cancelled: 'Отменён',
};

function statusBadge(s: string) {
  const map: Record<string, [string, string]> = {
    draft: [C.textMuted, '#f1f5f9'],
    sent: [C.primary, C.primaryBg],
    revision: [C.warning, C.warningBg],
    signed: [C.success, C.successBg],
    cancelled: [C.danger, C.dangerBg],
  };
  const [color, bg] = map[s] ?? [C.textMuted, '#f1f5f9'];
  return <span style={badge(color, bg)}>{STATUS_LABELS[s] ?? s}</span>;
}

function fmt(d: string) { return d ? new Date(d).toLocaleDateString('ru-RU') : '—' }
function pct(a: number, b: number) { return b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0 }

export default function ClientActsManager({ projectId }: { projectId: string }) {
  const [tab, setTab] = useState<'acts' | 'summary'>('acts');
  const [acts, setActs] = useState<Act[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [itemsMap, setItemsMap] = useState<Record<string, ActItem[]>>({});
  const [loading, setLoading] = useState(false);

  // new act modal
  const [actModal, setActModal] = useState(false);
  const [actForm, setActForm] = useState({ act_number: '', contractor_id: '', period_start: '', period_end: '' });
  const [savingAct, setSavingAct] = useState(false);

  // items editor modal
  const [itemsModal, setItemsModal] = useState<Act | null>(null);
  const [editItems, setEditItems] = useState<ActItem[]>([]);
  const [savingItems, setSavingItems] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      client.get(`/projects/${projectId}/client-acts`),
      client.get('/contractors'),
    ]).then(([actsR, contrR]) => {
      setActs(actsR.data);
      setContractors(contrR.data);
    }).finally(() => setLoading(false));
  }, [projectId]);

  const loadSummary = useCallback(() => {
    client.get(`/projects/${projectId}/actioning-summary`).then(r => setSummary(r.data));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === 'summary') loadSummary(); }, [tab, loadSummary]);

  const loadActItems = async (actId: string) => {
    const r = await client.get(`/projects/${projectId}/client-acts/${actId}/items`);
    setItemsMap(m => ({ ...m, [actId]: r.data }));
  };

  const toggleExpand = (id: string) => {
    setExpanded(e => {
      const open = !e[id];
      if (open && !itemsMap[id]) loadActItems(id);
      return { ...e, [id]: open };
    });
  };

  const saveAct = async () => {
    setSavingAct(true);
    try {
      await client.post(`/projects/${projectId}/client-acts`, actForm);
      setActModal(false);
      load();
    } finally { setSavingAct(false); }
  };

  const updateStatus = async (act: Act, status: string) => {
    await client.patch(`/projects/${projectId}/client-acts/${act.id}`, { status });
    load();
  };

  const deleteAct = async (id: string) => {
    if (!confirm('Удалить акт?')) return;
    await client.delete(`/projects/${projectId}/client-acts/${id}`);
    load();
  };

  const openItemsEditor = async (act: Act) => {
    const r = await client.get(`/projects/${projectId}/actioning-summary`);
    const summaryItems: SummaryItem[] = r.data;
    const existing: ActItem[] = itemsMap[act.id] ?? [];
    const items: ActItem[] = summaryItems.map(si => {
      const ex = existing.find(e => e.estimate_item_id === si.estimate_item_id);
      return {
        estimate_item_id: si.estimate_item_id,
        name: si.name,
        unit: si.unit,
        total_qty: si.quantity_total,
        already_actioned: si.quantity_actioned - (ex ? Number(ex.quantity_presented) : 0),
        remaining: si.quantity_remaining + (ex ? Number(ex.quantity_presented) : 0),
        quantity_presented: ex ? ex.quantity_presented : 0,
        unit_price: ex ? ex.unit_price : 0,
      };
    });
    setEditItems(items);
    setItemsModal(act);
  };

  const saveItems = async () => {
    if (!itemsModal) return;
    setSavingItems(true);
    try {
      const payload = editItems
        .filter(it => Number(it.quantity_presented) > 0)
        .map(it => ({
          estimate_item_id: it.estimate_item_id,
          quantity_presented: Number(it.quantity_presented),
          unit_price: Number(it.unit_price),
        }));
      await client.put(`/projects/${projectId}/client-acts/${itemsModal.id}/items`, payload);
      await loadActItems(itemsModal.id);
      setItemsModal(null);
    } finally { setSavingItems(false); }
  };

  const setItemField = (idx: number, field: 'quantity_presented' | 'unit_price', val: string) => {
    setEditItems(items => items.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  };

  const tabStyle = (active: boolean) => ({
    ...btnOutline('sm'),
    background: active ? C.primary : C.surface,
    color: active ? '#fff' : C.text,
    border: `1px solid ${active ? C.primary : C.border}`,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2 }}>
        <button style={tabStyle(tab === 'acts')} onClick={() => setTab('acts')}>Акты КС-2</button>
        <button style={tabStyle(tab === 'summary')} onClick={() => setTab('summary')}>Прогресс актирования</button>
      </div>

      {tab === 'acts' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button style={btnPrimary('sm')} onClick={() => setActModal(true)}>+ Новый акт</button>
          </div>

          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: C.textMuted }}>Загрузка...</div>
          ) : acts.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: C.textMuted }}>Нет актов</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {acts.map(act => (
                <div key={act.id} style={{ ...CARD, padding: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', flexWrap: 'wrap' }}>
                    <button style={btnGhost('sm')} onClick={() => toggleExpand(act.id)}>
                      {expanded[act.id] ? '▾' : '▸'}
                    </button>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>№ {act.act_number}</span>
                    {statusBadge(act.status)}
                    <span style={{ fontSize: 13, color: C.textSec }}>{act.contractor_name}</span>
                    <span style={{ fontSize: 12, color: C.textMuted }}>
                      {fmt(act.period_start)} – {fmt(act.period_end)}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      {act.total_amount?.toLocaleString('ru-RU')} ₽
                    </span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button style={btnOutline('sm')} onClick={() => openItemsEditor(act)}>Позиции</button>
                      {act.status === 'draft' && (
                        <button style={btnOutline('sm')} onClick={() => updateStatus(act, 'sent')}>Отправить</button>
                      )}
                      {act.status === 'sent' && (
                        <>
                          <button style={btnOutline('sm')} onClick={() => updateStatus(act, 'signed')}>Подписать</button>
                          <button style={btnOutline('sm')} onClick={() => updateStatus(act, 'revision')}>На доработку</button>
                        </>
                      )}
                      {act.status === 'revision' && (
                        <button style={btnOutline('sm')} onClick={() => updateStatus(act, 'sent')}>Повторно отправить</button>
                      )}
                      {act.status === 'draft' && (
                        <button style={btnDanger('sm')} onClick={() => deleteAct(act.id)}>✕</button>
                      )}
                      {act.status === 'signed' && (
                        <a
                          href={`${import.meta.env.VITE_API_BASE_URL || ''}/projects/${projectId}/client-acts/${act.id}/export-ks2`}
                          target="_blank"
                          rel="noreferrer"
                          style={btnOutline('sm')}
                        >
                          📄 КС-2
                        </a>
                      )}
                    </div>
                  </div>

                  {expanded[act.id] && (
                    <div style={{ borderTop: `1px solid ${C.border}`, padding: '12px 16px' }}>
                      {!itemsMap[act.id] ? (
                        <div style={{ color: C.textMuted, fontSize: 13 }}>Загрузка...</div>
                      ) : itemsMap[act.id].length === 0 ? (
                        <div style={{ color: C.textMuted, fontSize: 13 }}>Нет позиций</div>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                          <colgroup>
                            <col />
                            <col style={{ width: 52 }} />
                            <col style={{ width: 80 }} />
                            <col style={{ width: 100 }} />
                            <col style={{ width: 110 }} />
                          </colgroup>
                          <thead>
                            <tr>
                              <th style={TH}>Наименование</th>
                              <th style={TH}>Ед.</th>
                              <th style={TH}>Кол-во</th>
                              <th style={TH}>Цена</th>
                              <th style={TH}>Сумма</th>
                            </tr>
                          </thead>
                          <tbody>
                            {itemsMap[act.id].map((it, i) => (
                              <tr key={i}>
                                <td style={TD}>{it.name}</td>
                                <td style={TD}>{it.unit}</td>
                                <td style={TD}>{it.quantity_presented}</td>
                                <td style={TD}>{Number(it.unit_price).toLocaleString('ru-RU')}</td>
                                <td style={TD}>{(Number(it.quantity_presented) * Number(it.unit_price)).toLocaleString('ru-RU')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'summary' && (
        <div style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col />
              <col style={{ width: 52 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 140 }} />
            </colgroup>
            <thead>
              <tr>
                <th style={TH}>Наименование</th>
                <th style={TH}>Ед.</th>
                <th style={TH}>По смете</th>
                <th style={TH}>Актировано</th>
                <th style={TH}>Остаток</th>
                <th style={TH}>%</th>
              </tr>
            </thead>
            <tbody>
              {summary.map(it => {
                const p = pct(it.quantity_actioned, it.quantity_total);
                return (
                  <tr key={it.estimate_item_id}>
                    <td style={TD}>{it.name}</td>
                    <td style={TD}>{it.unit}</td>
                    <td style={TD}>{it.quantity_total}</td>
                    <td style={TD}>{it.quantity_actioned}</td>
                    <td style={{ ...TD, color: it.quantity_remaining < 0 ? C.danger : C.text }}>{it.quantity_remaining}</td>
                    <td style={TD}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 8, background: C.border, borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${p}%`, background: p >= 100 ? C.success : C.primary, borderRadius: 4 }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 500, minWidth: 32, textAlign: 'right' }}>{p}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {summary.length === 0 && (
                <tr><td colSpan={6} style={{ ...TD, textAlign: 'center', color: C.textMuted }}>Нет данных</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* New Act Modal */}
      {actModal && (
        <div style={OVERLAY} onClick={e => { if (e.target === e.currentTarget) setActModal(false); }}>
          <div style={{ ...MODAL, maxWidth: 440 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>Новый акт КС-2</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={LBL}>
                Номер акта
                <input style={INPUT} value={actForm.act_number} onChange={e => setActForm(f => ({ ...f, act_number: e.target.value }))} />
              </label>
              <label style={LBL}>
                Заказчик / подрядчик
                <select style={INPUT} value={actForm.contractor_id} onChange={e => setActForm(f => ({ ...f, contractor_id: e.target.value }))}>
                  <option value="">— Выберите —</option>
                  {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={LBL}>
                  Период с
                  <input style={INPUT} type="date" value={actForm.period_start} onChange={e => setActForm(f => ({ ...f, period_start: e.target.value }))} />
                </label>
                <label style={LBL}>
                  Период по
                  <input style={INPUT} type="date" value={actForm.period_end} onChange={e => setActForm(f => ({ ...f, period_end: e.target.value }))} />
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={btnOutline()} onClick={() => setActModal(false)}>Отмена</button>
              <button style={btnPrimary()} onClick={saveAct} disabled={savingAct}>
                {savingAct ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Items editor modal */}
      {itemsModal && (
        <div style={OVERLAY} onClick={e => { if (e.target === e.currentTarget) setItemsModal(null); }}>
          <div style={{ ...MODAL, maxWidth: 900, width: '95%' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>
              Позиции акта № {itemsModal.act_number}
            </h3>
            <div style={{ marginBottom: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>
                  <col />
                  <col style={{ width: 52 }} />
                  <col style={{ width: 80 }} />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 80 }} />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 90 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={TH}>Наименование</th>
                    <th style={TH}>Ед.</th>
                    <th style={TH}>По смете</th>
                    <th style={TH}>Уже актировано</th>
                    <th style={TH}>Остаток</th>
                    <th style={TH}>Предъявляю</th>
                    <th style={TH}>Цена</th>
                  </tr>
                </thead>
                <tbody>
                  {editItems.map((it, i) => {
                    const qty = Number(it.quantity_presented) || 0;
                    const over = qty > it.remaining;
                    return (
                      <tr key={i}>
                        <td style={TD}>{it.name}</td>
                        <td style={TD}>{it.unit}</td>
                        <td style={TD}>{it.total_qty}</td>
                        <td style={TD}>{it.already_actioned}</td>
                        <td style={{ ...TD, color: over ? C.danger : C.text, fontWeight: over ? 600 : 400 }}>
                          {it.remaining}
                        </td>
                        <td style={TD}>
                          <input
                            type="number"
                            style={{ ...INPUT, width: 90, borderColor: over ? C.danger : C.border }}
                            value={it.quantity_presented}
                            onChange={e => setItemField(i, 'quantity_presented', e.target.value)}
                          />
                          {over && <div style={{ fontSize: 11, color: C.danger }}>Превышает остаток</div>}
                        </td>
                        <td style={TD}>
                          <input
                            type="number"
                            style={{ ...INPUT, width: 100 }}
                            value={it.unit_price}
                            onChange={e => setItemField(i, 'unit_price', e.target.value)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
