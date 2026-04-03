import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { C } from '../ui';

interface Project { id: string; name: string; }
interface TaskRef { id: string; task_type: string; status: string; estimate_status?: string; name?: string; doc_type?: string; }
interface ProjectDetail extends Project { tasks: TaskRef[]; }
interface Totals { total_work: number; total_mat: number; total: number; total_vat: number; tasks_count: number; }

function fmt(v: number) { return v.toLocaleString('ru-RU', { maximumFractionDigits: 0 }); }

const TYPE_LABELS: Record<string, string> = {
  SMETA_FROM_PROJECT: 'Смета из проекта', SMETA_FROM_TZ: 'Смета из ТЗ', SMETA_FROM_LIST: 'Смета из перечня',
  SMETA_FROM_TZ_PROJECT: 'Смета ТЗ+проект', SMETA_FROM_EDC_PROJECT: 'Смета EDC', SMETA_FROM_GRAND_PROJECT: 'Grand-смета',
  LIST_FROM_TZ: 'Перечень из ТЗ', LIST_FROM_PROJECT: 'Перечень из проекта', LIST_FROM_TZ_PROJECT: 'Перечень ТЗ+проект',
  RESEARCH_PROJECT: 'Исследование', SCAN_TO_EXCEL: 'Скан→Excel', COMPARE_PROJECT_SMETA: 'Сравнение', IMPORT_EXCEL: 'Импорт Excel',
};

const STATUS_COLOR: Record<string, string> = { completed: C.success, failed: C.danger, processing: C.warning };

interface Props { collapsed?: boolean; }

export default function ProjectsSidebar({ collapsed }: Props = {}) {
  const [projects,        setProjects]        = useState<Project[]>([]);
  const [expanded,        setExpanded]        = useState<string | null>(null);
  const [detail,          setDetail]          = useState<ProjectDetail | null>(null);
  const [totals,          setTotals]          = useState<Totals | null>(null);
  const [loadingDetail,   setLoadingDetail]   = useState(false);
  const [dragOver,        setDragOver]        = useState<string | null>(null);
  const [noProjectTasks,  setNoProjectTasks]  = useState<TaskRef[]>([]);
  const [showNoProject,   setShowNoProject]   = useState(true);
  const importRef = useRef<HTMLInputElement>(null);
  const [importProjectId, setImportProjectId] = useState<string | null>(null);
  const navigate = useNavigate();

  async function load() {
    try { setProjects((await client.get<Project[]>('/projects')).data); } catch { setProjects([]); }
    try { setNoProjectTasks((await client.get<TaskRef[]>('/tasks?no_project=true')).data); } catch { setNoProjectTasks([]); }
  }

  useEffect(() => { load(); }, []);

  async function handleDrop(projectId: string, e: React.DragEvent) {
    e.preventDefault(); setDragOver(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;
    try {
      await client.post(`/projects/${projectId}/estimates/${taskId}`);
      setNoProjectTasks(prev => prev.filter(t => t.id !== taskId));
      if (expanded === projectId) refreshDetail(projectId);
    } catch {}
  }

  async function refreshDetail(id: string) {
    setLoadingDetail(true);
    try {
      const [d, t] = await Promise.all([
        client.get<ProjectDetail>(`/projects/${id}`),
        client.get<Totals>(`/projects/${id}/totals`),
      ]);
      setDetail(d.data); setTotals(t.data);
    } catch { setDetail(null); setTotals(null); }
    finally { setLoadingDetail(false); }
  }

  async function toggleProject(id: string) {
    if (expanded === id) { setExpanded(null); setDetail(null); setTotals(null); return; }
    setExpanded(id);
    await refreshDetail(id);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !importProjectId) return;
    const fd = new FormData(); fd.append('file', file);
    try {
      const { data } = await client.post(`/projects/${importProjectId}/import-estimate`, fd);
      navigate(`/task/${data.task_id}/estimate`);
      refreshDetail(importProjectId);
    } catch { alert('Ошибка импорта'); }
    finally { if (importRef.current) importRef.current.value = ''; setImportProjectId(null); }
  }

  async function addProject() {
    const n = prompt('Название проекта:');
    if (n?.trim()) { await client.post('/projects', { name: n.trim() }); load(); }
  }

  if (collapsed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4, gap: 2 }}>
        {projects.map(p => (
          <button
            key={p.id}
            onClick={() => navigate(`/projects/${p.id}`)}
            title={p.name}
            style={{
              width: 40, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none', borderRadius: 6,
              cursor: 'pointer', fontSize: 18,
            }}
          >📁</button>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '12px 12px 8px', borderBottom: `1px solid ${C.border}` }}>
        <button onClick={addProject} style={{
          width: '100%', padding: '7px 12px', background: C.primary, color: '#fff',
          border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Новый проект
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {/* No-project tasks */}
        <SideSection
          label="Без проекта"
          count={noProjectTasks.length}
          open={showNoProject}
          onToggle={() => setShowNoProject(v => !v)}
          accent
        >
          {noProjectTasks.length === 0
            ? <EmptyMsg>Нет задач</EmptyMsg>
            : noProjectTasks.map(t => (
              <TaskRow key={t.id} task={t}
                onNavigate={() => navigate(t.status === 'completed' ? `/task/${t.id}/estimate` : `/task/${t.id}/status`)}
                onDelete={async () => { if (confirm('Удалить смету?')) { await client.delete(`/tasks/${t.id}`); setNoProjectTasks(prev => prev.filter(x => x.id !== t.id)); } }}
                draggable />
            ))}
        </SideSection>

        {/* Projects */}
        {projects.length === 0
          ? <EmptyMsg>Нет проектов</EmptyMsg>
          : projects.map(p => (
            <div key={p.id} style={{ marginBottom: 2 }}>
              <div
                onClick={() => toggleProject(p.id)}
                onDragOver={e => { e.preventDefault(); setDragOver(p.id); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => handleDrop(p.id, e)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px',
                  borderRadius: 6, cursor: 'pointer', userSelect: 'none',
                  background: dragOver === p.id ? C.primaryBg : expanded === p.id ? C.primaryBg : 'transparent',
                  border: `1px solid ${dragOver === p.id || expanded === p.id ? C.primary + '33' : 'transparent'}`,
                }}
              >
                <span style={{ fontSize: 10, color: expanded === p.id ? C.primary : C.textMuted, width: 10, textAlign: 'center', flexShrink: 0 }}>{expanded === p.id ? '▼' : '▶'}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontSize: 13, fontWeight: 500, color: expanded === p.id ? C.primary : C.text }}>{p.name}</span>
                <span onClick={e => { e.stopPropagation(); navigate(`/projects/${p.id}`); }}
                  title="Карточка проекта"
                  style={{ fontSize: 14, color: C.textMuted, cursor: 'pointer', padding: '0 2px', flexShrink: 0, opacity: .7 }}>⊞</span>
              </div>

              {expanded === p.id && (
                <div style={{ paddingLeft: 14, paddingBottom: 4 }}>
                  {loadingDetail
                    ? <EmptyMsg>Загрузка...</EmptyMsg>
                    : (<>
                      {totals && totals.tasks_count > 0 && (
                        <div style={{ margin: '6px 0', padding: '8px 10px', background: C.primaryBg, borderRadius: 6, fontSize: 11, border: `1px solid ${C.primary}22` }}>
                          <div style={{ fontWeight: 600, color: C.primary, marginBottom: 4 }}>Итого ({totals.tasks_count} {totals.tasks_count === 1 ? 'смета' : 'сметы'})</div>
                          <div style={{ color: C.textSec }}>Работы: <b>{fmt(totals.total_work)} ₽</b></div>
                          <div style={{ color: C.textSec }}>Материалы: <b>{fmt(totals.total_mat)} ₽</b></div>
                          <div style={{ color: C.text, fontWeight: 700, marginTop: 3 }}>С НДС: {fmt(totals.total + totals.total_vat)} ₽</div>
                        </div>
                      )}
                      <button onClick={() => { setImportProjectId(p.id); importRef.current?.click(); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, width: '100%', padding: '5px 8px', margin: '4px 0', background: 'transparent', border: `1px dashed ${C.border}`, borderRadius: 5, cursor: 'pointer', fontSize: 12, color: C.textSec }}>
                        ⬆ Импорт Excel
                      </button>
                      {!detail || detail.tasks.length === 0
                        ? <EmptyMsg>Нет смет</EmptyMsg>
                        : detail.tasks.map(t => (
                          <TaskRow key={t.id} task={t}
                            onNavigate={() => navigate(t.status === 'completed' ? `/task/${t.id}/estimate` : `/task/${t.id}/status`)}
                            onDelete={async () => { if (confirm('Удалить смету?')) { await client.delete(`/tasks/${t.id}`); refreshDetail(p.id); } }}
                          />
                        ))}
                    </>)}
                </div>
              )}
            </div>
          ))}
      </div>
      <input ref={importRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleImport} />
    </div>
  );
}

