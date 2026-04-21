import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import client from '../../api/client';
import { materialRequestsApi, catalogV2, type MaterialRequest, type MaterialRequestItem, type CatalogItemV2 } from '../../api/v2';
import { C, T, CARD, TH, TD, INPUT, LBL, OVERLAY, MODAL, btnPrimary, btnOutline, btnDanger, badge } from '../../ui';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик', submitted: 'Подана', approved: 'Одобрена',
  ordered: 'Заказана', delivered: 'Доставлена', cancelled: 'Отменена',
};
const STATUS_COLORS: Record<string, [string, string]> = {
  draft: [C.textMuted, C.surfaceAlt],
  submitted: [C.warning, C.warningBg],
  approved: [C.primary, C.primaryBg],
  ordered: ['#7c3aed', '#ede9fe'],
  delivered: [C.success, C.successBg],
  cancelled: [C.danger, C.dangerBg],
};
// Allowed transitions
const NEXT_STATUSES: Record<string, string[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['approved', 'cancelled'],
  approved: ['ordered', 'cancelled'],
  ordered: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

interface Project { id: string; name: string; }

export default function MaterialRequestsV2() {
  const [searchParams] = useSearchParams();
  const projectIdParam = searchParams.get('project_id') ?? '';

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(projectIdParam);
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [catalog, setCatalog] = useState<CatalogItemV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selected request detail
  const [selectedReq, setSelectedReq] = useState<MaterialRequest | null>(null);
  const [items, setItems] = useState<MaterialRequestItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  // Create request
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ project_id: projectIdParam, name: '' });
  const [creating, setCreating] = useState(false);

  // Add item
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemForm, setItemForm] = useState({ catalog_item_id: '', quantity_planned: '' });
  const [addingItem, setAddingItem] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [reqs, proj, cat] = await Promise.all([
        materialRequestsApi.list(projectId ? { project_id: projectId } : {}),
        client.get<Project[]>('/projects').then(r => r.data),
        catalogV2.list({ limit: 500 }),
      ]);
      setRequests(reqs);
      setProjects(proj);
      setCatalog(cat);
    } catch {
      setError('Ошибка загрузки заявок');
    } finally {
      setLoading(false);
    }
  }

  async function loadItems(req: MaterialRequest) {
    setSelectedReq(req);
    setItemsLoading(true);
    try {
      const its = await materialRequestsApi.items(req.id);
      setItems(its);
    } catch {
      setError('Ошибка загрузки позиций');
    } finally {
      setItemsLoading(false);
    }
  }

  useEffect(() => { load(); }, [projectId]);

  async function handleCreate() {
    if (!createForm.project_id || !createForm.name.trim()) return;
    setCreating(true);
    try {
      const req = await materialRequestsApi.create({ project_id: createForm.project_id, name: createForm.name.trim() });
      setShowCreate(false);
      setCreateForm(f => ({ ...f, name: '' }));
      await load();
      await loadItems(req);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? 'Ошибка создания заявки');
    } finally {
      setCreating(false);
    }
  }

  async function handleTransition(reqId: string, newStatus: string) {
    try {
      const updated = await materialRequestsApi.transition(reqId, newStatus);
      setRequests(rs => rs.map(r => r.id === reqId ? updated : r));
      if (selectedReq?.id === reqId) setSelectedReq(updated);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? 'Ошибка перехода статуса');
    }
  }

  async function handleAddItem() {
    if (!selectedReq || !itemForm.catalog_item_id || !itemForm.quantity_planned) return;
    setAddingItem(true);
    try {
      await materialRequestsApi.addItem(selectedReq.id, {
        catalog_item_id: itemForm.catalog_item_id,
        quantity_planned: parseFloat(itemForm.quantity_planned),
      });
      setShowAddItem(false);
      setItemForm({ catalog_item_id: '', quantity_planned: '' });
      const its = await materialRequestsApi.items(selectedReq.id);
      setItems(its);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? 'Ошибка добавления позиции');
    } finally {
      setAddingItem(false);
    }
  }

  const projectName = (id: string) => projects.find(p => p.id === id)?.name ?? id;
  const catalogItem = (id: string) => catalog.find(c => c.id === id);

  return (
    <div style={{ padding: '0 20px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={T.h1}>Заявки на материалы</h1>
        <button style={btnPrimary('md')} onClick={() => setShowCreate(true)}>+ Новая заявка</button>
      </div>

      {/* Filter */}
      <div style={{ ...CARD, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <label style={{ fontSize: 13, color: C.textSec, flexShrink: 0 }}>Проект:</label>
        <select style={{ ...INPUT, width: 300 }} value={projectId} onChange={e => setProjectId(e.target.value)}>
          <option value="">Все проекты</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {error && <span style={{ color: C.danger, fontSize: 13 }}>{error}</span>}
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Requests list */}
        <div style={{ ...CARD, width: 360, flexShrink: 0 }}>
          {loading ? (
            <div style={{ color: C.textSec, padding: 16 }}>Загрузка...</div>
          ) : requests.length === 0 ? (
            <div style={{ color: C.textMuted, padding: 16, textAlign: 'center' }}>Нет заявок</div>
          ) : (
            requests.map(req => {
              const [color, bg] = STATUS_COLORS[req.status] ?? [C.textMuted, C.surfaceAlt];
              const isSelected = selectedReq?.id === req.id;
              return (
                <div
                  key={req.id}
                  onClick={() => loadItems(req)}
                  style={{
                    padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 4,
                    background: isSelected ? C.primaryBg : 'transparent',
                    border: isSelected ? `1px solid ${C.primary}` : '1px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontWeight: isSelected ? 600 : 400, fontSize: 13 }}>{req.name}</div>
                    <span style={badge(color, bg)}>{STATUS_LABELS[req.status] ?? req.status}</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.textSec, marginTop: 3 }}>{projectName(req.project_id)}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{new Date(req.created_at).toLocaleDateString('ru-RU')}</div>
                </div>
              );
            })
          )}
        </div>

        {/* Request detail */}
        <div style={{ flex: 1 }}>
          {!selectedReq ? (
            <div style={{ color: C.textMuted, padding: 32, textAlign: 'center' }}>Выберите заявку</div>
          ) : (
            <>
              {/* Header */}
              <div style={{ ...CARD, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{selectedReq.name}</div>
                    <div style={{ fontSize: 12, color: C.textSec, marginTop: 2 }}>{projectName(selectedReq.project_id)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {NEXT_STATUSES[selectedReq.status]?.map(s => {
                      const [color, bg] = STATUS_COLORS[s] ?? [C.textMuted, C.surfaceAlt];
                      return (
                        <button
                          key={s}
                          style={{ ...btnOutline('sm'), color, borderColor: color }}
                          onClick={() => handleTransition(selectedReq.id, s)}
                        >
                          → {STATUS_LABELS[s]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Items */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Позиции заявки</span>
                {selectedReq.status === 'draft' && (
                  <button style={btnPrimary('sm')} onClick={() => setShowAddItem(true)}>+ Добавить позицию</button>
                )}
              </div>
              <div style={CARD}>
                {itemsLoading ? (
                  <div style={{ color: C.textSec, padding: 24 }}>Загрузка...</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={TH}>Материал</th>
                        <th style={TH}>Ед.</th>
                        <th style={{ ...TH, textAlign: 'right' }}>Запланировано</th>
                        <th style={{ ...TH, textAlign: 'right' }}>Доставлено</th>
                        <th style={TH}>Готовность</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.length === 0 && <tr><td colSpan={5} style={{ ...TD, color: C.textMuted, textAlign: 'center', padding: 32 }}>Нет позиций</td></tr>}
                      {items.map(item => {
                        const cat = catalogItem(item.catalog_item_id);
                        const pct = item.quantity_planned > 0 ? Math.min(100, (item.quantity_delivered / item.quantity_planned) * 100) : 0;
                        return (
                          <tr key={item.id}>
                            <td style={TD}>{cat?.name ?? item.catalog_item_id}</td>
                            <td style={TD}>{cat?.unit ?? '—'}</td>
                            <td style={{ ...TD, textAlign: 'right' }}>{item.quantity_planned}</td>
                            <td style={{ ...TD, textAlign: 'right' }}>{item.quantity_delivered}</td>
                            <td style={TD}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 60, height: 6, background: C.border, borderRadius: 4, overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? C.success : C.primary, borderRadius: 4 }} />
                                </div>
                                <span style={{ fontSize: 12, color: C.textSec }}>{pct.toFixed(0)}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create request modal */}
      {showCreate && (
        <div style={OVERLAY} onClick={() => setShowCreate(false)}>
          <div style={MODAL} onClick={e => e.stopPropagation()}>
            <h2 style={{ ...T.h2, marginBottom: 20 }}>Новая заявка на материалы</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={LBL}>
                Проект
                <select style={INPUT} value={createForm.project_id} onChange={e => setCreateForm(f => ({ ...f, project_id: e.target.value }))}>
                  <option value="">— выберите —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label style={LBL}>Название<input style={INPUT} value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} autoFocus /></label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={btnOutline('md')} onClick={() => setShowCreate(false)}>Отмена</button>
              <button style={btnPrimary('md')} disabled={creating} onClick={handleCreate}>{creating ? 'Создаю...' : 'Создать'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add item modal */}
      {showAddItem && (
        <div style={OVERLAY} onClick={() => setShowAddItem(false)}>
          <div style={MODAL} onClick={e => e.stopPropagation()}>
            <h2 style={{ ...T.h2, marginBottom: 20 }}>Добавить позицию</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={LBL}>
                Материал
                <select style={INPUT} value={itemForm.catalog_item_id} onChange={e => setItemForm(f => ({ ...f, catalog_item_id: e.target.value }))}>
                  <option value="">— выберите материал —</option>
                  {catalog.map(c => <option key={c.id} value={c.id}>{c.name} ({c.unit})</option>)}
                </select>
              </label>
              <label style={LBL}>Количество<input style={INPUT} type="number" value={itemForm.quantity_planned} onChange={e => setItemForm(f => ({ ...f, quantity_planned: e.target.value }))} min="0.001" step="0.001" /></label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={btnOutline('md')} onClick={() => setShowAddItem(false)}>Отмена</button>
              <button style={btnPrimary('md')} disabled={addingItem} onClick={handleAddItem}>{addingItem ? 'Добавляю...' : 'Добавить'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
