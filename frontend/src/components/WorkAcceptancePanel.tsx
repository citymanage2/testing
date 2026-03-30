import { useEffect, useState } from 'react';
import client from '../api/client';
import { C, btnPrimary, btnOutline, btnGhost, btnDanger, INPUT, LBL, CARD, TH, TD } from '../ui';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EstimateItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  type: string;
  section: string;
  row_type?: string;
}

interface Contractor {
  id: string;
  name: string;
  kind: string;
}

interface Assignment {
  id: string;
  contractor_id: string;
  scope_type: 'all' | 'section' | 'item';
  scope_ref: string;
  notes: string;
}

interface Acceptance {
  id: string;
  contractor_id: string;
  act_number: string;
  period_start: string;
  period_end: string;
  status: 'draft' | 'accepted' | 'rejected';
  items_count: number;
  total_accepted_value: number;
  notes: string;
}

interface ProgressItem {
  estimate_item_id: string;
  name: string;
  unit: string;
  quantity_total: number;
  quantity_accepted: number;
  quantity_remaining: number;
  pct_complete: number;
}

interface AcceptanceItem {
  estimate_item_id: string;
  quantity_accepted: number;
}

interface Props {
  taskId: string;
  items: EstimateItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  draft: 'Черновик',
  accepted: 'Принят',
  rejected: 'Отклонён',
};

