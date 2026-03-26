import { useEffect, useRef, useState } from 'react';
import client from '../api/client';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

interface TaskRow { id: string; task_type: string; status: string; created_at: string; }
interface TasksPage { items: TaskRow[]; total: number; page: number; page_size: number; }
interface PriceListInfo { works: { filename: string; updated_at: string } | null; materials: { filename: string; updated_at: string } | null; }

const TASK_TYPES = ['', 'LIST_FROM_TZ', 'LIST_FROM_TZ_PROJECT', 'LIST_FROM_PROJECT', 'RESEARCH_PROJECT', 'SMETA_FROM_LIST', 'SMETA_FROM_TZ', 'SMETA_FROM_TZ_PROJECT', 'SMETA_FROM_PROJECT', 'SMETA_FROM_EDC_PROJECT', 'SMETA_FROM_GRAND_PROJECT', 'SCAN_TO_EXCEL', 'COMPARE_PROJECT_SMETA'];
const STATUSES = ['', 'pending', 'processing', 'completed', 'failed', 'cancelled'];

export default function Admin() {
  const [tab, setTab] = useState<'tasks' | 'pricelists'>('tasks');
  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <h2 style={{ marginTop: 0 }}>Администрирование</h2>
      <div style={{ display: 'flex', borderBottom: '2px solid #e0e0e0', marginBottom: 24 }}>
        {(['tasks', 'pricelists'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '9px 20px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: tab === t ? 700 : 400, color: tab === t ? '#1565c0' : '#555', borderBottom: tab === t ? '2px solid #1565c0' : '2px solid transparent', marginBottom: -2, fontSize: 14 }}>
            {t === 'tasks' ? 'Задачи' : 'Прайс-листы'}
          </button>
        ))}
      </div>
      {tab === 'tasks' ? <TasksTab /> : <PriceListsTab />}
    </div>
  );
}

function TasksTab() {
  const [filters, setFilters] = useState({ status: '', task_type: '', date_from: '', date_to: '' });
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const PAGE_SIZE = 20;

  async function load(p = page) {
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
    } catch { setTasks([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(page); }, [page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); setPage(1); load(1); }} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20, alignItems: 'flex-end' }}>
        <div><label style={lbl}>Статус</label>
          <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} style={sel}>
            {STATUSES.map((s) => <option key={s} value={s}>{s || 'Все'}</option>)}
          </select>
        </div>
        <div><label style={lbl}>Тип</label>
          <select value={filters.task_type} onChange={(e) => setFilters((f) => ({ ...f, task_type: e.target.value }))} style={sel}>
            {TASK_TYPES.map((t) => <option key={t} value={t}>{t || 'Все'}</option>)}
          </select>
        </div>
        <div><label style={lbl}>От</label><input type="date" value={filters.date_from} onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))} style={inp} /></div>
        <div><label style={lbl}>До</label><input type="date" value={filters.date_to} onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))} style={inp} /></div>
        <button type="submit" style={{ padding: '7px 16px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Применить</button>
      </form>

      {loading && <p style={{ color: '#aaa' }}>Загрузка...</p>}
      {!loading && tasks.length === 0 && <p style={{ textAlign: 'center', color: '#aaa', padding: '24px 0' }}>Задач нет</p>}
      {!loading && tasks.length > 0 && (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: '#f5f5f5' }}>
              {['ID', 'Тип', 'Статус', 'Дата', 'Действия'].map((h) => <th key={h} style={th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={tdS}>{t.id.slice(0, 8)}…</td>
                  <td style={tdS}>{t.task_type}</td>
                  <td style={tdS}>{t.status}</td>
                  <td style={tdS}>{new Date(t.created_at).toLocaleString('ru-RU')}</td>
                  <td style={{ ...tdS, whiteSpace: 'nowrap' }}>
                    <button onClick={async () => setDetail((await client.get<Record<string, unknown>>(`/admin/tasks/${t.id}`)).data)} style={aBtn('#1565c0')}>Детали</button>
                    <a href={`${API_BASE}/admin/tasks/${t.id}/download-input/0`} target="_blank" rel="noreferrer" style={{ ...aBtn('#4caf50'), marginLeft: 6, textDecoration: 'none', display: 'inline-block' }}>Скачать</a>
                    <button onClick={async () => { if (confirm(`Удалить ${t.id}?`)) { await client.delete(`/admin/tasks/${t.id}`); load(page); } }} style={{ ...aBtn('#f44336'), marginLeft: 6 }}>Удалить</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center' }}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={aBtn('#757575')}>←</button>
              <span>Стр. {page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={aBtn('#757575')}>→</button>
            </div>
          )}
        </>
      )}

      {detail && (
        <div onClick={() => setDetail(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 8, padding: 24, maxWidth: 600, width: '90%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Детали задачи</h3>
              <button onClick={() => setDetail(null)} style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>
            <pre style={{ fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{JSON.stringify(detail, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

function PriceListsTab() {
  const [info, setInfo] = useState<PriceListInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const worksRef = useRef<HTMLInputElement>(null);
  const matsRef = useRef<HTMLInputElement>(null);

  async function loadInfo() {
    try { setInfo((await client.get<PriceListInfo>('/admin/price-lists/info')).data); }
    catch { setInfo(null); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadInfo(); }, []);

  async function upload(type: 'works' | 'materials', file: File) {
    const fd = new FormData(); fd.append('file', file);
    try { await client.post(`/admin/price-lists/${type}`, fd); await loadInfo(); }
    catch { alert('Ошибка загрузки'); }
  }

  if (loading) return <p style={{ color: '#aaa' }}>Загрузка...</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {(['works', 'materials'] as const).map((type) => {
        const item = type === 'works' ? info?.works : info?.materials;
        const ref = type === 'works' ? worksRef : matsRef;
        const label = type === 'works' ? 'Прайс работ' : 'Прайс материалов';
        return (
          <div key={type} style={{ border: '1px solid #e0e0e0', borderRadius: 6, padding: '16px 20px', maxWidth: 480, background: '#fafafa' }}>
            <h3 style={{ margin: '0 0 8px' }}>{label}</h3>
            {item ? <p style={{ margin: '0 0 10px', fontSize: 14, color: '#555' }}><strong>{item.filename}</strong> — {new Date(item.updated_at).toLocaleString('ru-RU')}</p>
              : <p style={{ margin: '0 0 10px', fontSize: 14, color: '#aaa' }}>Файл не загружен</p>}
            <button onClick={() => ref.current?.click()} style={{ padding: '7px 16px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Загрузить XLSX</button>
            <input ref={ref} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(type, f); e.target.value = ''; }} />
          </div>
        );
      })}
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, marginBottom: 4, color: '#666' };
const sel: React.CSSProperties = { padding: '6px 10px', fontSize: 13, borderRadius: 4, border: '1px solid #ccc' };
const inp: React.CSSProperties = { padding: '6px 10px', fontSize: 13, borderRadius: 4, border: '1px solid #ccc' };
const th: React.CSSProperties = { padding: '8px 10px', textAlign: 'left', border: '1px solid #e0e0e0', fontWeight: 600, whiteSpace: 'nowrap' };
const tdS: React.CSSProperties = { padding: '7px 10px', border: '1px solid #e0e0e0', verticalAlign: 'middle' };
function aBtn(bg: string): React.CSSProperties { return { padding: '4px 10px', background: bg, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }; }
