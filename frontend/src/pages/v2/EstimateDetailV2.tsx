import { extractDetail } from '../../api/client';
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { estimatesV2, type EstimateV2, type EstimatePosition, type EstimateSummary } from '../../api/v2';
import { C, T, CARD, TH, TD, INPUT, LBL, OVERLAY, MODAL, btnPrimary, btnOutline, btnDanger, btnGhost, badge } from '../../ui';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик', internal: 'Внутренняя', to_client: 'Клиенту', signed: 'Подписана',
};
const STATUS_NEXT: Record<string, string[]> = {
  draft: ['internal'],
  internal: ['to_client', 'draft'],
  to_client: ['signed', 'internal'],
  signed: [],
};

type Tab = 'positions' | 'summary' | 'compare';

const fmt = (n?: number) => n == null ? '—' : n.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
const pct = (n?: number) => n == null ? '—' : `${n.toFixed(1)}%`;

export default function EstimateDetailV2() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [estimate, setEstimate] = useState<EstimateV2 | null>(null);
  const [positions, setPositions] = useState<EstimatePosition[]>([]);
  const [summary, setSummary] = useState<EstimateSummary | null>(null);
  const [branches, setBranches] = useState<EstimateV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('positions');

  // Position edit
  const [editPos, setEditPos] = useState<EstimatePosition | null>(null);
  const [posForm, setPosForm] = useState<Partial<EstimatePosition>>({});
  const [savingPos, setSavingPos] = useState(false);

  // Add position
  const [showAddPos, setShowAddPos] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', unit: 'шт', quantity: '1', client_price: '', cost_price: '' });
  const [addingPos, setAddingPos] = useState(false);

  // Status change
  const [changingStatus, setChangingStatus] = useState(false);

  // Branch
  const [showBranch, setShowBranch] = useState(false);
  const [branchLabel, setBranchLabel] = useState('');
  const [branching, setBranching] = useState(false);

  // Cost calc
  const [showCalc, setShowCalc] = useState(false);
  const [calcForm, setCalcForm] = useState({ overhead_pct: '15', profit_pct: '10' });
  const [calculating, setCalculating] = useState(false);

  // Compare
  const [compareId, setCompareId] = useState('');
  const [compareResult, setCompareResult] = useState<{ only_in_a: EstimatePosition[]; only_in_b: EstimatePosition[]; changed: { a: EstimatePosition; b: EstimatePosition; diff_fields: string[] }[]; unchanged_count: number } | null>(null);
  const [comparing, setComparing] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [est, pos, sum] = await Promise.all([
        estimatesV2.get(id),
        estimatesV2.positions(id),
        estimatesV2.summary(id),
      ]);
      setEstimate(est);
      setPositions(pos);
      setSummary(sum);
      // Load all estimates in same project to find branches
      const all = await estimatesV2.list({ project_id: est.project_id });
      setBranches(all.filter(e => e.id !== id && (e.parent_id === id || e.parent_id === est.parent_id)));
    } catch {
      setError('Ошибка загрузки сметы');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function handleStatus(status: string) {
    if (!id) return;
    setChangingStatus(true);
    try {
      const updated = await estimatesV2.setStatus(id, status);
      setEstimate(updated);
    } catch (e: unknown) {
            setError(extractDetail(e, 'Ошибка смены статуса'));
    } finally {
      setChangingStatus(false);
    }
  }

  async function handleCalcCost() {
    if (!id) return;
    setCalculating(true);
    try {
      await estimatesV2.calculateCost(id, {
        overhead_pct: parseFloat(calcForm.overhead_pct),
        profit_pct: parseFloat(calcForm.profit_pct),
      });
      setShowCalc(false);
      await load();
    } catch (e: unknown) {
            setError(extractDetail(e, 'Ошибка расчёта'));
    } finally {
      setCalculating(false);
    }
  }

  async function handleBranch() {
    if (!id) return;
    setBranching(true);
    try {
      const br = await estimatesV2.branch(id, branchLabel || undefined);
      setShowBranch(false);
      navigate(`/v2/estimates/${br.id}`);
    } catch {
      setError('Ошибка ветвления');
    } finally {
      setBranching(false);
    }
  }

  async function handleCompare() {
    if (!id || !compareId) return;
    setComparing(true);
    try {
      const r = await estimatesV2.compare(id, compareId);
      setCompareResult(r);
    } catch {
      setError('Ошибка сравнения');
    } finally {
      setComparing(false);
    }
  }

  async function handleSavePos() {
    if (!id || !editPos) return;
    setSavingPos(true);
    try {
      await estimatesV2.updatePosition(id, editPos.id, posForm);
      setEditPos(null);
      await load();
    } catch {
      setError('Ошибка сохранения позиции');
    } finally {
      setSavingPos(false);
    }
  }

  async function handleAddPos() {
    if (!id || !addForm.name.trim()) return;
    setAddingPos(true);
    try {
      await estimatesV2.addPosition(id, {
        name: addForm.name,
        unit: addForm.unit,
        quantity: parseFloat(addForm.quantity) || 1,
        client_price: addForm.client_price ? parseFloat(addForm.client_price) : undefined,
        cost_price: addForm.cost_price ? parseFloat(addForm.cost_price) : undefined,
      });
      setShowAddPos(false);
      setAddForm({ name: '', unit: 'шт', quantity: '1', client_price: '', cost_price: '' });
      await load();
    } catch {
      setError('Ошибка добавления позиции');
    } finally {
      setAddingPos(false);
    }
  }

  async function handleDeletePos(posId: string) {
    if (!id || !confirm('Удалить позицию?')) return;
    try {
      await estimatesV2.deletePosition(id, posId);
      await load();
    } catch {
      setError('Ошибка удаления позиции');
    }
  }

  if (loading) return <div style={{ padding: 32, color: C.textSec }}>Загрузка...</div>;
  if (error && !estimate) return <div style={{ padding: 32, color: C.danger }}>{error}</div>;
  if (!estimate) return null;

  const nextStatuses = STATUS_NEXT[estimate.status] ?? [];

  return (
    <div style={{ padding: '0 20px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <button style={{ ...btnGhost('sm'), marginTop: 4 }} onClick={() => navigate(-1)}>← Назад</button>
        <div style={{ flex: 1 }}>
          <h1 style={T.h1}>{estimate.name}</h1>
          <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={badge('#fff', C.primary)}>{STATUS_LABELS[estimate.status] ?? estimate.status}</span>
            <span style={{ fontSize: 12, color: C.textMuted }}>v{estimate.version}</span>
            {estimate.branch_label && <span style={{ fontSize: 12, color: C.textSec }}>ветка: {estimate.branch_label}</span>}
            {error && <span style={{ color: C.danger, fontSize: 12 }}>{error}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {nextStatuses.map(s => (
            <button key={s} style={btnOutline('sm')} disabled={changingStatus} onClick={() => handleStatus(s)}>
              → {STATUS_LABELS[s] ?? s}
            </button>
          ))}
          <button style={btnOutline('sm')} onClick={() => setShowCalc(true)}>Рассчитать себестоимость</button>
          <button style={btnOutline('sm')} onClick={() => setShowBranch(true)}>Создать ветку</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
        {(['positions', 'summary', 'compare'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '9px 18px', border: 'none', borderBottom: t === tab ? `2px solid ${C.primary}` : '2px solid transparent',
              background: 'transparent', fontWeight: t === tab ? 600 : 400, color: t === tab ? C.primary : C.textSec,
              cursor: 'pointer', fontSize: 13,
            }}
          >
            {t === 'positions' ? 'Позиции' : t === 'summary' ? 'Итоги' : 'Сравнение'}
          </button>
        ))}
      </div>

      {/* Positions tab */}
      {tab === 'positions' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <button style={btnPrimary('sm')} onClick={() => setShowAddPos(true)}>+ Добавить позицию</button>
          </div>
          <div style={CARD}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>Наименование</th>
                  <th style={TH}>Ед.</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Кол-во</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Клиент (₽)</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Себест. (₽)</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Субподряд (₽)</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Факт (₽)</th>
                  <th style={TH}>Ревью</th>
                  <th style={{ ...TH, width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {positions.length === 0 && (
                  <tr><td colSpan={9} style={{ ...TD, color: C.textMuted, textAlign: 'center', padding: 32 }}>Нет позиций</td></tr>
                )}
                {positions.map(pos => (
                  <tr
                    key={pos.id}
                    style={{ background: pos.needs_review ? C.warningBg : undefined }}
                  >
                    <td style={{ ...TD, maxWidth: 280 }}>{pos.name}</td>
                    <td style={TD}>{pos.unit}</td>
                    <td style={{ ...TD, textAlign: 'right' }}>{pos.quantity}</td>
                    <td style={{ ...TD, textAlign: 'right' }}>{fmt(pos.client_price)}</td>
                    <td style={{ ...TD, textAlign: 'right' }}>{fmt(pos.cost_price)}</td>
                    <td style={{ ...TD, textAlign: 'right' }}>{fmt(pos.subcontract_price)}</td>
                    <td style={{ ...TD, textAlign: 'right' }}>{fmt(pos.actual_price)}</td>
                    <td style={TD}>
                      {pos.needs_review && <span style={{ color: C.warning, fontSize: 12 }}>⚠ Ревью</span>}
                    </td>
                    <td style={TD}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button style={btnOutline('sm')} onClick={() => { setEditPos(pos); setPosForm({ name: pos.name, unit: pos.unit, quantity: pos.quantity, client_price: pos.client_price, cost_price: pos.cost_price, subcontract_price: pos.subcontract_price, actual_price: pos.actual_price }); }}>✏</button>
                        <button style={btnDanger('sm')} onClick={() => handleDeletePos(pos.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary tab */}
      {tab === 'summary' && summary && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Позиций', val: summary.positions_count },
              { label: 'На ревью', val: summary.needs_review_count },
              { label: 'Маржа', val: pct(summary.margin_pct) },
            ].map(({ label, val }) => (
              <div key={label} style={{ ...CARD, minWidth: 140, flex: 1 }}>
                <div style={{ fontSize: 12, color: C.textSec, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={CARD}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>Слой цен</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Работы (₽)</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Материалы (₽)</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Итого (₽)</th>
                </tr>
              </thead>
              <tbody>
                {(['client', 'cost', 'subcontract', 'actual'] as const).map(layer => {
                  const t = summary.totals[layer];
                  const labels = { client: 'Клиентская', cost: 'Себестоимость', subcontract: 'Субподряд', actual: 'Факт' };
                  return (
                    <tr key={layer}>
                      <td style={TD}>{labels[layer]}</td>
                      <td style={{ ...TD, textAlign: 'right' }}>{fmt(t.work)}</td>
                      <td style={{ ...TD, textAlign: 'right' }}>{fmt(t.material)}</td>
                      <td style={{ ...TD, textAlign: 'right', fontWeight: 600 }}>{fmt(t.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Compare tab */}
      {tab === 'compare' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-end' }}>
            <label style={{ ...LBL, flex: 1, maxWidth: 360 }}>
              Сравнить с веткой
              <select value={compareId} onChange={e => setCompareId(e.target.value)} style={INPUT}>
                <option value="">— выберите смету —</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name} {b.branch_label ? `(${b.branch_label})` : ''}</option>
                ))}
              </select>
            </label>
            <button style={btnPrimary('md')} disabled={!compareId || comparing} onClick={handleCompare}>
              {comparing ? 'Сравниваю...' : 'Сравнить'}
            </button>
          </div>
          {compareResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={badge(C.success, C.successBg)}>Без изменений: {compareResult.unchanged_count}</span>
                <span style={badge(C.warning, C.warningBg)}>Изменено: {compareResult.changed.length}</span>
                <span style={badge(C.danger, C.dangerBg)}>Только в A: {compareResult.only_in_a.length}</span>
                <span style={badge(C.primary, C.primaryBg)}>Только в B: {compareResult.only_in_b.length}</span>
              </div>
              {compareResult.changed.length > 0 && (
                <div style={CARD}>
                  <div style={{ fontWeight: 600, marginBottom: 10 }}>Изменённые позиции</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={TH}>Позиция</th>
                        <th style={TH}>Изменённые поля</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compareResult.changed.map(({ a, diff_fields }) => (
                        <tr key={a.id}>
                          <td style={TD}>{a.name}</td>
                          <td style={{ ...TD, color: C.warning }}>{diff_fields.join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Edit position modal */}
      {editPos && (
        <div style={OVERLAY} onClick={() => setEditPos(null)}>
          <div style={{ ...MODAL, maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ ...T.h2, marginBottom: 20 }}>Редактировать позицию</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={LBL}>Наименование<input style={INPUT} value={posForm.name ?? ''} onChange={e => setPosForm(f => ({ ...f, name: e.target.value }))} /></label>
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ ...LBL, flex: 1 }}>Ед. изм.<input style={INPUT} value={posForm.unit ?? ''} onChange={e => setPosForm(f => ({ ...f, unit: e.target.value }))} /></label>
                <label style={{ ...LBL, flex: 1 }}>Количество<input style={INPUT} type="number" value={posForm.quantity ?? ''} onChange={e => setPosForm(f => ({ ...f, quantity: parseFloat(e.target.value) }))} /></label>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ ...LBL, flex: 1 }}>Клиент (₽)<input style={INPUT} type="number" value={posForm.client_price ?? ''} onChange={e => setPosForm(f => ({ ...f, client_price: e.target.value ? parseFloat(e.target.value) : undefined }))} /></label>
                <label style={{ ...LBL, flex: 1 }}>Себест. (₽)<input style={INPUT} type="number" value={posForm.cost_price ?? ''} onChange={e => setPosForm(f => ({ ...f, cost_price: e.target.value ? parseFloat(e.target.value) : undefined }))} /></label>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ ...LBL, flex: 1 }}>Субподряд (₽)<input style={INPUT} type="number" value={posForm.subcontract_price ?? ''} onChange={e => setPosForm(f => ({ ...f, subcontract_price: e.target.value ? parseFloat(e.target.value) : undefined }))} /></label>
                <label style={{ ...LBL, flex: 1 }}>Факт (₽)<input style={INPUT} type="number" value={posForm.actual_price ?? ''} onChange={e => setPosForm(f => ({ ...f, actual_price: e.target.value ? parseFloat(e.target.value) : undefined }))} /></label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={btnOutline('md')} onClick={() => setEditPos(null)}>Отмена</button>
              <button style={btnPrimary('md')} disabled={savingPos} onClick={handleSavePos}>{savingPos ? 'Сохраняю...' : 'Сохранить'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add position modal */}
      {showAddPos && (
        <div style={OVERLAY} onClick={() => setShowAddPos(false)}>
          <div style={{ ...MODAL, maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ ...T.h2, marginBottom: 20 }}>Добавить позицию</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={LBL}>Наименование<input style={INPUT} value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} /></label>
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ ...LBL, flex: 1 }}>Ед.<input style={INPUT} value={addForm.unit} onChange={e => setAddForm(f => ({ ...f, unit: e.target.value }))} /></label>
                <label style={{ ...LBL, flex: 1 }}>Кол-во<input style={INPUT} type="number" value={addForm.quantity} onChange={e => setAddForm(f => ({ ...f, quantity: e.target.value }))} /></label>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ ...LBL, flex: 1 }}>Клиент (₽)<input style={INPUT} type="number" value={addForm.client_price} onChange={e => setAddForm(f => ({ ...f, client_price: e.target.value }))} /></label>
                <label style={{ ...LBL, flex: 1 }}>Себест. (₽)<input style={INPUT} type="number" value={addForm.cost_price} onChange={e => setAddForm(f => ({ ...f, cost_price: e.target.value }))} /></label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={btnOutline('md')} onClick={() => setShowAddPos(false)}>Отмена</button>
              <button style={btnPrimary('md')} disabled={addingPos} onClick={handleAddPos}>{addingPos ? 'Добавляю...' : 'Добавить'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Calc cost modal */}
      {showCalc && (
        <div style={OVERLAY} onClick={() => setShowCalc(false)}>
          <div style={{ ...MODAL, maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ ...T.h2, marginBottom: 20 }}>Расчёт себестоимости</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={LBL}>Накладные расходы (%)<input style={INPUT} type="number" value={calcForm.overhead_pct} onChange={e => setCalcForm(f => ({ ...f, overhead_pct: e.target.value }))} /></label>
              <label style={LBL}>Прибыль (%)<input style={INPUT} type="number" value={calcForm.profit_pct} onChange={e => setCalcForm(f => ({ ...f, profit_pct: e.target.value }))} /></label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={btnOutline('md')} onClick={() => setShowCalc(false)}>Отмена</button>
              <button style={btnPrimary('md')} disabled={calculating} onClick={handleCalcCost}>{calculating ? 'Рассчитываю...' : 'Рассчитать'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Branch modal */}
      {showBranch && (
        <div style={OVERLAY} onClick={() => setShowBranch(false)}>
          <div style={{ ...MODAL, maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ ...T.h2, marginBottom: 20 }}>Создать ветку сметы</h2>
            <label style={LBL}>Метка ветки (необязательно)<input style={INPUT} value={branchLabel} onChange={e => setBranchLabel(e.target.value)} placeholder="Вариант А" /></label>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={btnOutline('md')} onClick={() => setShowBranch(false)}>Отмена</button>
              <button style={btnPrimary('md')} disabled={branching} onClick={handleBranch}>{branching ? 'Создаю...' : 'Создать ветку'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
