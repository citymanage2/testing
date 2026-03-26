import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

interface Project { id: string; name: string; }
interface TaskRef { id: string; task_type: string; status: string; estimate_status?: string; }
interface ProjectDetail extends Project { tasks: TaskRef[]; }
interface Totals { total_work: number; total_mat: number; total: number; total_vat: number; tasks_count: number; }

function fmt(v: number) { return v.toLocaleString('ru-RU', { maximumFractionDigits: 0 }); }

export default function ProjectsSidebar() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [importProjectId, setImportProjectId] = useState<string | null>(null);
  const navigate = useNavigate();

  async function load() {
    try { setProjects((await client.get<Project[]>('/projects')).data); } catch { setProjects([]); }
  }

  useEffect(() => { load(); }, []);

  async function handleDrop(projectId: string, e: React.DragEvent) {
    e.preventDefault(); setDragOver(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;
    try {
      await client.post(`/projects/${projectId}/estimates/${taskId}`);
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
                      <div key={t.id} onClick={() => navigate(t.status === 'completed' ? `/task/${t.id}/estimate` : `/task/${t.id}/status`)}
                        style={{ padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12, color: '#1565c0', marginBottom: 2 }}>
                        {t.task_type} <span style={{ color: '#999' }}>({t.status})</span>
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
