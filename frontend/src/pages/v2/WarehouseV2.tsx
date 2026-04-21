import { useEffect, useState } from 'react';
import { warehouseApi, catalogV2, type Warehouse, type StockItem, type StockMovement, type CatalogItemV2 } from '../../api/v2';
import client from '../../api/client';
import { C, T, CARD, TH, TD, INPUT, LBL, OVERLAY, MODAL, btnPrimary, btnOutline, btnDanger, badge } from '../../ui';

const MOVE_LABELS: Record<string, string> = {
  receipt: 'Приход', issue: 'Выдача', write_off: 'Списание', transfer: 'Перемещение',
};
const MOVE_COLORS: Record<string, [string, string]> = {
  receipt: [C.success, C.successBg],
  issue: [C.warning, C.warningBg],
  write_off: [C.danger, C.dangerBg],
  transfer: [C.primary, C.primaryBg],
};

const fmt = (n: number) => n.toLocaleString('ru-RU', { maximumFractionDigits: 3 });

interface Project { id: string; name: string; }

export default function WarehouseV2() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [catalog, setCatalog] = useState<CatalogItemV2[]>([]);
  const [selectedWh, setSelectedWh] = useState('');
  const [stock, setStock] = useState<StockItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [stockLoading, setStockLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'stock' | 'movements'>('stock');

  // Create warehouse
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', project_id: '', address: '' });
  const [creating, setCreating] = useState(false);

  // Add movement
  const [showMovement, setShowMovement] = useState(false);
  const [movForm, setMovForm] = useState({ catalog_item_id: '', movement_type: 'receipt', quantity: '', note: '' });
  const [addingMov, setAddingMov] = useState(false);

  async function loadInitial() {
    setLoading(true);
    try {
      const [whs, proj, cat] = await Promise.all([
        warehouseApi.list(),
        client.get<Project[]>('/projects').then(r => r.data),
        catalogV2.list({ limit: 500 }),
      ]);
      setWarehouses(whs);
      setProjects(proj);
      setCatalog(cat);
      if (whs.length > 0 && !selectedWh) {
        setSelectedWh(whs[0].id);
      }
    } catch {
      setError('Ошибка загрузки складов');
    } finally {
      setLoading(false);
    }
  }

  async function loadWarehouseData(whId: string) {
    if (!whId) return;
    setStockLoading(true);
    try {
      const [st, mv] = await Promise.all([
        warehouseApi.stock(whId),
        warehouseApi.movements(whId),
      ]);
      setStock(st);
      setMovements(mv);
    } catch {
      setError('Ошибка загрузки данных склада');
    } finally {
      setStockLoading(false);
    }
  }

  useEffect(() => { loadInitial(); }, []);
  useEffect(() => { if (selectedWh) loadWarehouseData(selectedWh); }, [selectedWh]);

  async function handleCreateWh() {
    if (!createForm.name.trim()) return;
    setCreating(true);
    try {
      const wh = await warehouseApi.create({
        name: createForm.name.trim(),
        project_id: createForm.project_id || undefined,
        address: createForm.address || undefined,
      });
      setWarehouses(ws => [...ws, wh]);
      setSelectedWh(wh.id);
      setShowCreate(false);
      setCreateForm({ name: '', project_id: '', address: '' });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? 'Ошибка создания склада');
    } finally {
      setCreating(false);
    }
  }

  async function handleAddMovement() {
    if (!selectedWh || !movForm.catalog_item_id || !movForm.quantity) { setError('Заполните все поля'); return; }
    setAddingMov(true);
    try {
      await warehouseApi.addMovement(selectedWh, {
        catalog_item_id: movForm.catalog_item_id,
        movement_type: movForm.movement_type,
        quantity: parseFloat(movForm.quantity),
        note: movForm.note || undefined,
      });
      setShowMovement(false);
      setMovForm({ catalog_item_id: '', movement_type: 'receipt', quantity: '', note: '' });
      await loadWarehouseData(selectedWh);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? 'Ошибка добавления движения');
    } finally {
      setAddingMov(false);
    }
  }

  const selectedWarehouse = warehouses.find(w => w.id === selectedWh);
  const projectName = (id?: string) => id ? (projects.find(p => p.id === id)?.name ?? id) : '—';
  const catalogName = (id: string) => catalog.find(c => c.id === id)?.name ?? id;
  const catalogUnit = (id: string) => catalog.find(c => c.id === id)?.unit ?? '';

  if (loading) return <div style={{ padding: 32, color: C.textSec }}>Загрузка...</div>;

  return (
    <div style={{ padding: '0 20px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={T.h1}>Склад</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btnPrimary('md')} onClick={() => setShowMovement(true)} disabled={!selectedWh}>+ Движение</button>
          <button style={btnOutline('md')} onClick={() => setShowCreate(true)}>+ Склад</button>
        </div>
      </div>

      {error && <div style={{ color: C.danger, marginBottom: 12, fontSize: 13 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Warehouses list */}
        <div style={{ ...CARD, width: 240, flexShrink: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: C.textSec }}>Склады</div>
          {warehouses.length === 0 && <div style={{ color: C.textMuted, fontSize: 13 }}>Нет складов</div>}
          {warehouses.map(wh => (
            <button
              key={wh.id}
              onClick={() => setSelectedWh(wh.id)}
              style={{
                width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', borderRadius: 8,
                cursor: 'pointer', fontSize: 13, marginBottom: 2,
                background: selectedWh === wh.id ? C.primaryBg : 'transparent',
                color: selectedWh === wh.id ? C.primary : C.text,
                fontWeight: selectedWh === wh.id ? 600 : 400,
              }}
            >
              <div>{wh.name}</div>
              {wh.project_id && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{projectName(wh.project_id)}</div>}
            </button>
          ))}
        </div>

        {/* Warehouse detail */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {!selectedWh ? (
            <div style={{ color: C.textMuted, padding: 32, textAlign: 'center' }}>Выберите склад</div>
          ) : (
            <>
              {/* Warehouse info */}
              <div style={{ ...CARD, marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{selectedWarehouse?.name}</div>
                  {selectedWarehouse?.project_id && <div style={{ fontSize: 12, color: C.textSec, marginTop: 2 }}>Проект: {projectName(selectedWarehouse.project_id)}</div>}
                </div>
                {/* Summary */}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{stock.length}</div>
                    <div style={{ fontSize: 11, color: C.textSec }}>позиций</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{movements.length}</div>
                    <div style={{ fontSize: 11, color: C.textSec }}>движений</div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
                {(['stock', 'movements'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    style={{
                      padding: '9px 18px', border: 'none',
                      borderBottom: t === tab ? `2px solid ${C.primary}` : '2px solid transparent',
                      background: 'transparent', fontWeight: t === tab ? 600 : 400,
                      color: t === tab ? C.primary : C.textSec, cursor: 'pointer', fontSize: 13,
                    }}
                  >
                    {t === 'stock' ? 'Остатки' : 'Движения'}
                  </button>
                ))}
              </div>

              {stockLoading ? (
                <div style={{ color: C.textSec, padding: 24 }}>Загрузка...</div>
              ) : tab === 'stock' ? (
                <div style={CARD}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={TH}>Материал</th>
                        <th style={{ ...TH, textAlign: 'right' }}>На складе</th>
                        <th style={{ ...TH, textAlign: 'right' }}>В резерве</th>
                        <th style={{ ...TH, textAlign: 'right' }}>Доступно</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stock.length === 0 && <tr><td colSpan={4} style={{ ...TD, color: C.textMuted, textAlign: 'center', padding: 32 }}>Склад пуст</td></tr>}
                      {stock.map(item => (
                        <tr key={item.catalog_item_id}
                          onMouseEnter={e => (e.currentTarget.style.background = C.surfaceHover)}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}
                        >
                          <td style={TD}>
                            <div>{item.catalog_item_name}</div>
                          </td>
                          <td style={{ ...TD, textAlign: 'right' }}>
                            {fmt(item.quantity_on_hand)} {item.unit}
                          </td>
                          <td style={{ ...TD, textAlign: 'right', color: item.quantity_reserved > 0 ? C.warning : C.textSec }}>
                            {fmt(item.quantity_reserved)} {item.unit}
                          </td>
                          <td style={{ ...TD, textAlign: 'right', fontWeight: 600, color: item.quantity_available <= 0 ? C.danger : C.success }}>
                            {fmt(item.quantity_available)} {item.unit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={CARD}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={TH}>Материал</th>
                        <th style={TH}>Тип</th>
                        <th style={{ ...TH, textAlign: 'right' }}>Количество</th>
                        <th style={TH}>Примечание</th>
                        <th style={TH}>Дата</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.length === 0 && <tr><td colSpan={5} style={{ ...TD, color: C.textMuted, textAlign: 'center', padding: 32 }}>Нет движений</td></tr>}
                      {movements.map(mv => {
                        const [color, bg] = MOVE_COLORS[mv.movement_type] ?? [C.textMuted, C.surfaceAlt];
                        return (
                          <tr key={mv.id}>
                            <td style={TD}>{mv.catalog_item_name ?? catalogName(mv.catalog_item_id)}</td>
                            <td style={TD}><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 500, background: bg, color }}>{MOVE_LABELS[mv.movement_type] ?? mv.movement_type}</span></td>
                            <td style={{ ...TD, textAlign: 'right', fontWeight: 600 }}>
                              {mv.movement_type === 'issue' || mv.movement_type === 'write_off' ? '−' : '+'}
                              {fmt(mv.quantity)}
                            </td>
                            <td style={{ ...TD, color: C.textSec }}>{mv.note ?? '—'}</td>
                            <td style={{ ...TD, color: C.textSec }}>{new Date(mv.created_at).toLocaleDateString('ru-RU')}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Create warehouse modal */}
      {showCreate && (
        <div style={OVERLAY} onClick={() => setShowCreate(false)}>
          <div style={MODAL} onClick={e => e.stopPropagation()}>
            <h2 style={{ ...T.h2, marginBottom: 20 }}>Новый склад</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={LBL}>Название<input style={INPUT} value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} autoFocus /></label>
              <label style={LBL}>Адрес<input style={INPUT} value={createForm.address} onChange={e => setCreateForm(f => ({ ...f, address: e.target.value }))} placeholder="Необязательно" /></label>
              <label style={LBL}>
                Проект (необязательно)
                <select style={INPUT} value={createForm.project_id} onChange={e => setCreateForm(f => ({ ...f, project_id: e.target.value }))}>
                  <option value="">— без проекта —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={btnOutline('md')} onClick={() => setShowCreate(false)}>Отмена</button>
              <button style={btnPrimary('md')} disabled={creating} onClick={handleCreateWh}>{creating ? 'Создаю...' : 'Создать'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add movement modal */}
      {showMovement && (
        <div style={OVERLAY} onClick={() => setShowMovement(false)}>
          <div style={MODAL} onClick={e => e.stopPropagation()}>
            <h2 style={{ ...T.h2, marginBottom: 20 }}>Движение материала</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={LBL}>
                Тип движения
                <select style={INPUT} value={movForm.movement_type} onChange={e => setMovForm(f => ({ ...f, movement_type: e.target.value }))}>
                  <option value="receipt">Приход</option>
                  <option value="issue">Выдача</option>
                  <option value="write_off">Списание</option>
                </select>
              </label>
              <label style={LBL}>
                Материал
                <select style={INPUT} value={movForm.catalog_item_id} onChange={e => setMovForm(f => ({ ...f, catalog_item_id: e.target.value }))}>
                  <option value="">— выберите материал —</option>
                  {catalog.map(c => <option key={c.id} value={c.id}>{c.name} ({c.unit})</option>)}
                </select>
              </label>
              <label style={LBL}>Количество<input style={INPUT} type="number" value={movForm.quantity} onChange={e => setMovForm(f => ({ ...f, quantity: e.target.value }))} min="0.001" step="0.001" /></label>
              <label style={LBL}>Примечание<input style={INPUT} value={movForm.note} onChange={e => setMovForm(f => ({ ...f, note: e.target.value }))} placeholder="Необязательно" /></label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={btnOutline('md')} onClick={() => setShowMovement(false)}>Отмена</button>
              <button style={btnPrimary('md')} disabled={addingMov} onClick={handleAddMovement}>{addingMov ? 'Добавляю...' : 'Добавить'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
