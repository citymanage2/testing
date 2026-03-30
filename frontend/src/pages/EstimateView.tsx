import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import StatusBadge from '../components/StatusBadge';
import VersionHistoryDrawer from '../components/VersionHistoryDrawer';
import OptimizationChecklist from '../components/OptimizationChecklist';
import AnaloguePanel from '../components/AnaloguePanel';

interface Item {
  id: string; position: number; section: string; type: string; name: string;
  unit: string; quantity: number; price_work: number; price_material: number;
  total: number; is_analogue: boolean; is_optimized: boolean; source_url?: string; comment?: string;
  row_type?: string; sort_order?: number;
}
interface EstimateData { items: Item[]; vat_rate: number; total_work: number; total_mat: number; total: number; total_vat: number; estimate_status: string; }
interface Project { id: string; name: string; }
interface PairResult { ok: boolean; materials_without_work: string[]; works_without_material: string[]; summary: string; }
interface TaskExtras { overhead_pct: number; overhead_sum: number; transport_pct: number; transport_sum: number; contingency_pct: number; contingency_sum: number; }

const ESTIMATE_STATUSES = [
  { value: 'created', label: 'Создана' },
  { value: 'calculated', label: 'Рассчитана себестоимость' },
  { value: 'optimized', label: 'Оптимизирована' },
  { value: 'ready', label: 'Готова к подаче' },
];
const DOC_TYPES = ['Смета', 'ТЗ', 'Проект', 'Дефектная ведомость', 'Акт выполненных работ', 'КС-2', 'КС-3', 'Локальный сметный расчёт', 'Другое'];