function SideSection({ label, count, open, onToggle, accent, children }: {
  label: string; count: number; open: boolean; onToggle: () => void; accent?: boolean; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div onClick={onToggle} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
        borderRadius: 6, cursor: 'pointer', userSelect: 'none',
        background: accent ? C.warningBg : C.surfaceAlt,
        border: `1px solid ${accent ? C.warning + '40' : C.border}`,
      }}>
        <span style={{ fontSize: 10, color: accent ? C.warning : C.textMuted }}>{open ? '▼' : '▶'}</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: accent ? C.warning : C.text }}>{label}</span>
        {count > 0 && <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 99, background: accent ? C.warning + '20' : C.border, color: accent ? C.warning : C.textSec, fontWeight: 600 }}>{count}</span>}
      </div>
      {open && <div style={{ paddingTop: 2 }}>{children}</div>}
    </div>
  );
}

function TaskRow({ task: t, onNavigate, onDelete, draggable }: { task: TaskRef; onNavigate: () => void; onDelete?: () => void; draggable?: boolean; }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 5, cursor: 'pointer', marginBottom: 1, background: hovered ? C.surfaceAlt : 'transparent' }}
      draggable={draggable}
      onDragStart={draggable ? e => e.dataTransfer.setData('text/plain', t.id) : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {draggable && <span style={{ color: C.textMuted, fontSize: 10, cursor: 'grab' }}>⠿</span>}
      <span onClick={onNavigate} style={{ flex: 1, fontSize: 12, color: C.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.name || TYPE_LABELS[t.task_type]}>
        {t.name || TYPE_LABELS[t.task_type] || t.task_type}
        {t.doc_type && <span style={{ marginLeft: 4, fontSize: 10, color: C.textMuted }}>[{t.doc_type}]</span>}
      </span>
      <span style={{ fontSize: 8, color: STATUS_COLOR[t.status] || C.textMuted, flexShrink: 0 }}>●</span>
      {onDelete && (
        <button onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{ padding: '1px 5px', fontSize: 10, background: 'transparent', color: C.danger, border: 'none', borderRadius: 3, cursor: 'pointer', flexShrink: 0, opacity: hovered ? 1 : 0 }}>✕</button>
      )}
    </div>
  );
}

function EmptyMsg({ children }: { children: React.ReactNode }) {
  return <p style={{ color: C.textMuted, fontSize: 12, margin: '4px 10px', fontStyle: 'italic' }}>{children}</p>;
}
