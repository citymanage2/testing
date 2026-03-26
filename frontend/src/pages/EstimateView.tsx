import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import client from '../api/client';
import StatusBadge from '../components/StatusBadge';
import VersionHistoryDrawer from '../components/VersionHistoryDrawer';
import OptimizationChecklist from '../components/OptimizationChecklist';
import AnaloguePanel from '../components/AnaloguePanel';

interface Item {
  id: string; position: number; section: string; type: string; name: string;
  unit: string; quantity: number; price_work: number; price_material: number;
  total: number; is_analogue: boolean; is_optimized: boolean; source_url?: string;
}
interface EstimateData { items: Item[]; vat_rate: number; total_work: number; total_mat: number; total: number; total_vat: number; estimate_status: string; }
interface Project { id: string; name: string; }
interface PairResult { ok: boolean; materials_without_work: string[]; works_without_material: string[]; summary: string; }

export default function EstimateView() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<EstimateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showOpt, setShowOpt] = useState(false);
  const [analogueItemId, setAnalogueItemId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'works' | 'materials'>('all');
  const [editCell, setEditCell] = useState<{ itemId: string; field: string } | null>(null);
  const [editVal, setEditVal] = useState('');
  const [pairResult, setPairResult] = useState<PairResult | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showMove, setShowMove] = useState(false);
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    try { setData((await client.get<EstimateData>(`/projects/estimates/${id}/items`)).data); }
    catch { setError('Ошибка загрузки'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [id]);

  const filtered = data ? data.items.filter(i => filterType === 'all' || (filterType === 'works' ? i.type === 'Работа' : i.type === 'Материал')) : [];

  function startEdit(item: Item, field: string) {
    setEditCell({ itemId: item.id, field });
    const val = field === 'work_price' ? item.price_work : field === 'mat_price' ? item.price_material : field === 'quantity' ? item.quantity : field === 'source_url' ? (item.source_url || '') : '';
    setEditVal(String(val));
  }

  async function saveEdit(item: Item) {
    if (!editCell) return;
    const patch: Record<string, unknown> = {};
    if (editCell.field === 'work_price') patch.work_price = parseFloat(editVal) || 0;
    else if (editCell.field === 'mat_price') patch.mat_price = parseFloat(editVal) || 0;
    else if (editCell.field === 'quantity') patch.quantity = parseFloat(editVal) || 1;
    else if (editCell.field === 'source_url') patch.source_url = editVal.trim();
    try {
      await client.patch(`/projects/estimates/${id}/items/${item.id}`, patch);
      setEditCell(null);
      load();
    } catch { setEditCell(null); }
  }

  function editInput(item: Item, field: string, numeric: boolean) {
    const active = editCell?.itemId === item.id && editCell?.field === field;
    const display = field === 'work_price' ? fmt(item.price_work) : field === 'mat_price' ? fmt(item.price_material) : field === 'quantity' ? String(item.quantity) : item.source_url || '';
    if (active) return (
      <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
        onBlur={() => saveEdit(item)} onKeyDown={e => { if (e.key === 'Enter') saveEdit(item); if (e.key === 'Escape') setEditCell(null); }}
        style={{ width: '100%', border: '1px solid #1565c0', borderRadius: 3, padding: '2px 4px', fontSize: 13 }} />
    );
    return <span onClick={() => startEdit(item, field)} style={{ cursor: 'text', minWidth: 40, display: 'block' }} title="Нажмите для редактирования">{display || '—'}</span>;
  }

  async function exportEstimate(type: string) {
    const resp = await client.get(`/projects/estimates/${id}/export?filter_type=${type}`, { responseType: 'blob' });
    const url = URL.createObjectURL(resp.data);
    const a = document.createElement('a'); a.href = url; a.download = `smeta_${type}.xlsx`; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      // Import into current task's project — need project_id; use task move approach
      alert('Импорт создаёт новую задачу в том же проекте. Используйте кнопку в боковой панели проекта.');
    } finally { setImporting(false); if (importRef.current) importRef.current.value = ''; }
  }

  async function checkPairs() {
    try { setPairResult((await client.get<PairResult>(`/projects/estimates/${id}/check-pairs`)).data); }
    catch { alert('Ошибка проверки'); }
  }

  async function loadProjects() {
    try { setProjects((await client.get<Project[]>('/projects')).data); } catch {}
  }

  async function moveToProject(projectId: string) {
    await client.post(`/projects/estimates/${id}/move`, { project_id: projectId });
    setShowMove(false);
    alert('Смета перемещена');
  }

  if (loading) return <div style={{ padding: 24 }}>Загрузка...</div>;
  if (error) return <div style={{ padding: 24, color: '#f44336' }}>{error}</div>;
  if (!data) return null;

  const analogueItem = analogueItemId ? data.items.find(i => i.id === analogueItemId) : null;

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Смета</h2>
        <StatusBadge status={data.estimate_status} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setShowHistory(true)} style={btn('#757575')}>История</button>
          <button onClick={() => setShowOpt(true)} style={btn('#ff9800')}>Оптимизировать</button>
          <button onClick={checkPairs} style={btn('#7b1fa2')}>Проверить пары</button>
          <button onClick={() => { loadProjects(); setShowMove(true); }} style={btn('#00796b')}>Переместить</button>
        </div>
      </div>

      {/* Filters & export */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Фильтр:</span>
        {(['all', 'works', 'materials'] as const).map(t => (
          <button key={t} onClick={() => setFilterType(t)} style={{ padding: '4px 12px', borderRadius: 4, border: '1px solid #ccc', background: filterType === t ? '#1565c0' : '#fff', color: filterType === t ? '#fff' : '#333', cursor: 'pointer', fontSize: 13 }}>
            {{ all: 'Все', works: 'Работы', materials: 'Материалы' }[t]}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={() => exportEstimate('all')} style={btn('#2e7d32')}>⬇ Все</button>
          <button onClick={() => exportEstimate('works')} style={btn('#1565c0')}>⬇ Работы</button>
          <button onClick={() => exportEstimate('materials')} style={btn('#6a1b9a')}>⬇ Материалы</button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 12, color: '#555' }}>
        <span style={{ background: '#FFF3CD', padding: '2px 8px', borderRadius: 3 }}>Оптимизировано</span>
        <span style={{ background: '#C8E6C9', padding: '2px 8px', borderRadius: 3 }}>Аналог</span>
        <span style={{ color: '#888' }}>Цифры кликабельны для редактирования</span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', marginBottom: 20 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              {['№', 'Раздел', 'Тип', 'Наименование', 'Ед.', 'Кол-во', 'Цена работ', 'Цена мат.', 'Стоимость', 'Источник', ''].map(h => (
                <th key={h} style={{ padding: '8px 8px', textAlign: 'left', border: '1px solid #e0e0e0', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => {
              const rowBg = item.is_optimized ? '#FFF3CD' : item.is_analogue ? '#C8E6C9' : undefined;
              return (
                <tr key={item.id} style={{ background: rowBg }}>
                  <td style={td}>{item.position}</td>
                  <td style={td}>{item.section}</td>
                  <td style={td}>{item.type}</td>
                  <td style={{ ...td, maxWidth: 280 }}>
                    {item.name}
                    {item.is_analogue && <span style={{ marginLeft: 6, padding: '1px 5px', background: '#4caf50', color: '#fff', borderRadius: 10, fontSize: 10 }}>аналог</span>}
                    {item.is_optimized && <span style={{ marginLeft: 4, padding: '1px 5px', background: '#ff9800', color: '#fff', borderRadius: 10, fontSize: 10 }}>опт</span>}
                  </td>
                  <td style={td}>{item.unit}</td>
                  <td style={{ ...td, minWidth: 60 }}>{editInput(item, 'quantity', true)}</td>
                  <td style={{ ...td, minWidth: 80 }}>{editInput(item, 'work_price', true)}</td>
                  <td style={{ ...td, minWidth: 80 }}>{editInput(item, 'mat_price', true)}</td>
                  <td style={td}>{fmt(item.total)}</td>
                  <td style={{ ...td, minWidth: 120 }}>
                    {item.type === 'Материал' && (
                      item.source_url
                        ? <a href={item.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#1565c0', wordBreak: 'break-all' }}>🔗 {item.source_url.replace(/^https?:\/\//, '').slice(0, 25)}…</a>
                        : editInput(item, 'source_url', false)
                    )}
                  </td>
                  <td style={td}>
                    {item.type === 'Материал' && (
                      <button onClick={() => setAnalogueItemId(item.id)} style={{ padding: '2px 8px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Аналоги</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', background: '#f9f9f9', padding: '14px 20px', borderRadius: 6, border: '1px solid #e0e0e0' }}>
        {[['Работы', data.total_work], [`НДС ${data.vat_rate}%`, data.total_vat], ['Материалы', data.total_mat], ['Итого без НДС', data.total], ['ИТОГО', data.total + data.total_vat]].map(([label, value]) => (
          <div key={label as string} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 12, color: '#888' }}>{label}</span>
            <span style={{ fontSize: 16, fontWeight: label === 'ИТОГО' ? 700 : 500 }}>{fmt(value as number)} ₽</span>
          </div>
        ))}
      </div>

      {/* Pair check result */}
      {pairResult && (
        <div style={{ marginTop: 16, padding: 16, background: pairResult.ok ? '#e8f5e9' : '#fff3e0', borderRadius: 6, border: `1px solid ${pairResult.ok ? '#a5d6a7' : '#ffcc80'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong>{pairResult.ok ? '✅ ' : '⚠️ '}{pairResult.summary}</strong>
            <button onClick={() => setPairResult(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
          {pairResult.materials_without_work.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <strong style={{ fontSize: 12 }}>Материалы без работ:</strong>
              <ul style={{ margin: '4px 0 0 16px', fontSize: 12 }}>{pairResult.materials_without_work.map(n => <li key={n}>{n}</li>)}</ul>
            </div>
          )}
          {pairResult.works_without_material.length > 0 && (
            <div>
              <strong style={{ fontSize: 12 }}>Работы без материалов:</strong>
              <ul style={{ margin: '4px 0 0 16px', fontSize: 12 }}>{pairResult.works_without_material.map(n => <li key={n}>{n}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      {/* Move modal */}
      {showMove && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 24, minWidth: 300, maxWidth: 400, width: '90%' }}>
            <h3 style={{ margin: '0 0 16px' }}>Переместить в проект</h3>
            {projects.length === 0 ? <p style={{ color: '#888' }}>Нет проектов</p> : projects.map(p => (
              <button key={p.id} onClick={() => moveToProject(p.id)} style={{ display: 'block', width: '100%', padding: '8px 12px', marginBottom: 8, border: '1px solid #ccc', borderRadius: 4, background: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: 14 }}>{p.name}</button>
            ))}
            <button onClick={() => setShowMove(false)} style={{ marginTop: 8, padding: '6px 16px', border: 'none', borderRadius: 4, background: '#eee', cursor: 'pointer' }}>Отмена</button>
          </div>
        </div>
      )}

      {showHistory && id && <VersionHistoryDrawer taskId={id} onClose={() => setShowHistory(false)} onRestored={() => { setShowHistory(false); load(); }} />}
      {showOpt && id && <OptimizationChecklist taskId={id} onClose={() => setShowOpt(false)} onOptimized={() => { setShowOpt(false); load(); }} />}
      {analogueItemId && id && analogueItem && <AnaloguePanel taskId={id} itemId={analogueItemId} isAnalogue={analogueItem.is_analogue} onClose={() => setAnalogueItemId(null)} onApplied={() => { setAnalogueItemId(null); load(); }} />}
      <input ref={importRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleImport} />
    </div>
  );
}

const td: React.CSSProperties = { padding: '5px 8px', border: '1px solid #e0e0e0', verticalAlign: 'middle' };
function fmt(v: number) { return v.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function btn(bg: string): React.CSSProperties { return { padding: '6px 12px', background: bg, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 500 }; }