export default function EstimateView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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
  const [showKP, setShowKP] = useState(false);
  const [kpSelected, setKpSelected] = useState<Set<string>>(new Set());
  const [kpComment, setKpComment] = useState('');
  const [taskName, setTaskName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [estimateStatus, setEstimateStatus] = useState('');
  const [docType, setDocType] = useState('');
  const [extras, setExtras] = useState<TaskExtras>({ overhead_pct: 0, overhead_sum: 0, transport_pct: 0, transport_sum: 0, contingency_pct: 0, contingency_sum: 0 });
  const [showExtras, setShowExtras] = useState(false);
  const [savingExtras, setSavingExtras] = useState(false);
  const [showAddRow, setShowAddRow] = useState(false);
  const [newRow, setNewRow] = useState({ section: '', type: 'Работа', name: '', unit: 'шт', quantity: '1', work_price: '0', mat_price: '0' });
  const [showSepSheet, setShowSepSheet] = useState(false);
  const [sepSections, setSepSections] = useState<Record<string, boolean>>({});
  const [sepManual, setSepManual] = useState(false);
  const [sepSelectedIds, setSepSelectedIds] = useState<Set<string>>(new Set());
  const [sepIncludeWorks, setSepIncludeWorks] = useState(true);
  const [sepIncludeMaterials, setSepIncludeMaterials] = useState(true);
  const [sepTitle, setSepTitle] = useState('Разделительная ведомость');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [showBatchSection, setShowBatchSection] = useState(false);
  const [batchSectionTarget, setBatchSectionTarget] = useState('');
  const [showBatchCoeff, setShowBatchCoeff] = useState(false);
  const [batchCoeff, setBatchCoeff] = useState('1');
  const nameRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const [itemsR, statusR, extrasR] = await Promise.all([
        client.get<EstimateData>(`/projects/estimates/${id}/items`),
        client.get<{ id: string; name?: string; doc_type?: string; estimate_status?: string }>(`/tasks/${id}/status`),
        client.get<TaskExtras>(`/projects/estimates/${id}/extras`),
      ]);
      setData(itemsR.data);
      setTaskName(statusR.data.name || '');
      setDocType(statusR.data.doc_type || '');
      setEstimateStatus(statusR.data.estimate_status || '');
      setExtras(extrasR.data);
    }
    catch { setError('Ошибка загрузки'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [id]);
  useEffect(() => { if (editingName && nameRef.current) nameRef.current.focus(); }, [editingName]);

  const filtered = data ? data.items.filter(i => {
    if (filterType !== 'all' && i.row_type !== 'section_header') {
      if (filterType === 'works' && i.type !== 'Работа') return false;
      if (filterType === 'materials' && i.type !== 'Материал') return false;
    }
    if (searchQuery && i.row_type !== 'section_header') {
      const q = searchQuery.toLowerCase();
      if (!i.name.toLowerCase().includes(q) && !i.section.toLowerCase().includes(q) && !i.type.toLowerCase().includes(q)) return false;
    }
    return true;
  }) : [];

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
    else if (editCell.field === 'comment') patch.comment = editVal;
    try {
      await client.patch(`/projects/estimates/${id}/items/${item.id}`, patch);
      setEditCell(null);
      load();
    } catch { setEditCell(null); }
  }

  function editInput(item: Item, field: string) {
    const active = editCell?.itemId === item.id && editCell?.field === field;
    const display = field === 'work_price' ? fmt(item.price_work) : field === 'mat_price' ? fmt(item.price_material) : field === 'quantity' ? String(item.quantity) : field === 'comment' ? (item.comment || '') : (item.source_url || '');
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

  function handleImport() {
    alert('Импорт создаёт новую задачу в проекте. Используйте кнопку "Импорт Excel" в боковой панели проекта.');
    if (importRef.current) importRef.current.value = '';
  }

  async function checkPairs() {
    try { setPairResult((await client.get<PairResult>(`/projects/estimates/${id}/check-pairs`)).data); }
    catch { alert('Ошибка проверки'); }
  }

  async function loadProjects() {
    try { setProjects((await client.get<Project[]>('/projects')).data); } catch {}
  }

  async function exportKP() {
    const materials = data?.items.filter(i => i.type === 'Материал') || [];
    const ids = kpSelected.size > 0 ? Array.from(kpSelected) : materials.map(i => i.id);
    const resp = await client.post(`/projects/estimates/${id}/kp-request`, { item_ids: ids, comment: kpComment }, { responseType: 'blob' });
    const url = URL.createObjectURL(resp.data);
    const a = document.createElement('a'); a.href = url; a.download = 'kp_request.xlsx'; a.click();
    URL.revokeObjectURL(url);
    setShowKP(false);
  }

  async function moveToProject(projectId: string) {
    await client.post(`/projects/estimates/${id}/move`, { project_id: projectId });
    setShowMove(false);
    alert('Смета перемещена');
  }

  async function saveName() {
    setEditingName(false);
    await client.patch(`/tasks/${id}/name`, { name: taskName });
  }

  async function saveStatus(val: string) {
    setEstimateStatus(val);
    await client.patch(`/projects/estimates/${id}/status`, { status: val });
  }

  async function saveDocType(val: string) {
    setDocType(val);
    await client.patch(`/tasks/${id}/doc-type`, { doc_type: val });
  }

  async function deleteTask() {
    if (!confirm('Удалить смету? Это действие необратимо.')) return;
    await client.delete(`/tasks/${id}`);
    navigate('/task/create');
  }

  async function deleteItem(itemId: string) {
    if (!confirm('Удалить строку?')) return;
    await client.delete(`/projects/estimates/${id}/items/${itemId}`);
    load();
  }

  async function addRow() {
    await client.post(`/projects/estimates/${id}/items`, {
      section: newRow.section, type: newRow.type, name: newRow.name,
      unit: newRow.unit, quantity: parseFloat(newRow.quantity) || 1,
      work_price: parseFloat(newRow.work_price) || 0,
      mat_price: parseFloat(newRow.mat_price) || 0,
    });
    setShowAddRow(false);
    setNewRow({ section: '', type: 'Работа', name: '', unit: 'шт', quantity: '1', work_price: '0', mat_price: '0' });
    load();
  }

  async function saveExtras() {
    setSavingExtras(true);
    await client.patch(`/projects/estimates/${id}/extras`, extras);
    setSavingExtras(false);
  }

  async function addSection() {
    const name = prompt('Название раздела:');
    if (!name) return;
    await client.post(`/projects/estimates/${id}/items`, {
      section: '', type: 'Работа', name, unit: '', quantity: 0,
      work_price: 0, mat_price: 0, row_type: 'section_header',
    });
    load();
  }

  async function batchDelete() {
    if (!selectedIds.size || !confirm(`Удалить ${selectedIds.size} строк?`)) return;
    await client.post(`/projects/estimates/${id}/items/batch-delete`, { item_ids: Array.from(selectedIds) });
    setSelectedIds(new Set());
    load();
  }

  async function batchMoveSection() {
    await client.post(`/projects/estimates/${id}/items/batch-update`, { item_ids: Array.from(selectedIds), section: batchSectionTarget });
    setSelectedIds(new Set());
    setShowBatchSection(false);
    load();
  }

  async function batchApplyCoeff() {
    const c = parseFloat(batchCoeff);
    if (isNaN(c) || c <= 0) return;
    await client.post(`/projects/estimates/${id}/items/batch-update`, { item_ids: Array.from(selectedIds), coefficient: c });
    setSelectedIds(new Set());
    setShowBatchCoeff(false);
    load();
  }

  function handleDragStart(e: React.DragEvent, itemId: string) {
    setDragItemId(itemId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(targetId);
  }

  async function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    setDragOverId(null);
    if (!dragItemId || dragItemId === targetId || !data) { setDragItemId(null); return; }
    const items = [...data.items];
    const fromIndex = items.findIndex(i => i.id === dragItemId);
    const toIndex = items.findIndex(i => i.id === targetId);
    if (fromIndex < 0 || toIndex < 0) { setDragItemId(null); return; }
    const [moved] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, moved);
    const reorderData = items.map((item, idx) => ({ id: item.id, sort_order: idx * 1.0 }));
    await client.post(`/projects/estimates/${id}/items/reorder`, { items: reorderData });
    setDragItemId(null);
    load();
  }

  function toggleSection(sectionKey: string) {
    const next = new Set(collapsedSections);
    if (next.has(sectionKey)) next.delete(sectionKey); else next.add(sectionKey);
    setCollapsedSections(next);
  }

  function toggleSelect(itemId: string) {
    const next = new Set(selectedIds);
    if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
    setSelectedIds(next);
  }

  function toggleSelectAll() {
    const selectableIds = filtered.filter(i => i.row_type !== 'section_header').map(i => i.id);
    if (selectedIds.size === selectableIds.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(selectableIds));
  }

  async function downloadSepSheet() {
    const body: Record<string, unknown> = { include_works: sepIncludeWorks, include_materials: sepIncludeMaterials, title: sepTitle };
    if (sepManual) body.item_ids = Array.from(sepSelectedIds);
    else body.sections = Object.entries(sepSections).filter(([, v]) => v).map(([k]) => k);
    const resp = await client.post(`/projects/estimates/${id}/separation-sheet`, body, { responseType: 'blob' });
    const url = URL.createObjectURL(resp.data);
    const a = document.createElement('a'); a.href = url; a.download = 'separation_sheet.xlsx'; a.click();
    URL.revokeObjectURL(url);
    setShowSepSheet(false);
  }

  if (loading) return <div style={{ padding: 24 }}>Загрузка...</div>;
  if (error) return <div style={{ padding: 24, color: '#f44336' }}>{error}</div>;
  if (!data) return null;

  const analogueItem = analogueItemId ? data.items.find(i => i.id === analogueItemId) : null;
  const allSections = Array.from(new Set(data.items.map(i => i.section || ''))).filter(Boolean);

  // Compute extra amounts
  const overheadAmt = extras.overhead_sum + data.total * extras.overhead_pct / 100;
  const transportAmt = extras.transport_sum + data.total * extras.transport_pct / 100;
  const contingencyAmt = extras.contingency_sum + data.total * extras.contingency_pct / 100;
  const grandBase = data.total + overheadAmt + transportAmt + contingencyAmt;
  const grandVat = grandBase * data.vat_rate / 100;
  const grandTotal = grandBase + grandVat;

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header with name/status editing */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          {editingName ? (
            <input ref={nameRef} value={taskName} onChange={e => setTaskName(e.target.value)}
              onBlur={saveName} onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
              style={{ fontSize: 20, fontWeight: 600, border: '1px solid #1976d2', borderRadius: 4, padding: '3px 8px', width: '100%' }} />
          ) : (
            <h2 style={{ margin: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }} onClick={() => setEditingName(true)} title="Нажмите чтобы переименовать">
              {taskName || `Смета ${id?.slice(0, 8)}`}
              <span style={{ fontSize: 14, color: '#aaa' }}>✎</span>
            </h2>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <StatusBadge status={estimateStatus} />
            <select value={estimateStatus} onChange={e => saveStatus(e.target.value)} style={{ fontSize: 12, padding: '2px 6px', border: '1px solid #ccc', borderRadius: 4 }}>
              <option value="">— статус —</option>
              {ESTIMATE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select value={docType} onChange={e => saveDocType(e.target.value)} style={{ fontSize: 12, padding: '2px 6px', border: '1px solid #ccc', borderRadius: 4 }}>
              <option value="">— тип документа —</option>
              {DOC_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => setShowHistory(true)} style={btn('#757575')}>История</button>
          <button onClick={() => setShowOpt(true)} style={btn('#ff9800')}>Оптимизировать</button>
          <button onClick={checkPairs} style={btn('#7b1fa2')}>Проверить пары</button>
          <button onClick={() => { setShowMove(false); loadProjects(); setShowMove(true); }} style={btn('#00796b')}>Переместить</button>
          <button onClick={() => { setKpSelected(new Set()); setKpComment(''); setShowKP(true); }} style={btn('#e65100')}>Запрос КП</button>
          <button onClick={() => setShowSepSheet(true)} style={btn('#0288d1')}>Ведомость</button>
          <button onClick={deleteTask} style={btn('#d32f2f')}>Удалить</button>
        </div>
      </div>

      {/* Filters & export */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Фильтр:</span>
        {(['all', 'works', 'materials'] as const).map(t => (
          <button key={t} onClick={() => setFilterType(t)} style={{ padding: '4px 12px', borderRadius: 4, border: '1px solid #ccc', background: filterType === t ? '#1565c0' : '#fff', color: filterType === t ? '#fff' : '#333', cursor: 'pointer', fontSize: 13 }}>
            {{ all: 'Все', works: 'Работы', materials: 'Материалы' }[t]}
          </button>
        ))}
        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Поиск по строкам..." style={{ padding: '4px 10px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13, minWidth: 180 }} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={() => exportEstimate('all')} style={btn('#2e7d32')}>⬇ Все</button>
          <button onClick={() => exportEstimate('works')} style={btn('#1565c0')}>⬇ Работы</button>
          <button onClick={() => exportEstimate('materials')} style={btn('#6a1b9a')}>⬇ Материалы</button>
          <button onClick={addSection} style={btn('#546e7a')}>+ Раздел</button>
          <button onClick={() => setShowAddRow(true)} style={btn('#6a1b9a')}>+ Строка</button>
        </div>
      </div>

      {/* Batch operations bar */}
      {selectedIds.size > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, padding: '8px 12px', background: '#e3f2fd', borderRadius: 6, border: '1px solid #90caf9', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Выбрано: {selectedIds.size}</span>
          <button onClick={batchDelete} style={btn('#d32f2f')}>Удалить выбранные</button>
          <button onClick={() => { setBatchSectionTarget(''); setShowBatchSection(true); }} style={btn('#00796b')}>Переместить в раздел</button>
          <button onClick={() => { setBatchCoeff('1'); setShowBatchCoeff(true); }} style={btn('#e65100')}>× Коэффициент</button>
          <button onClick={() => setSelectedIds(new Set())} style={{ padding: '6px 12px', border: '1px solid #90caf9', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 13 }}>Снять выделение</button>
        </div>
      )}

      {/* Batch move section modal */}
      {showBatchSection && (
        <div style={overlay}>
          <div style={{ ...modal, maxWidth: 360 }}>
            <h3 style={{ margin: '0 0 12px' }}>Переместить в раздел</h3>
            <label style={lbl}>Название раздела
              <input value={batchSectionTarget} onChange={e => setBatchSectionTarget(e.target.value)} style={inp} list="sections-list" />
              <datalist id="sections-list">{allSections.map(s => <option key={s} value={s} />)}</datalist>
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={batchMoveSection} style={btn('#00796b')}>Переместить</button>
              <button onClick={() => setShowBatchSection(false)} style={btn('#757575')}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Batch coefficient modal */}
      {showBatchCoeff && (
        <div style={overlay}>
          <div style={{ ...modal, maxWidth: 360 }}>
            <h3 style={{ margin: '0 0 12px' }}>Применить коэффициент</h3>
            <label style={lbl}>Коэффициент (цены работ и материалов × K)
              <input type="number" min="0.01" step="0.01" value={batchCoeff} onChange={e => setBatchCoeff(e.target.value)} style={inp} />
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={batchApplyCoeff} style={btn('#e65100')}>Применить</button>
              <button onClick={() => setShowBatchCoeff(false)} style={btn('#757575')}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Add row modal */}
      {showAddRow && (
        <div style={overlay}>
          <div style={modal}>
            <h3 style={{ margin: '0 0 14px' }}>Добавить строку</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              {([['Раздел', 'section'], ['Наименование', 'name'], ['Единица измерения', 'unit']] as [string, keyof typeof newRow][]).map(([label, key]) => (
                <label key={key} style={lbl}>{label}<input value={newRow[key]} onChange={e => setNewRow({ ...newRow, [key]: e.target.value })} style={inp} /></label>
              ))}
              <label style={lbl}>Тип
                <select value={newRow.type} onChange={e => setNewRow({ ...newRow, type: e.target.value })} style={inp}>
                  <option>Работа</option><option>Материал</option>
                </select>
              </label>
              {([['Количество', 'quantity'], ['Цена работ', 'work_price'], ['Цена материалов', 'mat_price']] as [string, keyof typeof newRow][]).map(([label, key]) => (
                <label key={key} style={lbl}>{label}<input type="number" value={newRow[key]} onChange={e => setNewRow({ ...newRow, [key]: e.target.value })} style={inp} /></label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={addRow} style={btn('#1976d2')}>Добавить</button>
              <button onClick={() => setShowAddRow(false)} style={btn('#757575')}>Отмена</button>
            </div>
          </div>
        </div>
      )}

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
              <th style={{ padding: '8px 4px', border: '1px solid #e0e0e0', width: 28 }}>
                <input type="checkbox" checked={selectedIds.size > 0 && selectedIds.size === filtered.filter(i => i.row_type !== 'section_header').length} onChange={toggleSelectAll} title="Выбрать все" />
              </th>
              <th style={{ padding: '8px 4px', border: '1px solid #e0e0e0', width: 20 }} title="Перетащить для перестановки">⠿</th>
              {['№', 'Раздел', 'Тип', 'Наименование', 'Ед.', 'Кол-во', 'Цена работ', 'Цена мат.', 'Стоимость', 'Источник', 'Комментарий', ''].map(h => (
                <th key={h} style={{ padding: '8px 8px', textAlign: 'left', border: '1px solid #e0e0e0', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(() => {
              let currentSectionKey = '';
              const rows: React.ReactNode[] = [];
              filtered.forEach(item => {
                if (item.row_type === 'section_header') {
                  currentSectionKey = item.id;
                  const isCollapsed = collapsedSections.has(item.id);
                  rows.push(
                    <tr key={item.id} draggable onDragStart={e => handleDragStart(e, item.id)} onDragOver={e => handleDragOver(e, item.id)} onDrop={e => handleDrop(e, item.id)} onDragLeave={() => setDragOverId(null)}
                      style={{ background: dragOverId === item.id ? '#bbdefb' : '#e8eaf6', cursor: 'grab' }}>
                      <td style={{ ...td, textAlign: 'center' }} />
                      <td style={{ ...td, textAlign: 'center', color: '#9e9e9e', cursor: 'grab' }}>⠿</td>
                      <td colSpan={11} style={{ ...td, fontWeight: 700, fontSize: 13, padding: '6px 10px' }}>
                        <span onClick={() => toggleSection(item.id)} style={{ cursor: 'pointer', userSelect: 'none' }}>
                          {isCollapsed ? '▶' : '▼'} {item.name}
                        </span>
                        <button onClick={() => deleteItem(item.id)} style={{ marginLeft: 8, padding: '1px 6px', background: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>✕</button>
                      </td>
                    </tr>
                  );
                } else {
                  if (currentSectionKey && collapsedSections.has(currentSectionKey)) return;
                  const rowBg = dragOverId === item.id ? '#bbdefb' : item.is_optimized ? '#FFF3CD' : item.is_analogue ? '#C8E6C9' : undefined;
                  rows.push(
                    <tr key={item.id} draggable onDragStart={e => handleDragStart(e, item.id)} onDragOver={e => handleDragOver(e, item.id)} onDrop={e => handleDrop(e, item.id)} onDragLeave={() => setDragOverId(null)}
                      style={{ background: rowBg, outline: selectedIds.has(item.id) ? '2px solid #1976d2' : undefined }}>
                      <td style={{ ...td, textAlign: 'center' }}>
                        <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} />
                      </td>
                      <td style={{ ...td, textAlign: 'center', color: '#bbb', cursor: 'grab' }}>⠿</td>
                      <td style={td}>{item.position}</td>
                      <td style={td}>{item.section}</td>
                      <td style={td}>{item.type}</td>
                      <td style={{ ...td, maxWidth: 280 }}>
                        {item.name}
                        {item.is_analogue && <span style={{ marginLeft: 6, padding: '1px 5px', background: '#4caf50', color: '#fff', borderRadius: 10, fontSize: 10 }}>аналог</span>}
                        {item.is_optimized && <span style={{ marginLeft: 4, padding: '1px 5px', background: '#ff9800', color: '#fff', borderRadius: 10, fontSize: 10 }}>опт</span>}
                      </td>
                      <td style={td}>{item.unit}</td>
                      <td style={{ ...td, minWidth: 60 }}>{editInput(item, 'quantity')}</td>
                      <td style={{ ...td, minWidth: 80 }}>{editInput(item, 'work_price')}</td>
                      <td style={{ ...td, minWidth: 80 }}>{editInput(item, 'mat_price')}</td>
                      <td style={td}>{fmt(item.total)}</td>
                      <td style={{ ...td, minWidth: 120 }}>
                        {item.type === 'Материал' && (
                          item.source_url
                            ? <a href={item.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#1565c0', wordBreak: 'break-all' }}>🔗 {item.source_url.replace(/^https?:\/\//, '').slice(0, 25)}…</a>
                            : editInput(item, 'source_url')
                        )}
                      </td>
                      <td style={{ ...td, minWidth: 120 }}>{editInput(item, 'comment')}</td>
                      <td style={td}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {item.type === 'Материал' && (
                            <button onClick={() => setAnalogueItemId(item.id)} style={{ padding: '2px 8px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Аналоги</button>
                          )}
                          <button onClick={() => deleteItem(item.id)} style={{ padding: '2px 6px', background: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>✕</button>
                        </div>
                      </td>
                    </tr>
                  );
                }
              });
              return rows;
            })()}
          </tbody>
        </table>
      </div>

      {/* Extras (overhead/transport/contingency) */}
      <div style={{ marginBottom: 16 }}>
        <button onClick={() => setShowExtras(!showExtras)} style={{ ...btn('#546e7a'), fontSize: 13 }}>
          {showExtras ? '▲' : '▼'} Накладные, транспорт, непредвиденные расходы
        </button>
        {showExtras && (
          <div style={{ background: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: 6, padding: '12px 16px', marginTop: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
              {([['Накладные расходы', 'overhead_pct', 'overhead_sum'], ['Транспортные расходы', 'transport_pct', 'transport_sum'], ['Непредвиденные расходы', 'contingency_pct', 'contingency_sum']] as [string, keyof TaskExtras, keyof TaskExtras][]).map(([label, pct, sum]) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>%
                      <input type="number" value={extras[pct]} onChange={e => setExtras({ ...extras, [pct]: parseFloat(e.target.value) || 0 })} style={{ ...inp, width: 70 }} />
                    </label>
                    <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>Сумма ₽
                      <input type="number" value={extras[sum]} onChange={e => setExtras({ ...extras, [sum]: parseFloat(e.target.value) || 0 })} style={{ ...inp, width: 100 }} />
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={saveExtras} disabled={savingExtras} style={{ ...btn('#1976d2'), marginTop: 12, fontSize: 13 }}>
              {savingExtras ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        )}
      </div>

      {/* Totals */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', background: '#f9f9f9', padding: '14px 20px', borderRadius: 6, border: '1px solid #e0e0e0' }}>
        {([['Работы', data.total_work], ['Материалы', data.total_mat], ['Итого (базис)', data.total],
          ...(overheadAmt > 0 ? [['Накладные', overheadAmt]] : []),
          ...(transportAmt > 0 ? [['Транспорт', transportAmt]] : []),
          ...(contingencyAmt > 0 ? [['Непредвиденные', contingencyAmt]] : []),
          [`НДС ${data.vat_rate}%`, grandVat], ['ИТОГО с НДС', grandTotal]] as [string, number][]).map(([label, value]) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 12, color: '#888' }}>{label}</span>
            <span style={{ fontSize: 15, fontWeight: label === 'ИТОГО с НДС' ? 700 : 500 }}>{fmt(value)} ₽</span>
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

      {/* KP Request modal */}
      {showKP && data && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: '90%', maxWidth: 600, maxHeight: '80vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 12px' }}>Запрос коммерческих предложений</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Общий комментарий для поставщиков:</label>
              <textarea value={kpComment} onChange={e => setKpComment(e.target.value)} rows={3} placeholder="Пример: Доставка до объекта, оплата по факту, срок — 2 недели..." style={{ width: '100%', padding: '8px', fontSize: 13, borderRadius: 4, border: '1px solid #ccc', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 600 }}>Выберите материалы (по умолчанию — все):</div>
            <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: 4, padding: 8, marginBottom: 16 }}>
              {data.items.filter(i => i.type === 'Материал').map(item => (
                <label key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0', fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={kpSelected.size === 0 || kpSelected.has(item.id)}
                    onChange={e => {
                      const all = data.items.filter(i => i.type === 'Материал');
                      if (kpSelected.size === 0) {
                        const s = new Set(all.map(i => i.id)); s.delete(item.id);
                        setKpSelected(s);
                      } else {
                        const s = new Set(kpSelected);
                        e.target.checked ? s.add(item.id) : s.delete(item.id);
                        if (s.size === all.length) setKpSelected(new Set()); else setKpSelected(s);
                      }
                    }} style={{ marginTop: 2 }} />
                  <span><strong>{item.name}</strong> — {item.quantity} {item.unit}</span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowKP(false)} style={{ padding: '8px 16px', border: 'none', borderRadius: 4, background: '#eee', cursor: 'pointer' }}>Отмена</button>
              <button onClick={exportKP} style={{ padding: '8px 20px', border: 'none', borderRadius: 4, background: '#e65100', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>⬇ Скачать Excel</button>
            </div>
          </div>
        </div>
      )}

      {/* Separation sheet modal */}
      {showSepSheet && (
        <div style={overlay}>
          <div style={modal}>
            <h3 style={{ margin: '0 0 12px' }}>Разделительная ведомость</h3>
            <label style={lbl}>Название документа<input value={sepTitle} onChange={e => setSepTitle(e.target.value)} style={inp} /></label>
            <div style={{ display: 'flex', gap: 12, margin: '8px 0' }}>
              <label style={{ fontSize: 13, display: 'flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={sepIncludeWorks} onChange={e => setSepIncludeWorks(e.target.checked)} />Работы</label>
              <label style={{ fontSize: 13, display: 'flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={sepIncludeMaterials} onChange={e => setSepIncludeMaterials(e.target.checked)} />Материалы</label>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
              <label style={{ fontSize: 13, display: 'flex', gap: 4, alignItems: 'center' }}><input type="radio" checked={!sepManual} onChange={() => setSepManual(false)} />По разделам</label>
              <label style={{ fontSize: 13, display: 'flex', gap: 4, alignItems: 'center' }}><input type="radio" checked={sepManual} onChange={() => setSepManual(true)} />Вручную</label>
            </div>
            {!sepManual ? (
              <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: 4, padding: 8 }}>
                <label style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
                  <input type="checkbox" onChange={e => { const all: Record<string, boolean> = {}; allSections.forEach(s => { all[s] = e.target.checked; }); setSepSections(all); }} />Все разделы
                </label>
                {allSections.map(s => (
                  <label key={s} style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center', marginBottom: 2 }}>
                    <input type="checkbox" checked={!!sepSections[s]} onChange={e => setSepSections({ ...sepSections, [s]: e.target.checked })} />{s}
                  </label>
                ))}
              </div>
            ) : (
              <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: 4, padding: 8 }}>
                {data.items.map(item => (
                  <label key={item.id} style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'flex-start', marginBottom: 2 }}>
                    <input type="checkbox" checked={sepSelectedIds.has(item.id)} onChange={e => {
                      const next = new Set(sepSelectedIds);
                      if (e.target.checked) next.add(item.id); else next.delete(item.id);
                      setSepSelectedIds(next);
                    }} /><span>[{item.type}] {item.name}</span>
                  </label>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={downloadSepSheet} style={btn('#0288d1')}>⬇ Скачать Excel</button>
              <button onClick={() => setShowSepSheet(false)} style={btn('#757575')}>Отмена</button>
            </div>
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
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal: React.CSSProperties = { background: '#fff', borderRadius: 8, padding: 24, width: '90%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto' };
const inp: React.CSSProperties = { padding: '5px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13, width: '100%', boxSizing: 'border-box' };
const lbl: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 13, marginBottom: 8 };
function fmt(v: number) { return v.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function btn(bg: string): React.CSSProperties { return { padding: '6px 12px', background: bg, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 500 }; }
