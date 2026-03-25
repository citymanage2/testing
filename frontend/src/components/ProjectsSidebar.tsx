import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

interface Project {
  id: string;
  name: string;
}

interface TaskRef {
  id: string;
  task_type: string;
  status: string;
}

interface ProjectDetail extends Project {
  tasks: TaskRef[];
}

export default function ProjectsSidebar() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const navigate = useNavigate();

  async function loadProjects() {
    try {
      const { data } = await client.get<Project[]>('/projects');
      setProjects(data);
    } catch {
      setProjects([]);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  async function handleNewProject() {
    const name = prompt('Название проекта:');
    if (!name?.trim()) return;
    try {
      await client.post('/projects', { name: name.trim() });
      await loadProjects();
    } catch {
      alert('Ошибка создания проекта');
    }
  }

  const [dragOver, setDragOver] = useState<string | null>(null);

  async function handleDrop(projectId: string, e: React.DragEvent) {
    e.preventDefault();
    setDragOver(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;
    try {
      await client.post(`/projects/${projectId}/estimates/${taskId}`);
      if (expanded === projectId) {
        const { data } = await client.get<ProjectDetail>(`/projects/${projectId}`);
        setProjectDetail(data);
      }
    } catch {
      alert('Ошибка добавления задачи в проект');
    }
  }

  async function handleProjectClick(id: string) {
    if (expanded === id) {
      setExpanded(null);
      setProjectDetail(null);
      return;
    }
    setExpanded(id);
    setLoadingDetail(true);
    try {
      const { data } = await client.get<ProjectDetail>(`/projects/${id}`);
      setProjectDetail(data);
    } catch {
      setProjectDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }

  return (
    <div style={{ padding: '12px 8px' }}>
      <button
        onClick={handleNewProject}
        style={{
          width: '100%',
          padding: '8px 12px',
          background: '#1976d2',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 13,
          marginBottom: 12,
        }}
      >
        + Новый проект
      </button>

      {projects.length === 0 && (
        <p style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: '8px 0' }}>
          Нет проектов
        </p>
      )}

      {projects.map((project) => (
        <div key={project.id} style={{ marginBottom: 4 }}>
          <div
            onClick={() => handleProjectClick(project.id)}
            onDragOver={(e) => { e.preventDefault(); setDragOver(project.id); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => handleDrop(project.id, e)}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '7px 10px',
              borderRadius: 4,
              cursor: 'pointer',
              background: dragOver === project.id ? '#bbdefb' : expanded === project.id ? '#e3f2fd' : 'transparent',
              color: '#333',
              fontSize: 13,
              fontWeight: 500,
              gap: 6,
            }}
          >
            <span style={{ fontSize: 10, color: '#999' }}>{expanded === project.id ? '▼' : '▶'}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {project.name}
            </span>
          </div>

          {expanded === project.id && (
            <div style={{ paddingLeft: 16 }}>
              {loadingDetail ? (
                <p style={{ color: '#aaa', fontSize: 12, padding: '4px 8px', margin: 0 }}>Загрузка...</p>
              ) : !projectDetail || projectDetail.tasks.length === 0 ? (
                <p style={{ color: '#aaa', fontSize: 12, padding: '4px 8px', margin: 0 }}>Нет задач</p>
              ) : (
                projectDetail.tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => navigate(`/task/${task.id}/status`)}
                    style={{
                      padding: '5px 8px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 12,
                      color: '#1976d2',
                      marginBottom: 2,
                    }}
                    title={`${task.task_type} — ${task.status}`}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                      {task.task_type} ({task.status})
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