function statusBadge(status: string) {
  const styles: Record<string, { color: string; bg: string; border: string }> = {
    draft:    { color: C.textSec,  bg: C.surfaceAlt, border: C.border },
    accepted: { color: C.success,  bg: C.successBg,  border: '#bbf7d0' },
    rejected: { color: C.danger,   bg: C.dangerBg,   border: C.dangerBorder },
  };
  const s = styles[status] ?? styles.draft;
  return {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 99,
    fontSize: 11,
    fontWeight: 600,
    background: s.bg,
    color: s.color,
    border: `1px solid ${s.border}`,
  } as React.CSSProperties;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WorkAcceptancePanel({ taskId, items }: Props) {
  const base = `/projects/estimates/${taskId}`;

  // Data
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [acceptances, setAcceptances] = useState<Acceptance[]>([]);
  const [progress, setProgress]       = useState<ProgressItem[]>([]);

  // Assignment form
  const [showNewAssign, setShowNewAssign] = useState(false);
  const [newAssign, setNewAssign] = useState({
    contractor_id: '',
    scope_type: 'all' as 'all' | 'section' | 'item',
    scope_ref: '',
    notes: '',
  });

  // Acceptance form
  const [showNewAcc, setShowNewAcc] = useState(false);
  const [newAcc, setNewAcc] = useState({
    contractor_id: '',
    act_number: '',
    period_start: '',
    period_end: '',
    notes: '',
  });

  // Expanded acceptance items editor
  const [expandedAccId, setExpandedAccId] = useState<string | null>(null);
  const [accItems, setAccItems] = useState<Record<string, AcceptanceItem[]>>({});

  // Loading
  const [savingAssign, setSavingAssign]   = useState(false);
  const [savingAcc, setSavingAcc]         = useState(false);
  const [savingItems, setSavingItems]     = useState<string | null>(null);
  const [deletingAssign, setDeletingAssign] = useState<string | null>(null);
  const [deletingAcc, setDeletingAcc]     = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  // ── Fetch on mount ──────────────────────────────────────────────────────────

  useEffect(() => {
    client.get<Contractor[]>('/contractors').then(({ data }) => setContractors(data)).catch(() => {});
    client.get<Assignment[]>(`${base}/assignments`).then(({ data }) => setAssignments(data)).catch(() => {});
    client.get<Acceptance[]>(`${base}/acceptances`).then(({ data }) => setAcceptances(data)).catch(() => {});
    client.get<ProgressItem[]>(`${base}/acceptance-progress`).then(({ data }) => setProgress(data)).catch(() => {});
  }, [taskId]);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function contractorName(id: string) {
    return contractors.find((c) => c.id === id)?.name ?? id;
  }

  function nonHeaderItems() {
    return items.filter((i) => i.row_type !== 'header' && i.row_type !== 'section');
  }

  // ── Assignment actions ───────────────────────────────────────────────────────

  async function saveAssignment() {
    if (!newAssign.contractor_id) return;
    setSavingAssign(true);
    try {
      const { data } = await client.post<Assignment>(`${base}/assignments`, newAssign);
      setAssignments((prev) => [...prev, data]);
      setShowNewAssign(false);
      setNewAssign({ contractor_id: '', scope_type: 'all', scope_ref: '', notes: '' });
    } catch {
      alert('Ошибка сохранения назначения');
    } finally {
      setSavingAssign(false);
    }
  }

  async function deleteAssignment(id: string) {
    setDeletingAssign(id);
    try {
      await client.delete(`${base}/assignments/${id}`);
      setAssignments((prev) => prev.filter((a) => a.id !== id));
    } catch {
      alert('Ошибка удаления');
    } finally {
      setDeletingAssign(null);
    }
  }

  // ── Acceptance actions ───────────────────────────────────────────────────────

  async function saveAcceptance() {
    if (!newAcc.contractor_id || !newAcc.act_number) return;
    setSavingAcc(true);
    try {
      const { data } = await client.post<Acceptance>(`${base}/acceptances`, newAcc);
      setAcceptances((prev) => [...prev, data]);
      setShowNewAcc(false);
      setNewAcc({ contractor_id: '', act_number: '', period_start: '', period_end: '', notes: '' });
    } catch {
      alert('Ошибка сохранения акта');
    } finally {
      setSavingAcc(false);
    }
  }

  async function deleteAcceptance(id: string) {
    setDeletingAcc(id);
    try {
      await client.delete(`${base}/acceptances/${id}`);
      setAcceptances((prev) => prev.filter((a) => a.id !== id));
      if (expandedAccId === id) setExpandedAccId(null);
    } catch {
      alert('Ошибка удаления акта');
    } finally {
      setDeletingAcc(null);
    }
  }

  async function updateStatus(id: string, status: string) {
    setUpdatingStatus(id);
    try {
      const { data } = await client.patch<Acceptance>(`${base}/acceptances/${id}`, { status });
      setAcceptances((prev) => prev.map((a) => (a.id === id ? data : a)));
    } catch {
      alert('Ошибка изменения статуса');
    } finally {
      setUpdatingStatus(null);
    }
  }

  // ── Acceptance items ─────────────────────────────────────────────────────────

  function toggleExpand(accId: string) {
    if (expandedAccId === accId) {
      setExpandedAccId(null);
      return;
    }
    setExpandedAccId(accId);
    if (!accItems[accId]) {
      // Pre-populate with zeros for every non-header item
      const init: AcceptanceItem[] = nonHeaderItems().map((i) => ({
        estimate_item_id: i.id,
        quantity_accepted: 0,
      }));
      // Fetch existing saved items and merge
      client.get<AcceptanceItem[]>(`${base}/acceptances/${accId}/items`)
        .then(({ data }) => {
          const map: Record<string, number> = {};
          data.forEach((d) => { map[d.estimate_item_id] = d.quantity_accepted; });
          setAccItems((prev) => ({
            ...prev,
            [accId]: init.map((i) => ({ ...i, quantity_accepted: map[i.estimate_item_id] ?? 0 })),
          }));
        })
        .catch(() => {
          setAccItems((prev) => ({ ...prev, [accId]: init }));
        });
    }
  }

  function setAccItemQty(accId: string, itemId: string, qty: number) {
    setAccItems((prev) => ({
      ...prev,
      [accId]: (prev[accId] ?? []).map((r) =>
        r.estimate_item_id === itemId ? { ...r, quantity_accepted: qty } : r
      ),
    }));
  }

  async function saveAccItems(accId: string) {
    setSavingItems(accId);
    try {
      await client.put(`${base}/acceptances/${accId}/items`, { items: accItems[accId] ?? [] });
      // Refresh acceptances to update totals
      const { data } = await client.get<Acceptance[]>(`${base}/acceptances`);
      setAcceptances(data);
    } catch {
      alert('Ошибка сохранения позиций');
    } finally {
      setSavingItems(null);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  const sectionTitle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 700,
    color: C.text,
    marginBottom: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── 1. Назначение субподрядчиков ─────────────────────────────────────── */}
      <div style={CARD}>
        <div style={sectionTitle}>
          <span>Назначение субподрядчиков</span>
          {!showNewAssign && (
            <button style={btnOutline('sm')} onClick={() => setShowNewAssign(true)}>
              + Назначить
            </button>
          )}
        </div>

        {/* Existing assignments */}
        {assignments.length === 0 && !showNewAssign && (
          <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>Назначений нет</p>
        )}
        {assignments.map((a) => (
          <div
            key={a.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 0',
              borderBottom: `1px solid ${C.border}`,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>
                {contractorName(a.contractor_id)}
              </span>
              <span style={{ fontSize: 12, color: C.textSec, marginLeft: 8 }}>
                {a.scope_type === 'all' ? 'Весь объём' : a.scope_type === 'section' ? `Раздел: ${a.scope_ref}` : `Позиция: ${a.scope_ref}`}
              </span>
              {a.notes && (
                <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 8 }}>— {a.notes}</span>
              )}
            </div>
            <button
              style={btnDanger('sm')}
              disabled={deletingAssign === a.id}
              onClick={() => deleteAssignment(a.id)}
              title="Удалить назначение"
            >
              {deletingAssign === a.id ? '...' : '✕'}
            </button>
          </div>
        ))}

        {/* New assignment form */}
        {showNewAssign && (
          <div
            style={{
              marginTop: 12,
              padding: 14,
              background: C.surfaceAlt,
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <label style={LBL}>
              Подрядчик
              <select
                style={INPUT}
                value={newAssign.contractor_id}
                onChange={(e) => setNewAssign((p) => ({ ...p, contractor_id: e.target.value }))}
              >
                <option value="">— выберите —</option>
                {contractors.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.kind})</option>
                ))}
              </select>
            </label>

            <label style={LBL}>
              Область работ
              <div style={{ display: 'flex', gap: 14, marginTop: 4 }}>
                {(['all', 'section', 'item'] as const).map((st) => (
                  <label key={st} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="scope_type"
                      value={st}
                      checked={newAssign.scope_type === st}
                      onChange={() => setNewAssign((p) => ({ ...p, scope_type: st, scope_ref: '' }))}
                    />
                    {st === 'all' ? 'Весь объём' : st === 'section' ? 'Раздел' : 'Позиция'}
                  </label>
                ))}
              </div>
            </label>

            {newAssign.scope_type !== 'all' && (
              <label style={LBL}>
                {newAssign.scope_type === 'section' ? 'Название раздела' : 'Название позиции'}
                <input
                  style={INPUT}
                  list="scope-ref-options"
                  value={newAssign.scope_ref}
                  onChange={(e) => setNewAssign((p) => ({ ...p, scope_ref: e.target.value }))}
                  placeholder={newAssign.scope_type === 'section' ? 'Введите раздел...' : 'Введите позицию...'}
                />
                <datalist id="scope-ref-options">
                  {newAssign.scope_type === 'section'
                    ? [...new Set(items.map((i) => i.section))].map((s) => <option key={s} value={s} />)
                    : nonHeaderItems().map((i) => <option key={i.id} value={i.name} />)}
                </datalist>
              </label>
            )}

            <label style={LBL}>
              Примечания
              <input
                style={INPUT}
                value={newAssign.notes}
                onChange={(e) => setNewAssign((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Необязательно..."
              />
            </label>

            <div style={{ display: 'flex', gap: 8 }}>
              <button style={btnPrimary('sm')} disabled={savingAssign || !newAssign.contractor_id} onClick={saveAssignment}>
                {savingAssign ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button style={btnGhost('sm')} onClick={() => { setShowNewAssign(false); setNewAssign({ contractor_id: '', scope_type: 'all', scope_ref: '', notes: '' }); }}>
                Отмена
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 2. Акты приемки работ ────────────────────────────────────────────── */}
      <div style={CARD}>
        <div style={sectionTitle}>
          <span>Акты приемки работ</span>
          {!showNewAcc && (
            <button style={btnPrimary('sm')} onClick={() => setShowNewAcc(true)}>
              + Новый акт
            </button>
          )}
        </div>

        {/* New acceptance form */}
        {showNewAcc && (
          <div
            style={{
              marginBottom: 14,
              padding: 14,
              background: C.surfaceAlt,
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={LBL}>
                Подрядчик
                <select
                  style={INPUT}
                  value={newAcc.contractor_id}
                  onChange={(e) => setNewAcc((p) => ({ ...p, contractor_id: e.target.value }))}
                >
                  <option value="">— выберите —</option>
                  {contractors.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>

              <label style={LBL}>
                Номер акта
                <input
                  style={INPUT}
                  value={newAcc.act_number}
                  onChange={(e) => setNewAcc((p) => ({ ...p, act_number: e.target.value }))}
                  placeholder="КС-2/1"
                />
              </label>

              <label style={LBL}>
                Период с
                <input
                  type="date"
                  style={INPUT}
                  value={newAcc.period_start}
                  onChange={(e) => setNewAcc((p) => ({ ...p, period_start: e.target.value }))}
                />
              </label>

              <label style={LBL}>
                Период по
                <input
                  type="date"
                  style={INPUT}
                  value={newAcc.period_end}
                  onChange={(e) => setNewAcc((p) => ({ ...p, period_end: e.target.value }))}
                />
              </label>
            </div>

            <label style={LBL}>
              Примечания
              <input
                style={INPUT}
                value={newAcc.notes}
                onChange={(e) => setNewAcc((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Необязательно..."
              />
            </label>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                style={btnPrimary('sm')}
                disabled={savingAcc || !newAcc.contractor_id || !newAcc.act_number}
                onClick={saveAcceptance}
              >
                {savingAcc ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button style={btnGhost('sm')} onClick={() => { setShowNewAcc(false); setNewAcc({ contractor_id: '', act_number: '', period_start: '', period_end: '', notes: '' }); }}>
                Отмена
              </button>
            </div>
          </div>
        )}

        {acceptances.length === 0 && !showNewAcc && (
          <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>Актов нет</p>
        )}

        {acceptances.map((acc) => {
          const isExpanded = expandedAccId === acc.id;
          const rows = accItems[acc.id] ?? [];

          return (
            <div
              key={acc.id}
              style={{
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                marginBottom: 8,
                overflow: 'hidden',
              }}
            >
              {/* Acceptance header row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  background: isExpanded ? C.primaryBg : C.surface,
                }}
              >
                <button
                  style={{ ...btnGhost('sm'), padding: '2px 6px', fontSize: 16, color: C.primary }}
                  onClick={() => toggleExpand(acc.id)}
                  title={isExpanded ? 'Свернуть' : 'Развернуть'}
                >
                  {isExpanded ? '▾' : '▸'}
                </button>

                <span style={{ fontWeight: 600, fontSize: 13, color: C.text, minWidth: 80 }}>
                  № {acc.act_number}
                </span>

                <span style={{ fontSize: 13, color: C.textSec, flex: 1 }}>
                  {contractorName(acc.contractor_id)}
                  {acc.period_start && acc.period_end && (
                    <span style={{ color: C.textMuted, marginLeft: 8 }}>
                      {acc.period_start} — {acc.period_end}
                    </span>
                  )}
                </span>

                <span style={statusBadge(acc.status)}>{STATUS_LABEL[acc.status] ?? acc.status}</span>

                <span style={{ fontSize: 12, color: C.textSec }}>
                  {acc.items_count} поз. · {acc.total_accepted_value?.toLocaleString('ru-RU')} ₽
                </span>

                {/* Status cycle button */}
                <button
                  style={btnOutline('sm')}
                  disabled={updatingStatus === acc.id}
                  title="Изменить статус"
                  onClick={() => {
                    const next = acc.status === 'draft' ? 'accepted' : acc.status === 'accepted' ? 'rejected' : 'draft';
                    updateStatus(acc.id, next);
                  }}
                >
                  {updatingStatus === acc.id ? '...' : '⟳'}
                </button>

                <button
                  style={btnDanger('sm')}
                  disabled={deletingAcc === acc.id}
                  title="Удалить акт"
                  onClick={() => deleteAcceptance(acc.id)}
                >
                  {deletingAcc === acc.id ? '...' : '✕'}
                </button>
              </div>

              {/* Expanded items editor */}
              {isExpanded && (
                <div style={{ borderTop: `1px solid ${C.border}` }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ ...TH, width: '40%' }}>Наименование</th>
                          <th style={{ ...TH, textAlign: 'center' }}>Ед.</th>
                          <th style={{ ...TH, textAlign: 'right' }}>Всего в смете</th>
                          <th style={{ ...TH, textAlign: 'right', width: 110 }}>Принято</th>
                          <th style={{ ...TH, textAlign: 'right' }}>Остаток</th>
                        </tr>
                      </thead>
                      <tbody>
                        {nonHeaderItems().map((item) => {
                          const row = rows.find((r) => r.estimate_item_id === item.id);
                          const qtyAcc = row?.quantity_accepted ?? 0;
                          const remaining = Math.max(0, item.quantity - qtyAcc);
                          return (
                            <tr key={item.id}>
                              <td style={TD}>{item.name}</td>
                              <td style={{ ...TD, textAlign: 'center', color: C.textSec }}>{item.unit}</td>
                              <td style={{ ...TD, textAlign: 'right' }}>{item.quantity}</td>
                              <td style={{ ...TD, textAlign: 'right', padding: '4px 10px' }}>
                                <input
                                  type="number"
                                  min={0}
                                  max={item.quantity}
                                  step="any"
                                  style={{ ...INPUT, width: 80, textAlign: 'right', padding: '4px 6px' }}
                                  value={qtyAcc}
                                  onChange={(e) => setAccItemQty(acc.id, item.id, parseFloat(e.target.value) || 0)}
                                />
                              </td>
                              <td style={{ ...TD, textAlign: 'right', color: remaining > 0 ? C.textSec : C.success }}>
                                {remaining}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderTop: `1px solid ${C.border}`, background: C.surfaceAlt }}>
                    <button
                      style={btnPrimary('sm')}
                      disabled={savingItems === acc.id}
                      onClick={() => saveAccItems(acc.id)}
                    >
                      {savingItems === acc.id ? 'Сохранение...' : 'Сохранить позиции'}
                    </button>
                    <button
                      style={btnOutline('sm')}
                      onClick={() => {
                        // Emit a custom event that the parent EstimateView can listen to
                        window.dispatchEvent(new CustomEvent('generate-ks2', { detail: { acceptanceId: acc.id, taskId } }));
                      }}
                    >
                      Создать КС-2
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── 3. Прогресс по позициям ──────────────────────────────────────────── */}
      <div style={CARD}>
        <div style={{ ...sectionTitle, marginBottom: 14 }}>
          <span>Прогресс по позициям</span>
        </div>

        {progress.length === 0 ? (
          <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>Нет данных о прогрессе</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...TH, width: '35%' }}>Наименование</th>
                  <th style={{ ...TH, textAlign: 'center' }}>Ед.</th>
                  <th style={{ ...TH, textAlign: 'right' }}>По смете</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Принято</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Остаток</th>
                  <th style={{ ...TH, width: 140 }}>Прогресс</th>
                </tr>
              </thead>
              <tbody>
                {progress.map((p) => {
                  const pct = Math.min(100, Math.max(0, p.pct_complete));
                  const barColor = pct >= 100 ? C.success : pct > 0 ? C.warning : C.textMuted;
                  return (
                    <tr key={p.estimate_item_id}>
                      <td style={TD}>{p.name}</td>
                      <td style={{ ...TD, textAlign: 'center', color: C.textSec }}>{p.unit}</td>
                      <td style={{ ...TD, textAlign: 'right' }}>{p.quantity_total}</td>
                      <td style={{ ...TD, textAlign: 'right' }}>{p.quantity_accepted}</td>
                      <td style={{ ...TD, textAlign: 'right', color: p.quantity_remaining > 0 ? C.textSec : C.success }}>
                        {p.quantity_remaining}
                      </td>
                      <td style={TD}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div
                            style={{
                              flex: 1,
                              height: 8,
                              background: C.border,
                              borderRadius: 99,
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                background: barColor,
                                borderRadius: 99,
                                transition: 'width .3s ease',
                              }}
                            />
                          </div>
                          <span style={{ fontSize: 11, color: barColor, fontWeight: 600, minWidth: 32, textAlign: 'right' }}>
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
