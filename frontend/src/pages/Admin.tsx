import { useEffect, useRef, useState } from 'react';
import client from '../api/client';

type Tab = 'tasks' | 'pricelists';

interface TaskRow {
  id: string;
  task_type: string;
  status: string;
  created_at: string;
}

interface TasksPage {
  items: TaskRow[];
  total: number;
  page: number;
  page_size: number;
}

interface PriceListInfo {
  works_filename: string | null;
  works_updated_at: string | null;
  materials_filename: string | null;
  materials_updated_at: string | null;
}

const TASK_TYPE_OPTIONS = [
  { value: '', label: 'Все типы' },
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

const STATUS_OPTIONS = [
  { value: '', label: 'Все статусы' },
  { value: 'pending', label: 'Ожидание' },
  { value: 'processing', label: 'Обработка' },
  { value: 'completed', label: 'Завершено' },
  { value: 'failed', label: 'Ошибка' },
  { value: 'cancelled', label: 'Отменено' },
];

export default function Admin() {
  const [activeTab, setActiveTab] = useState<Tab>('tasks');

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <h2 style={{ marginTop: 0 }}>Администрирование</h2>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '2px solid #e0e0e0' }}>
        {(['tasks', 'pricelists'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: activeTab === tab ? 700 : 400,
              color: activeTab === tab ? '#1976d2' : '#555',
              borderBottom: activeTab === tab ? '2px solid #1976d2' : '2px solid transparent',
              marginBottom: -2,
              fontSize: 15,
            }}
          >
            {tab === 'tasks' ? 'Задачи' : 'Прайс-листы'}
          </button>
        ))}
      </div>

      {activeTab === 'tasks' && <TasksTab />}
      {activeTab === 'pricelists' && <PriceListsTab />}
    </div>
  );
}

