import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import client from '../../api/client';
import { workStages, type WorkStage } from '../../api/v2';
import { C, T, CARD, TH, TD, INPUT, LBL, OVERLAY, MODAL, btnPrimary, btnOutline, btnDanger, btnGhost, badge } from '../../ui';

const STAGE_STATUSES = ['planned', 'in_progress', 'done', 'blocked'];
const STATUS_LABELS: Record<string, string> = {
  planned: 'Запланирован', in_progress: 'В работе', done: 'Завершён', blocked: 'Заблокирован',
};
const STATUS_COLORS: Record<string, [string, string]> = {
  planned: [C.textMuted, C.surfaceAlt],
  in_progress: [C.primary, C.primaryBg],
  done: [C.success, C.successBg],
  blocked: [C.danger, C.dangerBg],
};

interface Project { id: string; name: string; }

export default function WorkStagesV2() {
  const [searchParams] = useSearchParams();
  const projectIdParam = searchParams.get('project_id') ?? '';

  const [projectId, setProjectId] = useState(projectIdParam);
  const [projects, setProjects] = useState<Project[]>([]);
  const [stages, setStages] = useState<WorkStage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [createParent, setCreateParent] = useState('');
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '', order_index: '0' });
  const [creating, setCreating] = useState(false);

  const [editStage, setEditStage] = useState<WorkStage | null>(null);
  const [editForm, setEditForm] = useState<Partial<WorkStage>>({});
  const [saving, setSaving] = useState(false);

  async function loadProjects() {
    try {
      const r = await client.get<Project[]>('/projects');
      setProjects(r.data);
    } catch {}
  }

  async function load() {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const data = await workStages.list(projectId);
      setStages(data);
    } catch {
      setError('Ошибка загрузки ГПР');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadProjects(); }, []);
  useEffect(() => { load(); }, [projectId]);

  async function handleCreate() {
    if (!projectId || !form.name.trim()) return;
    setCreating(true);
    try {
      await workStages.create({
        project_id: projectId,
        name: form.name.trim(),
        parent_id: createParent || undefined,
        order_index: parseInt(form.order_index) || 0,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
      });
      setShowCreate(false);
      setForm({ name: '', start_date: '', end_date: '', order_index: '0' });
      await load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? 'Ошибка создания этапа');
    } finally {
      setCreating(false);
    }
  }

  async function handleSave() {
    if (!editStage) return;
    setSaving(true);
    try {
      await workStages.update(editStage.id, editForm);
      setEditStage(null);
      await load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить этап?')) return;
    try {
      await workStages.remove(id);
      await load();
    } catch {
      setError('Ошибка удаления этапа');
    }
  }

  async function quickStatus(stageId: string, status: string) {
    try {
      await workStages.update(stageId, { status });
      setStages(ss => ss.map(s => s.id === stageId ? { ...s, status } : s));
    } catch {
      setError('Ошибка смены статуса');
    }
  }

  // Build tree: root stages + child stages
  const rootStages = stages.filter(s => !s.parent_id);
  const childOf = (parentId: string) => stages.filter(s => s.parent_id === parentId);

  function renderStage(stage: WorkStage, depth = 0): React.ReactElement[] {
    const children = childOf(stage.id);
    const [color, bg] = STATUS_COLORS[stage.status] ?? [C.textMuted, C.surfaceAlt];
    return [
      <tr
        key={stage.id}
        onMouseEnter={e => (e.currentTarget.style.background = C.surfaceHover)}
        onMouseLeave={e => (e.currentTarget.style.background = '')}
      >
        <td style={{ ...TD, paddingLeft: 8 + depth * 20 }}>
          <span style={{ fontWeight: children.length > 0 ? 600 : 400 }}>
            {children.length > 0 ? '▾ ' : '  '}{stage.name}
          </span>
        </td>
        <td style={TD}><span style={badge(color, bg)}>{STATUS_LABELS[stage.status] ?? stage.status}</span></td>
        <td style={{ ...TD, color: C.textSec }}>{stage.start_date ?? '—'}</td>
        <td style={{ ...TD, color: C.textSec }}>{stage.end_date ?? '—'}</td>
        <td style={TD}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 80, height: 6, background: C.border, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${stage.completion_pct}%`, background: C.success, borderRadius: 4 }} />
            </div>
            <span style={{ fontSize: 12, color: C.textSec }}>{stage.completion_pct.toFixed(0)}%</span>
          </div>
        </td>
        <td style={TD}>
          <div style={{ display: 'flex', gap: 4 }}>
            {STAGE_STATUSES.filter(s => s !== stage.status).slice(0, 2).map(s => (
              <button key={s} style={btnOutline('sm')} onClick={() => quickStatus(stage.id, s)}>
                {STATUS_LABELS[s]}
              </button>
            ))}
            <button style={btnOutline('sm')} onClick={() => { setEditStage(stage); setEditForm({ name: stage.name, status: stage.status, start_date: stage.start_date, end_date: stage.end_date, completion_pct: stage.completion_pct }); }}>✏</button>
            <button style={btnGhost('sm')} onClick={() => { setCreateParent(stage.id); setShowCreate(true); }}>+Подэтап</button>
            <button style={btnDanger('sm')} onClick={() => handleDelete(stage.id)}>✕</button>
          </div>
        </td>
      </tr>,
      ...children.flatMap(child => renderStage(child, depth + 1)),
    ];
  }

  const totalStages = stages.length;
  const doneStages = stages.filter(s => s.status === 'done').length;
  const overallPct = totalStages > 0 ? Math.round((doneStages / totalStages) * 100) : 0;

  return (
    <div style={{ padding: '0 20px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={T.h1}>ГПР — График производства работ</h1>
        <button style={btnPrimary('md')} onClick={() => { setCreateParent(''); setShowCreate(true); }}>+ Новый этап</button>
      </div>

      {/* Project selector */}
      <div style={{ ...CARD, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <label style={{ fontSize: 13, color: C.textSec, flexShrink: 0 }}>Проект:</label>
        <select style={{ ...INPUT, width: 320 }} value={projectId} onChange={e => setProjectId(e.target.value)}>
          <option value="">— выберите проект —</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {totalStages > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <span style={{ fontSize: 13, color: C.textSec }}>Завершено {doneStages}/{totalStages}</span>
            <div style={{ width: 100, height: 8, background: C.border, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${overallPct}%`, background: C.success, borderRadius: 4 }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{overallPct}%</span>
          </div>
        )}
        {error && <span style={{ color: C.danger, fontSize: 13 }}>{error}</span>}
      </div>

      {!projectId ? (
        <div style={{ color: C.textMuted, padding: 32, textAlign: 'center' }}>Выберите проект для просмотра ГПР</div>
      ) : loading ? (
        <div style={{ color: C.textSec, padding: 24 }}>Загрузка...</div>
      ) : (
        <div style={CARD}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH}>Этап</th>
                <th style={TH}>Статус</th>
                <th style={TH}>Начало</th>
                <th style={TH}>Конец</th>
                <th style={TH}>Готовность</th>
                <th style={{ ...TH, width: 280 }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {stages.length === 0 && <tr><td colSpan={6} style={{ ...TD, color: C.textMuted, textAlign: 'center', padding: 32 }}>Нет этапов. Добавьте первый этап.</td></tr>}
              {rootStages.flatMap(s => renderStage(s))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div style={OVERLAY} onClick={() => setShowCreate(false)}>
          <div style={MODAL} onClick={e => e.stopPropagation()}>
            <h2 style={{ ...T.h2, marginBottom: 20 }}>
              {createParent ? `Подэтап для: ${stages.find(s => s.id === createParent)?.name ?? ''}` : 'Новый этап ГПР'}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={LBL}>Название<input style={INPUT} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus /></label>
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ ...LBL, flex: 1 }}>Дата начала<input style={INPUT} type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></label>
                <label style={{ ...LBL, flex: 1 }}>Дата окончания<input style={INPUT} type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></label>
              </div>
              <label style={LBL}>Порядок<input style={INPUT} type="number" value={form.order_index} onChange={e => setForm(f => ({ ...f, order_index: e.target.value }))} /></label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={btnOutline('md')} onClick={() => setShowCreate(false)}>Отмена</button>
              <button style={btnPrimary('md')} disabled={creating} onClick={handleCreate}>{creating ? 'Создаю...' : 'Создать'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editStage && (
        <div style={OVERLAY} onClick={() => setEditStage(null)}>
          <div style={MODAL} onClick={e => e.stopPropagation()}>
            <h2 style={{ ...T.h2, marginBottom: 20 }}>Редактировать этап</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={LBL}>Название<input style={INPUT} value={editForm.name ?? ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></label>
              <label style={LBL}>
                Статус
                <select style={INPUT} value={editForm.status ?? ''} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                  {STAGE_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </label>
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ ...LBL, flex: 1 }}>Начало<input style={INPUT} type="date" value={editForm.start_date ?? ''} onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value }))} /></label>
                <label style={{ ...LBL, flex: 1 }}>Конец<input style={INPUT} type="date" value={editForm.end_date ?? ''} onChange={e => setEditForm(f => ({ ...f, end_date: e.target.value }))} /></label>
              </div>
              <label style={LBL}>Готовность (%)<input style={INPUT} type="number" min="0" max="100" value={editForm.completion_pct ?? 0} onChange={e => setEditForm(f => ({ ...f, completion_pct: parseFloat(e.target.value) }))} /></label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={btnOutline('md')} onClick={() => setEditStage(null)}>Отмена</button>
              <button style={btnPrimary('md')} disabled={saving} onClick={handleSave}>{saving ? 'Сохраняю...' : 'Сохранить'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
