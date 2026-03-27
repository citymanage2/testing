import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

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

export default function ProjectsSidebar() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [noProjectTasks, setNoProjectTasks] = useState<TaskRef[]>([]);
  const [showNoProject, setShowNoProject] = useState(true);
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
    } catch { /* ignore */ }
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

  return (
    <div style={{ padding: '12px 8px' }}>
      <button onClick={async () => { const n = prompt('Название проекта:'); if (n?.trim()) { await client.post('/projects', { name: n.trim() }); load(); } }} style={newProjectBtn}>+ Новый проект</button>

      {/* No-project section */}
      <div style={{ marginBottom: 8 }}>
        <div onClick={() => setShowNoProject(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 4, cursor: 'pointer', background: '#fff3e0', fontSize: 13, fontWeight: 600 }}>
          <span style={{ fontSize: 10, color: '#e65100' }}>{showNoProject ? '▼' : '▶'}</span>
          <span style={{ flex: 1, color: '#e65100' }}>Без проекта</span>
          <span style={{ fontSize: 11, color: '#e65100', background: '#ffe0b2', borderRadius: 10, padding: '1px 7px' }}>{noProjectTasks.length}</span>
        </div>
        {showNoProject && (
          <div style={{ paddingLeft: 12 }}>
            {noProjectTasks.length === 0
              ? <p style={{ color: '#aaa', fontSize: 12, margin: '4px 8px' }}>Пусто</p>
              : noProjectTasks.map(t => (
                <div key={t.id}
                  draggable
                  onDragStart={e => e.dataTransfer.setData('text/plain', t.id)}
                  onClick={() => navigate(t.status === 'completed' ? `/task/${t.id}/estimate` : `/task/${t.id}/status`)}
                  style={{ padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12, color: '#1565c0', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}
                  title="Перетащите в проект"
                >
                  <span style={{ color: '#bbb', fontSize: 10 }}>⠿</span>
                  <span style={{ flex: 1 }}>{t.name || TYPE_LABELS[t.task_type] || t.task_type}</span>
                  <span style={{ fontSize: 10, color: t.status === 'completed' ? '#4caf50' : t.status === 'failed' ? '#f44336' : '#ff9800' }}>●</span>
                </div>
              ))}
          </div>
        )}
      </div>

      {projects.length === 0 && <p style={{ color: '#aaa', fontSize: 13, textAlign: 'center' }}>Нет проектов</p>}
      {projects.map(p => (
        <div key={p.id} style={{ marginBottom: 4 }}>
          <div
            onClick={() => toggleProject(p.id)}
            onDragOver={e => { e.preventDefault(); setDragOver(p.id); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={e => handleDrop(p.id, e)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 4, cursor: 'pointer', background: dragOver === p.id ? '#bbdefb' : expanded === p.id ? '#e3f2fd' : 'transparent', fontSize: 13, fontWeight: 500 }}
          >
            <span style={{ fontSize: 10, color: '#999' }}>{expanded === p.id ? '▼' : '▶'}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{p.name}</span>
          </div>
          {expanded === p.id && (
            <div style={{ paddingLeft: 12 }}>
              {loadingDetail ? <p style={{ color: '#aaa', fontSize: 12, margin: '4px 8px' }}>Загрузка...</p> : (
                <>
                  {totals && totals.tasks_count > 0 && (
                    <div style={{ margin: '6px 8px', padding: '8px', background: '#f0f4ff', borderRadius: 4, fontSize: 11 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Итого по проекту ({totals.tasks_count} смет{totals.tasks_count > 1 ? 'ы' : 'а'}):</div>
                      <div>Работы: {fmt(totals.total_work)} ₽</div>
                      <div>Материалы: {fmt(totals.total_mat)} ₽</div>
                      <div>НДС: {fmt(totals.total_vat)} ₽</div>
                      <div style={{ fontWeight: 700, marginTop: 2 }}>ИТОГО: {fmt(totals.total + totals.total_vat)} ₽</div>
                    </div>
                  )}
                  <button onClick={() => { setImportProjectId(p.id); importRef.current?.click(); }} style={{ width: '100%', padding: '4px 8px', margin: '4px 0', background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 4, cursor: 'pointer', fontSize: 12, color: '#2e7d32' }}>⬆ Импорт Excel</button>
                  {!detail || detail.tasks.length === 0
                    ? <p style={{ color: '#aaa', fontSize: 12, margin: '4px 8px' }}>Нет смет</p>
                    : detail.tasks.map(t => (
                      <div key={t.id} style={{ padding: '3px 8px', borderRadius: 4, fontSize: 12, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span onClick={() => navigate(t.status === 'completed' ? `/task/${t.id}/estimate` : `/task/${t.id}/status`)}
                          style={{ flex: 1, cursor: 'pointer', color: '#1565c0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.name || TYPE_LABELS[t.task_type] || t.task_type}
                          {t.doc_type && <span style={{ marginLeft: 4, fontSize: 10, color: '#888' }}>[{t.doc_type}]</span>}
                        </span>
                        <span style={{ fontSize: 10, color: t.status === 'completed' ? '#4caf50' : t.status === 'failed' ? '#f44336' : '#ff9800' }}>●</span>
                        <button onClick={async (e) => { e.stopPropagation(); if (confirm('Удалить смету?')) { await client.delete(`/tasks/${t.id}`); refreshDetail(p.id); } }}
                          style={{ padding: '1px 5px', fontSize: 10, background: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a', borderRadius: 3, cursor: 'pointer' }}>✕</button>
                      </div>
                    ))}
                </>
              )}
            </div>
          )}
        </div>
      ))}
      <input ref={importRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleImport} />
    </div>
  );
}

const newProjectBtn: React.CSSProperties = { width: '100%', padding: '7px 12px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, marginBottom: 12 };
