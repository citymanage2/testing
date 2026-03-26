import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import FileUpload from '../components/FileUpload';

const TASK_TYPES = [
  { value: 'LIST_FROM_TZ', label: 'Перечень из ТЗ' },
  { value: 'LIST_FROM_TZ_PROJECT', label: 'Перечень из ТЗ + проект' },
  { value: 'LIST_FROM_PROJECT', label: 'Перечень из проекта' },
  { value: 'RESEARCH_PROJECT', label: 'Исследование проекта' },
  { value: 'SMETA_FROM_LIST', label: 'Смета из перечня' },
  { value: 'SMETA_FROM_TZ', label: 'Смета из ТЗ' },
  { value: 'SMETA_FROM_TZ_PROJECT', label: 'Смета из ТЗ + проект' },
  { value: 'SMETA_FROM_PROJECT', label: 'Смета из проекта' },
  { value: 'SMETA_FROM_EDC_PROJECT', label: 'Смета из EDC + проект' },
  { value: 'SMETA_FROM_GRAND_PROJECT', label: 'Смета из Grand CAD + проект' },
  { value: 'SCAN_TO_EXCEL', label: 'Скан → Excel' },
  { value: 'COMPARE_PROJECT_SMETA', label: 'Сравнение проекта со сметой' },
];

export default function TaskCreate() {
  const [taskType, setTaskType] = useState(TASK_TYPES[0].value);
  const [prompt, setPrompt] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('task_type', taskType);
      if (prompt.trim()) fd.append('prompt', prompt);
      files.forEach((f) => fd.append('files', f));
      const { data } = await client.post('/tasks', fd);
      navigate(`/task/${data.task_id}/status`);
    } catch {
      setError('Ошибка при создании задачи');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>Создать задачу</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelStyle}>Тип задачи</label>
          <select value={taskType} onChange={(e) => setTaskType(e.target.value)} disabled={loading} style={{ width: '100%', padding: '8px 12px', fontSize: 14, borderRadius: 4, border: '1px solid #ccc' }}>
            {TASK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Дополнительные инструкции</label>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={loading} rows={3} placeholder="Регион, особые условия, уточнения..." style={{ width: '100%', padding: '8px 12px', fontSize: 14, borderRadius: 4, border: '1px solid #ccc', resize: 'vertical', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={labelStyle}>Файлы</label>
          <FileUpload files={files} onChange={setFiles} />
        </div>
        {error && <p style={{ color: '#f44336', margin: 0 }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: '10px', fontSize: 15, borderRadius: 4, border: 'none', background: loading ? '#bdbdbd' : '#1565c0', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
          {loading ? 'Создание...' : 'Создать задачу'}
        </button>
      </form>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 };