function TasksTab() {
  const [filters, setFilters] = useState({ status: '', task_type: '', date_from: '', date_to: '' });
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<Record<string, unknown> | null>(null);
  const PAGE_SIZE = 20;

  async function loadTasks(p = page) {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page: p, page_size: PAGE_SIZE };
      if (filters.status) params.status = filters.status;
      if (filters.task_type) params.task_type = filters.task_type;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;

      const { data } = await client.get<TasksPage>('/admin/tasks', { params });
      setTasks(data.items);
      setTotal(data.total);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks(page);
  }, [page]);

  async function handleDelete(id: string) {
    if (!confirm(`Удалить задачу ${id}?`)) return;
    try {
      await client.delete(`/admin/tasks/${id}`);
      loadTasks(page);
    } catch {
      alert('Ошибка при удалении');
    }
  }

  async function handleViewDetail(id: string) {
    try {
      const { data } = await client.get<Record<string, unknown>>(`/admin/tasks/${id}`);
      setDetailData(data);
      setDetailId(id);
    } catch {
      alert('Ошибка загрузки деталей');
    }
  }

  function handleFilterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    loadTasks(1);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      {/* Filters */}
      <form
        onSubmit={handleFilterSubmit}
        style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20, alignItems: 'flex-end' }}
      >
        <div>
          <label style={labelStyle}>Статус</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            style={selectStyle}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Тип задачи</label>
          <select
            value={filters.task_type}
            onChange={(e) => setFilters((f) => ({ ...f, task_type: e.target.value }))}
            style={selectStyle}
          >
            {TASK_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Дата от</label>
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Дата до</label>
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
            style={inputStyle}
          />
        </div>
        <button
          type="submit"
          style={{ padding: '8px 18px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >
          Применить
        </button>
      </form>

      {loading && <p style={{ color: '#aaa' }}>Загрузка...</p>}

      {!loading && (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                {['ID', 'Тип задачи', 'Статус', 'Дата создания', 'Действия'].map((h) => (
                  <th key={h} style={thStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 16, textAlign: 'center', color: '#aaa' }}>
                    Нет задач
                  </td>
                </tr>
              ) : (
                tasks.map((task) => (
                  <tr key={task.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={tdStyle}>{task.id}</td>
                    <td style={tdStyle}>{task.task_type}</td>
                    <td style={tdStyle}>{task.status}</td>
                    <td style={tdStyle}>{new Date(task.created_at).toLocaleString('ru-RU')}</td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => handleViewDetail(task.id)}
                        style={actionBtn('#1976d2')}
                      >
                        Детали
                      </button>
                      <button
                        onClick={() => handleDelete(task.id)}
                        style={{ ...actionBtn('#f44336'), marginLeft: 6 }}
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={actionBtn('#757575')}
              >
                ←
              </button>
              <span>
                Стр. {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={actionBtn('#757575')}
              >
                →
              </button>
            </div>
          )}
        </>
      )}

      {/* Detail modal */}
      {detailId && detailData && (
        <div
          onClick={() => setDetailId(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 8,
              padding: 24,
              maxWidth: 600,
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Детали задачи {detailId}</h3>
              <button
                onClick={() => setDetailId(null)}
                style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
            <pre style={{ fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
              {JSON.stringify(detailData, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function PriceListsTab() {
  const [info, setInfo] = useState<PriceListInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingWorks, setUploadingWorks] = useState(false);
  const [uploadingMaterials, setUploadingMaterials] = useState(false);
  const worksInputRef = useRef<HTMLInputElement>(null);
  const materialsInputRef = useRef<HTMLInputElement>(null);

  async function loadInfo() {
    try {
      const { data } = await client.get<PriceListInfo>('/admin/price-lists/info');
      setInfo(data);
    } catch {
      setInfo(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInfo();
  }, []);

  async function handleUploadWorks(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingWorks(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await client.post('/admin/price-lists/works', fd);
      await loadInfo();
    } catch {
      alert('Ошибка загрузки прайса работ');
    } finally {
      setUploadingWorks(false);
      e.target.value = '';
    }
  }

  async function handleUploadMaterials(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMaterials(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await client.post('/admin/price-lists/materials', fd);
      await loadInfo();
    } catch {
      alert('Ошибка загрузки прайса материалов');
    } finally {
      setUploadingMaterials(false);
      e.target.value = '';
    }
  }

  if (loading) return <p style={{ color: '#aaa' }}>Загрузка...</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Works price list */}
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 8px' }}>Прайс работ</h3>
        {info?.works_filename ? (
          <p style={{ margin: '0 0 8px', color: '#555', fontSize: 14 }}>
            Файл: <strong>{info.works_filename}</strong>
            {info.works_updated_at && (
              <> — обновлён {new Date(info.works_updated_at).toLocaleString('ru-RU')}</>
            )}
          </p>
        ) : (
          <p style={{ margin: '0 0 8px', color: '#aaa', fontSize: 14 }}>Файл не загружен</p>
        )}
        <button
          onClick={() => worksInputRef.current?.click()}
          disabled={uploadingWorks}
          style={{ padding: '8px 16px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, cursor: uploadingWorks ? 'not-allowed' : 'pointer' }}
        >
          {uploadingWorks ? 'Загрузка...' : 'Загрузить XLSX'}
        </button>
        <input
          ref={worksInputRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          onChange={handleUploadWorks}
        />
      </div>

      {/* Materials price list */}
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 8px' }}>Прайс материалов</h3>
        {info?.materials_filename ? (
          <p style={{ margin: '0 0 8px', color: '#555', fontSize: 14 }}>
            Файл: <strong>{info.materials_filename}</strong>
            {info.materials_updated_at && (
              <> — обновлён {new Date(info.materials_updated_at).toLocaleString('ru-RU')}</>
            )}
          </p>
        ) : (
          <p style={{ margin: '0 0 8px', color: '#aaa', fontSize: 14 }}>Файл не загружен</p>
        )}
        <button
          onClick={() => materialsInputRef.current?.click()}
          disabled={uploadingMaterials}
          style={{ padding: '8px 16px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, cursor: uploadingMaterials ? 'not-allowed' : 'pointer' }}
        >
          {uploadingMaterials ? 'Загрузка...' : 'Загрузить XLSX'}
        </button>
        <input
          ref={materialsInputRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          onChange={handleUploadMaterials}
        />
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  marginBottom: 4,
  color: '#666',
};

const selectStyle: React.CSSProperties = {
  padding: '7px 10px',
  fontSize: 13,
  borderRadius: 4,
  border: '1px solid #ccc',
};

const inputStyle: React.CSSProperties = {
  padding: '7px 10px',
  fontSize: 13,
  borderRadius: 4,
  border: '1px solid #ccc',
};

const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  textAlign: 'left',
  border: '1px solid #e0e0e0',
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '7px 10px',
  border: '1px solid #e0e0e0',
  verticalAlign: 'middle',
};

const cardStyle: React.CSSProperties = {
  border: '1px solid #e0e0e0',
  borderRadius: 6,
  padding: '16px 20px',
  background: '#fafafa',
  maxWidth: 500,
};

function actionBtn(bg: string): React.CSSProperties {
  return {
    padding: '4px 10px',
    background: bg,
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
  };
}
