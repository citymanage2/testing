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
      const formData = new FormData();
      formData.append('task_type', taskType);
      if (prompt.trim()) formData.append('prompt', prompt);
      files.forEach((file) => formData.append('files', file));

      const { data } = await client.post('/tasks', formData);
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
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Тип задачи</label>
          <select
            value={taskType}
            onChange={(e) => setTaskType(e.target.value)}
            disabled={loading}
            style={{ width: '100%', padding: '8px 12px', fontSize: 14, borderRadius: 4, border: '1px solid #ccc' }}
          >
            {TASK_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Дополнительные инструкции</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={loading}
            rows={4}
            placeholder="Опишите задачу подробнее (необязательно)"
            style={{ width: '100%', padding: '8px 12px', fontSize: 14, borderRadius: 4, border: '1px solid #ccc', resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Файлы</label>
          <FileUpload files={files} onChange={setFiles} maxFiles={5} maxSizeMb={50} />
        </div>

        {error && <p style={{ color: 'red', margin: 0 }}>{error}</p>}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '10px 0',
            fontSize: 16,
            borderRadius: 4,
            border: 'none',
            background: '#1976d2',
            color: '#fff',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Создание...' : 'Создать задачу'}
        </button>
      </form>
    </div>
  );
}
