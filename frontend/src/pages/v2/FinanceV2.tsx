import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import client from '../../api/client';
import { financeV2Api, type ProjectPlanFact, type ProjectForecast, type ProjectAlert, type CompanyPL, type BudgetEntry } from '../../api/v2';
import { C, T, CARD, TH, TD, INPUT, LBL, OVERLAY, MODAL, btnPrimary, btnOutline, badge } from '../../ui';

const fmt = (n?: number) => n == null ? '—' : n.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
const fmtM = (n?: number) => n == null ? '—' : (n / 1_000_000).toFixed(2) + ' млн';
const pct = (n?: number) => n == null ? '—' : `${n.toFixed(1)}%`;

type Tab = 'project' | 'company';

interface Project { id: string; name: string; }

const ALERT_COLORS: Record<string, [string, string]> = {
  critical: [C.danger, C.dangerBg],
  warning: [C.warning, C.warningBg],
  info: [C.primary, C.primaryBg],
};

export default function FinanceV2() {
  const [searchParams] = useSearchParams();
  const projectIdParam = searchParams.get('project_id') ?? '';

  const [tab, setTab] = useState<Tab>('project');
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(projectIdParam);

  // Project data
  const [planFact, setPlanFact] = useState<ProjectPlanFact | null>(null);
  const [forecast, setForecast] = useState<ProjectForecast | null>(null);
  const [alerts, setAlerts] = useState<ProjectAlert[]>([]);
  const [budget, setBudget] = useState<BudgetEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Company PL
  const [companyPL, setCompanyPL] = useState<CompanyPL | null>(null);
  const [companyLoading, setCompanyLoading] = useState(false);

  // Add budget entry
  const [showBudget, setShowBudget] = useState(false);
  const [budgetForm, setBudgetForm] = useState({ category: '', subcategory: '', planned_amount: '', actual_amount: '', note: '' });
  const [addingBudget, setAddingBudget] = useState(false);

  async function loadProjects() {
    try {
      const r = await client.get<Project[]>('/projects');
      setProjects(r.data);
    } catch {}
  }

  async function loadProjectData(pid: string) {
    if (!pid) return;
    setLoading(true);
    setError('');
    try {
      const [pf, fc, al, bg] = await Promise.allSettled([
        financeV2Api.planFact(pid),
        financeV2Api.forecast(pid),
        financeV2Api.alerts(pid),
        financeV2Api.budgetEntries(pid),
      ]);
      if (pf.status === 'fulfilled') setPlanFact(pf.value);
      else console.warn('plan-fact failed:', pf.reason);
      if (fc.status === 'fulfilled') setForecast(fc.value);
      else console.warn('forecast failed:', fc.reason);
      if (al.status === 'fulfilled') setAlerts(al.value);
      else console.warn('alerts failed:', al.reason);
      if (bg.status === 'fulfilled') setBudget(bg.value);
      else console.warn('budget failed:', bg.reason);
      const failCount = [pf, fc, al, bg].filter(r => r.status === 'rejected').length;
      if (failCount > 0) setError(`Часть данных недоступна (${failCount}/4 запросов не выполнено)`);
    } catch {
      setError('Ошибка загрузки финансов');
    } finally {
      setLoading(false);
    }
  }

  async function loadCompany() {
    setCompanyLoading(true);
    try {
      const pl = await financeV2Api.companyPL();
      setCompanyPL(pl);
    } catch {
      setError('Ошибка загрузки П&У');
    } finally {
      setCompanyLoading(false);
    }
  }

  useEffect(() => { loadProjects(); }, []);
  useEffect(() => { if (projectId) loadProjectData(projectId); }, [projectId]);
  useEffect(() => { if (tab === 'company') loadCompany(); }, [tab]);

  async function handleAddBudget() {
    if (!projectId || !budgetForm.category.trim()) return;
    setAddingBudget(true);
    try {
      await financeV2Api.addBudgetEntry(projectId, {
        category: budgetForm.category.trim(),
        subcategory: budgetForm.subcategory || undefined,
        planned_amount: parseFloat(budgetForm.planned_amount) || 0,
        actual_amount: parseFloat(budgetForm.actual_amount) || 0,
        note: budgetForm.note || undefined,
      });
      setShowBudget(false);
      setBudgetForm({ category: '', subcategory: '', planned_amount: '', actual_amount: '', note: '' });
      const bg = await financeV2Api.budgetEntries(projectId);
      setBudget(bg);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? 'Ошибка добавления бюджетной строки');
    } finally {
      setAddingBudget(false);
    }
  }

  const MetricCard = ({ label, planned, actual, unit = '₽' }: { label: string; planned?: number; actual?: number; unit?: string }) => {
    const delta = (planned != null && actual != null) ? actual - planned : undefined;
    const isPositive = delta == null || delta >= 0;
    return (
      <div style={{ ...CARD, flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: 12, color: C.textSec, marginBottom: 6 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{fmt(actual)} {unit}</div>
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>план: {fmt(planned)} {unit}</div>
        {delta != null && (
          <div style={{ fontSize: 12, marginTop: 4, color: isPositive ? C.success : C.danger, fontWeight: 500 }}>
            {isPositive ? '+' : ''}{fmt(delta)} {unit}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: '0 20px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={T.h1}>Финансы v2</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
        {(['project', 'company'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '9px 18px', border: 'none', borderBottom: t === tab ? `2px solid ${C.primary}` : '2px solid transparent', background: 'transparent', fontWeight: t === tab ? 600 : 400, color: t === tab ? C.primary : C.textSec, cursor: 'pointer', fontSize: 13 }}>
            {t === 'project' ? 'Проект' : 'Компания (П&У)'}
          </button>
        ))}
      </div>

      {error && <div style={{ color: C.danger, marginBottom: 12, fontSize: 13 }}>{error}</div>}

      {tab === 'project' && (
        <div>
          {/* Project selector */}
          <div style={{ ...CARD, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
            <label style={{ fontSize: 13, color: C.textSec, flexShrink: 0 }}>Проект:</label>
            <select style={{ ...INPUT, width: 320 }} value={projectId} onChange={e => setProjectId(e.target.value)}>
              <option value="">— выберите проект —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {projectId && !loading && (
              <button style={btnOutline('sm')} onClick={() => setShowBudget(true)}>+ Бюджетная строка</button>
            )}
          </div>

          {!projectId ? (
            <div style={{ color: C.textMuted, padding: 32, textAlign: 'center' }}>Выберите проект</div>
          ) : loading ? (
            <div style={{ color: C.textSec, padding: 24 }}>Загрузка...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Alerts */}
              {alerts.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {alerts.map(alert => {
                    const [color, bg] = ALERT_COLORS[alert.level] ?? [C.textMuted, C.surfaceAlt];
                    return (
                      <div key={alert.id} style={{ ...CARD, display: 'flex', gap: 10, alignItems: 'flex-start', borderLeft: `4px solid ${color}`, padding: '10px 16px' }}>
                        <span style={{ color, fontSize: 16 }}>{alert.level === 'critical' ? '🚨' : alert.level === 'warning' ? '⚠' : 'ℹ'}</span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{alert.title}</div>
                          {alert.detail && <div style={{ fontSize: 12, color: C.textSec, marginTop: 2 }}>{alert.detail}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Plan/Fact metrics */}
              {planFact && (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>План / Факт</div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <MetricCard label="Выручка" planned={planFact.revenue.planned} actual={planFact.revenue.actual} />
                    <MetricCard label="Себестоимость" planned={planFact.cost.planned} actual={planFact.cost.actual} />
                    <MetricCard label="Маржа" planned={planFact.margin.planned} actual={planFact.margin.actual} />
                    <div style={{ ...CARD, flex: 1, minWidth: 180 }}>
                      <div style={{ fontSize: 12, color: C.textSec, marginBottom: 6 }}>ГПР</div>
                      <div style={{ fontSize: 22, fontWeight: 700 }}>{planFact.grp.completion_pct.toFixed(0)}%</div>
                      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                        {planFact.grp.stages_done}/{planFact.grp.stages_total} этапов
                      </div>
                      <div style={{ width: '100%', height: 6, background: C.border, borderRadius: 4, overflow: 'hidden', marginTop: 6 }}>
                        <div style={{ height: '100%', width: `${planFact.grp.completion_pct}%`, background: C.success, borderRadius: 4 }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Margins */}
              {planFact && (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ ...CARD, flex: 1 }}>
                    <div style={{ fontSize: 12, color: C.textSec, marginBottom: 4 }}>Маржа плановая</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: planFact.margin.pct_planned >= 0 ? C.success : C.danger }}>
                      {pct(planFact.margin.pct_planned)}
                    </div>
                  </div>
                  <div style={{ ...CARD, flex: 1 }}>
                    <div style={{ fontSize: 12, color: C.textSec, marginBottom: 4 }}>Маржа фактическая</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: planFact.margin.pct_actual >= 0 ? C.success : C.danger }}>
                      {pct(planFact.margin.pct_actual)}
                    </div>
                  </div>
                </div>
              )}

              {/* Forecast */}
              {forecast && (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Прогноз</div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ ...CARD, flex: 1 }}>
                      <div style={{ fontSize: 12, color: C.textSec }}>Выручка (прогноз)</div>
                      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{fmt(forecast.revenue_forecast)} ₽</div>
                    </div>
                    <div style={{ ...CARD, flex: 1 }}>
                      <div style={{ fontSize: 12, color: C.textSec }}>Себестоимость (прогноз)</div>
                      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{fmt(forecast.cost_forecast)} ₽</div>
                    </div>
                    <div style={{ ...CARD, flex: 1 }}>
                      <div style={{ fontSize: 12, color: C.textSec }}>Маржа (прогноз)</div>
                      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: forecast.margin_forecast >= 0 ? C.success : C.danger }}>{fmt(forecast.margin_forecast)} ₽</div>
                    </div>
                    <div style={{ ...CARD, flex: 1 }}>
                      <div style={{ fontSize: 12, color: C.textSec }}>Риск</div>
                      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: forecast.risk_level === 'high' ? C.danger : forecast.risk_level === 'medium' ? C.warning : C.success }}>
                        {forecast.risk_level === 'high' ? 'Высокий' : forecast.risk_level === 'medium' ? 'Средний' : 'Низкий'}
                      </div>
                      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                        {forecast.on_schedule ? '✓ В графике' : '✗ Отставание'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Budget entries */}
              {budget.length > 0 && (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Бюджет по статьям</div>
                  <div style={CARD}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={TH}>Статья</th>
                          <th style={TH}>Подстатья</th>
                          <th style={{ ...TH, textAlign: 'right' }}>План (₽)</th>
                          <th style={{ ...TH, textAlign: 'right' }}>Факт (₽)</th>
                          <th style={{ ...TH, textAlign: 'right' }}>Отклонение</th>
                          <th style={TH}>Примечание</th>
                        </tr>
                      </thead>
                      <tbody>
                        {budget.map(entry => {
                          const delta = entry.actual_amount - entry.planned_amount;
                          return (
                            <tr key={entry.id}>
                              <td style={TD}>{entry.category}</td>
                              <td style={{ ...TD, color: C.textSec }}>{entry.subcategory ?? '—'}</td>
                              <td style={{ ...TD, textAlign: 'right' }}>{fmt(entry.planned_amount)}</td>
                              <td style={{ ...TD, textAlign: 'right' }}>{fmt(entry.actual_amount)}</td>
                              <td style={{ ...TD, textAlign: 'right', color: delta < 0 ? C.success : delta > 0 ? C.danger : C.textSec, fontWeight: 500 }}>
                                {delta > 0 ? '+' : ''}{fmt(delta)}
                              </td>
                              <td style={{ ...TD, color: C.textSec }}>{entry.note ?? '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'company' && (
        <div>
          {companyLoading ? (
            <div style={{ color: C.textSec, padding: 24 }}>Загрузка П&У...</div>
          ) : companyPL ? (
            <div>
              {/* Totals */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                {[
                  { label: 'Выручка (итого)', val: companyPL.totals.revenue },
                  { label: 'Себестоимость (итого)', val: companyPL.totals.cost },
                  { label: 'Маржа (итого)', val: companyPL.totals.margin },
                ].map(({ label, val }) => (
                  <div key={label} style={{ ...CARD, flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: 12, color: C.textSec, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 22, fontWeight: 700 }}>{fmt(val)} ₽</div>
                  </div>
                ))}
                <div style={{ ...CARD, flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 12, color: C.textSec, marginBottom: 4 }}>Маржа %</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: companyPL.totals.margin_pct >= 0 ? C.success : C.danger }}>
                    {pct(companyPL.totals.margin_pct)}
                  </div>
                </div>
              </div>

              {/* Per project table */}
              <div style={CARD}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={TH}>Проект</th>
                      <th style={{ ...TH, textAlign: 'right' }}>Выручка (₽)</th>
                      <th style={{ ...TH, textAlign: 'right' }}>Себестоимость (₽)</th>
                      <th style={{ ...TH, textAlign: 'right' }}>Маржа (₽)</th>
                      <th style={{ ...TH, textAlign: 'right' }}>Маржа %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companyPL.projects.length === 0 && (
                      <tr><td colSpan={5} style={{ ...TD, color: C.textMuted, textAlign: 'center', padding: 32 }}>Нет данных</td></tr>
                    )}
                    {companyPL.projects.map(p => (
                      <tr key={p.project_id}
                        onMouseEnter={e => (e.currentTarget.style.background = C.surfaceHover)}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}
                      >
                        <td style={TD}>{p.project_name}</td>
                        <td style={{ ...TD, textAlign: 'right' }}>{fmt(p.revenue)}</td>
                        <td style={{ ...TD, textAlign: 'right' }}>{fmt(p.cost)}</td>
                        <td style={{ ...TD, textAlign: 'right', color: p.margin >= 0 ? C.success : C.danger, fontWeight: 500 }}>{fmt(p.margin)}</td>
                        <td style={{ ...TD, textAlign: 'right', color: p.margin_pct >= 0 ? C.success : C.danger, fontWeight: 600 }}>{pct(p.margin_pct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{ color: C.textMuted, padding: 32, textAlign: 'center' }}>Нет данных</div>
          )}
        </div>
      )}

      {/* Add budget entry modal */}
      {showBudget && (
        <div style={OVERLAY} onClick={() => setShowBudget(false)}>
          <div style={MODAL} onClick={e => e.stopPropagation()}>
            <h2 style={{ ...T.h2, marginBottom: 20 }}>Добавить бюджетную строку</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={LBL}>Статья<input style={INPUT} value={budgetForm.category} onChange={e => setBudgetForm(f => ({ ...f, category: e.target.value }))} placeholder="Например: Субподряд" /></label>
              <label style={LBL}>Подстатья<input style={INPUT} value={budgetForm.subcategory} onChange={e => setBudgetForm(f => ({ ...f, subcategory: e.target.value }))} placeholder="Необязательно" /></label>
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ ...LBL, flex: 1 }}>Планируемая сумма (₽)<input style={INPUT} type="number" value={budgetForm.planned_amount} onChange={e => setBudgetForm(f => ({ ...f, planned_amount: e.target.value }))} /></label>
                <label style={{ ...LBL, flex: 1 }}>Фактическая сумма (₽)<input style={INPUT} type="number" value={budgetForm.actual_amount} onChange={e => setBudgetForm(f => ({ ...f, actual_amount: e.target.value }))} /></label>
              </div>
              <label style={LBL}>Примечание<input style={INPUT} value={budgetForm.note} onChange={e => setBudgetForm(f => ({ ...f, note: e.target.value }))} /></label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={btnOutline('md')} onClick={() => setShowBudget(false)}>Отмена</button>
              <button style={btnPrimary('md')} disabled={addingBudget} onClick={handleAddBudget}>{addingBudget ? 'Добавляю...' : 'Добавить'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
