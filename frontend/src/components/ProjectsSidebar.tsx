import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

interface Project { id: string; name: string; }
interface TaskRef { id: string; task_type: string; status: string; }
interface ProjectDetail extends Project { tasks: TaskRef[]; }

export default function ProjectsSidebar() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const navigate = useNavigate();

  async function load() {
    try { setProjects((await client.get<Project[]>('/projects')).data); } catch { setProjects([]); }
  }

  useEffect(() => { load(); }, []);

  async function handleDrop(projectId: string, e: React.DragEvent) {
    e.preventDefault();
    setDragOver(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;
    try {
      await client.post(`/projects/${projectId}/estimates/${taskId}`);
      if (expanded === projectId) {
        setDetail((await client.get<ProjectDetail>(`/projects/${projectId}`)).data);
      }
    } catch { /* ignore */ }
  }

  async function toggleProject(id: string) {
    if (expanded === id) { setExpanded(null); setDetail(null); return; }
    setExpanded(id);
    setLoadingDetail(true);
    try { setDetail((await client.get<ProjectDetail>(`/projects/${id}`)).data); }
    catch { setDetail(null); }
    finally { setLoadingDetail(false); }
  }

  return (
    <div style={{ padding: '12px 8px' }}>
      <button onClick={async () => { const n = prompt('Название проекта:'); if (n?.trim()) { await client.post('/projects', { name: n.trim() }); load(); } }} style={newProjectBtn}>+ Новый проект</button>
      {projects.length === 0 && <p style={{ color: '#aaa', fontSize: 13, textAlign: 'center' }}>Нет проектов</p>}
      {projects.map((p) => (
        <div key={p.id} style={{ marginBottom: 4 }}>
          <div
            onClick={() => toggleProject(p.id)}
            onDragOver={(e) => { e.preventDefault(); setDragOver(p.id); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => handleDrop(p.id, e)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 4, cursor: 'pointer', background: dragOver === p.id ? '#bbdefb' : expanded === p.id ? '#e3f2fd' : 'transparent', fontSize: 13, fontWeight: 500 }}
          >
            <span style={{ fontSize: 10, color: '#999' }}>{expanded === p.id ? '▼' : '▶'}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
          </div>
          {expanded === p.id && (
            <div style={{ paddingLeft: 16 }}>
              {loadingDetail ? <p style={{ color: '#aaa', fontSize: 12, margin: '4px 8px' }}>Загрузка...</p>
                : !detail || detail.tasks.length === 0 ? <p style={{ color: '#aaa', fontSize: 12, margin: '4px 8px' }}>Нет задач</p>
                : detail.tasks.map((t) => (
                  <div key={t.id} onClick={() => navigate(`/task/${t.id}/status`)} style={{ padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12, color: '#1565c0', marginBottom: 2 }}>
                    {t.task_type} ({t.status})
                  </div>
                ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const newProjectBtn: React.CSSProperties = { width: '100%', padding: '7px 12px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, marginBottom: 12 };
