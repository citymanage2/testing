import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import StatusBadge from '../components/StatusBadge';
import VersionHistoryDrawer from '../components/VersionHistoryDrawer';
import OptimizationChecklist from '../components/OptimizationChecklist';
import AnaloguePanel from '../components/AnaloguePanel';
import DocumentGenerator from '../components/DocumentGenerator';
import WorkAcceptancePanel from '../components/WorkAcceptancePanel';
import AiAssistModal from '../components/AiAssistModal';
import { C, btnPrimary, btnOutline, btnDanger, btnGhost, INPUT, LBL, CARD, TH, TD, OVERLAY, MODAL } from '../ui';
import BatchAnalogueModal from '../components/BatchAnalogueModal';

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
  { value: 'draft', label: 'Черновик' },
  { value: 'internal_review', label: 'Внутреннее согласование' },
  { value: 'frozen', label: 'Заморожена' },
  { value: 'signed', label: 'Подписана' },
  { value: 'archived', label: 'В архиве' },
];

const ESTIMATE_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['internal_review'],
  internal_review: ['draft', 'frozen'],
  frozen: ['internal_review', 'signed'],
  signed: [],   // LOCKED - cannot transition away
  archived: [],
};


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
  const [projectStage, setProjectStage] = useState<string>('');
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
  const [showBatchAnalogue, setShowBatchAnalogue] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'estimate' | 'acceptance' | 'docs'>('estimate');
  const [showAiAssist, setShowAiAssist] = useState(false);
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
      // Load project stage for lock check
      if ((statusR.data as any).project_id) {
        client.get(`/projects/${(statusR.data as any).project_id}/stage`).then(r => {
          setProjectStage(r.data.stage || '');
        }).catch(() => {});
      } else {
        client.get<{ project_id?: string }>(`/tasks/${id}`).then(taskR => {
          if (taskR.data.project_id) {
            client.get(`/projects/${taskR.data.project_id}/stage`).then(r => {
              setProjectStage(r.data.stage || '');
            }).catch(() => {});
          }
        }).catch(() => {});
      }
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
    if (isLocked) return;
    setEditCell({ itemId: item.id, field });
    const val = field === 'work_price' ? item.price_work : field === 'mat_price' ? item.price_material : field === 'quantity' ? item.quantity : field === 'source_url' ? (item.source_url || '') : field === 'comment' ? (item.comment || '') : '';
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
        style={{ width: '100%', border: `1px solid ${C.primary}`, borderRadius: 4, padding: '2px 6px', fontSize: 13 }} />
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
    if (!val) return;
    const prev = estimateStatus;
    setEstimateStatus(val);
    try {
      await client.patch(`/projects/estimates/${id}/status`, { status: val });
    } catch (e: unknown) {
      setEstimateStatus(prev);
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      alert('Ошибка сохранения статуса' + (msg ? ': ' + msg : ''));
    }
  }

  const changeEstimateStatus = async (newStatus: string) => {
    const prev = estimateStatus;
    setEstimateStatus(newStatus);
    try {
      await client.patch(`/projects/estimates/${id}/status`, { status: newStatus });
    } catch (e: unknown) {
      setEstimateStatus(prev);
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      alert('Ошибка смены статуса сметы' + (msg ? ': ' + msg : ''));
    }
  };

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

  async function saveItemToCatalog(itemId: string) {
    try {
      await client.post(`/catalog/from-estimate-item/${itemId}`);
      alert('Сохранено в каталог расценок');
    } catch { alert('Ошибка сохранения в каталог'); }
  }

  async function batchSaveToCatalog() {
    const ids = Array.from(selectedIds);
    for (const itemId of ids) {
      try { await client.post(`/catalog/from-estimate-item/${itemId}`); } catch {}
    }
    alert(`${ids.length} позиций добавлено в прайс`);
    setSelectedIds(new Set());
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

  if (loading) return <div style={{ padding: 24, color: C.textSec, fontSize: 13 }}>Загрузка...</div>;
  if (error) return <div style={{ padding: 24, color: C.danger, fontSize: 13 }}>{error}</div>;
  if (!data) return null;

  const analogueItem = analogueItemId ? data.items.find(i => i.id === analogueItemId) : null;
  const allSections = Array.from(new Set(data.items.map(i => i.section || ''))).filter(Boolean);

  const LOCKED_STAGES = ['EXECUTION', 'HANDOVER', 'WARRANTY', 'CLOSED'];
  const isLocked = estimateStatus === 'signed' || LOCKED_STAGES.includes(projectStage);

  // Compute extra amounts
  const overheadAmt = extras.overhead_sum + data.total * extras.overhead_pct / 100;
  const transportAmt = extras.transport_sum + data.total * extras.transport_pct / 100;
  const contingencyAmt = extras.contingency_sum + data.total * extras.contingency_pct / 100;
  const grandBase = data.total + overheadAmt + transportAmt + contingencyAmt;
  const grandVat = grandBase * data.vat_rate / 100;
  const grandTotal = grandBase + grandVat;

  return (
    <div style={fullscreen ? { position: 'fixed', inset: 0, zIndex: 200, overflowY: 'auto', background: C.surfaceAlt, padding: '16px 20px' } : { padding: '0 0 16px 0' }}>
      {/* ── Page header ───────────────────────────────────────────────── */}
      <div style={{ ...CARD, marginBottom: 16, padding: '16px 20px' }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            {editingName ? (
              <input ref={nameRef} value={taskName} onChange={e => setTaskName(e.target.value)}
                onBlur={saveName} onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                style={{ ...INPUT, fontSize: 18, fontWeight: 600, padding: '4px 8px' }} />
            ) : (
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.text, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                onClick={() => setEditingName(true)} title="Нажмите для переименования">
                {taskName || `Смета ${id?.slice(0, 8)}`}
                <span style={{ fontSize: 13, color: C.textMuted }}>✎</span>
              </h2>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <StatusBadge status={estimateStatus} />
              <select value={estimateStatus} onChange={e => saveStatus(e.target.value)}
                style={{ ...INPUT, width: 'auto', fontSize: 12, padding: '3px 8px' }}>
                <option value="">— статус —</option>
                {ESTIMATE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              {ESTIMATE_STATUS_TRANSITIONS[estimateStatus]?.map(next => {
                const s = ESTIMATE_STATUSES.find(s => s.value === next);
                return (
                  <button key={next} style={btnOutline('sm')} onClick={() => changeEstimateStatus(next)}>
                    → {s?.label}
                  </button>
                );
              })}
              <select value={docType} onChange={e => saveDocType(e.target.value)}
                style={{ ...INPUT, width: 'auto', fontSize: 12, padding: '3px 8px' }}>
                <option value="">— тип документа —</option>
                {DOC_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* Action groups */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Analysis group */}
            <div style={{ display: 'flex', gap: 4, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 4px' }}>
              <button onClick={() => setShowHistory(true)} style={btnGhost('sm')} title="История версий">⏱ История</button>
              <button onClick={() => setShowOpt(true)} style={btnGhost('sm')} title="Оптимизировать цены">✦ Оптимизация</button>
              <button onClick={checkPairs} style={btnGhost('sm')} title="Проверить пары работа-материал">⚖ Пары</button>
            </div>

            {/* Export group */}
            <div style={{ display: 'flex', gap: 4, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 4px' }}>
              <button onClick={() => exportEstimate('all')} style={btnGhost('sm')}>⬇ Excel</button>
              <button onClick={() => exportEstimate('works')} style={btnGhost('sm')}>Работы</button>
              <button onClick={() => exportEstimate('materials')} style={btnGhost('sm')}>Материалы</button>
            </div>

            {/* More actions */}
            <div style={{ display: 'flex', gap: 4, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 4px' }}>
              <button onClick={() => { setShowMove(false); loadProjects(); setShowMove(true); }} style={btnGhost('sm')}>↗ Переместить</button>
              <button onClick={() => { setKpSelected(new Set()); setKpComment(''); setShowKP(true); }} style={btnGhost('sm')}>📨 Запрос КП</button>
              <button onClick={() => setShowSepSheet(true)} style={btnGhost('sm')}>📑 Ведомость</button>
            </div>

            {/* AI + fullscreen */}
            <div style={{ display: 'flex', gap: 4, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 4px' }}>
              <button onClick={() => setShowAiAssist(true)} style={btnGhost('sm')} title="ИИ-помощник">🤖 ИИ</button>
              <button onClick={() => setFullscreen(f => !f)} style={btnGhost('sm')} title={fullscreen ? 'Свернуть' : 'Полный экран'}>{fullscreen ? '⊡' : '⛶'}</button>
            </div>

            {/* Destructive */}
            <button onClick={deleteTask} style={btnDanger('sm')}>✕ Удалить</button>
          </div>
        </div>
      </div>

      {/* ── Toolbar: filter + search + add ────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 2, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: 3 }}>
          {(['all', 'works', 'materials'] as const).map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              style={{ padding: '4px 12px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: filterType === t ? 600 : 400, background: filterType === t ? C.surface : 'transparent', color: filterType === t ? C.primary : C.textSec, boxShadow: filterType === t ? `0 1px 3px rgba(0,0,0,.1)` : 'none' }}>
              {{ all: 'Все', works: 'Работы', materials: 'Материалы' }[t]}
            </button>
          ))}
        </div>

        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder="🔍 Поиск по строкам..."
          style={{ ...INPUT, width: 200, padding: '5px 10px' }} />

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={addSection} disabled={isLocked} style={{ ...btnOutline('sm'), opacity: isLocked ? 0.4 : 1, pointerEvents: isLocked ? 'none' : 'auto' }}>+ Раздел</button>
          <button onClick={() => setShowAddRow(true)} disabled={isLocked} style={{ ...btnPrimary('sm'), opacity: isLocked ? 0.4 : 1, pointerEvents: isLocked ? 'none' : 'auto' }}>+ Строка</button>
        </div>
      </div>

      {/* ── Batch operations bar ──────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, padding: '8px 14px', background: C.primaryBg, borderRadius: 7, border: `1px solid ${C.primary}33`, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.primary, marginRight: 4 }}>Выбрано: {selectedIds.size}</span>
          <button onClick={batchDelete} style={btnDanger('sm')}>✕ Удалить</button>
          <button onClick={() => { setBatchSectionTarget(''); setShowBatchSection(true); }} style={btnOutline('sm')}>↗ В раздел</button>
          <button onClick={() => { setBatchCoeff('1'); setShowBatchCoeff(true); }} style={btnOutline('sm')}>× Коэффициент</button>
          <button
            onClick={() => setShowBatchAnalogue(true)}
            disabled={data.items.filter(i => selectedIds.has(i.id) && i.type === 'Материал').length === 0}
            style={{ ...btnOutline('sm'), opacity: data.items.filter(i => selectedIds.has(i.id) && i.type === 'Материал').length === 0 ? 0.4 : 1 }}
            title="Подобрать аналоги для выбранных материалов"
          >
            🔍 Аналоги
          </button>
          <button
            onClick={batchSaveToCatalog}
            style={btnOutline('sm')}
            title="Добавить выбранные позиции в прайс-лист"
          >
            📋 В прайс
          </button>
          <button onClick={() => setSelectedIds(new Set())} style={btnGhost('sm')}>Снять выделение</button>
        </div>
      )}

      {/* Batch move section modal */}
      {showBatchSection && (
        <div style={OVERLAY}>
          <div style={{ ...MODAL, maxWidth: 380 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Переместить в раздел</h3>
            <label style={LBL}>Название раздела
              <input value={batchSectionTarget} onChange={e => setBatchSectionTarget(e.target.value)} style={{ ...INPUT, marginTop: 4 }} list="sections-list" />
              <datalist id="sections-list">{allSections.map(s => <option key={s} value={s} />)}</datalist>
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={batchMoveSection} style={btnPrimary()}>Переместить</button>
              <button onClick={() => setShowBatchSection(false)} style={btnOutline()}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Batch coefficient modal */}
      {showBatchCoeff && (
        <div style={OVERLAY}>
          <div style={{ ...MODAL, maxWidth: 380 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Применить коэффициент</h3>
            <label style={LBL}>Коэффициент K (цена × K)
              <input type="number" min="0.01" step="0.01" value={batchCoeff} onChange={e => setBatchCoeff(e.target.value)} style={{ ...INPUT, marginTop: 4 }} />
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={batchApplyCoeff} style={btnPrimary()}>Применить</button>
              <button onClick={() => setShowBatchCoeff(false)} style={btnOutline()}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Add row modal */}
      {showAddRow && (
        <div style={OVERLAY}>
          <div style={{ ...MODAL, maxWidth: 460 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Добавить строку</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              {([['Раздел', 'section'], ['Наименование', 'name'], ['Единица измерения', 'unit']] as [string, keyof typeof newRow][]).map(([label, key]) => (
                <label key={key} style={LBL}>{label}<input value={newRow[key]} onChange={e => setNewRow({ ...newRow, [key]: e.target.value })} style={{ ...INPUT, marginTop: 4 }} /></label>
              ))}
              <label style={LBL}>Тип
                <select value={newRow.type} onChange={e => setNewRow({ ...newRow, type: e.target.value })} style={{ ...INPUT, marginTop: 4 }}>
                  <option>Работа</option><option>Материал</option>
                </select>
              </label>
              {([['Количество', 'quantity'], ['Цена работ', 'work_price'], ['Цена материалов', 'mat_price']] as [string, keyof typeof newRow][]).map(([label, key]) => (
                <label key={key} style={LBL}>{label}<input type="number" value={newRow[key]} onChange={e => setNewRow({ ...newRow, [key]: e.target.value })} style={{ ...INPUT, marginTop: 4 }} /></label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={addRow} style={btnPrimary()}>Добавить</button>
              <button onClick={() => setShowAddRow(false)} style={btnOutline()}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {isLocked && (
        <div style={{
          background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8,
          padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
        }}>
          🔒 <strong>Смета защищена от изменений</strong>
          {estimateStatus === 'signed' ? ' — смета подписана' : ' — проект в стадии реализации'}
        </div>
      )}

      {/* ── Content tabs ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 2, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 7, padding: 3, marginBottom: 14, width: 'fit-content' }}>
        {([['estimate', '📋 Смета'], ['acceptance', '✅ Субподрядчики'], ['docs', '📄 Документы']] as const).map(([t, l]) => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{ padding: '5px 16px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: activeTab === t ? 600 : 400, background: activeTab === t ? C.surface : 'transparent', color: activeTab === t ? C.primary : C.textSec, boxShadow: activeTab === t ? '0 1px 3px rgba(0,0,0,.1)' : 'none' }}>
            {l}
          </button>
        ))}
      </div>

      {activeTab === 'acceptance' && id && data && (
        <WorkAcceptancePanel taskId={id} items={data.items.map(i => ({ id: i.id, name: i.name, unit: i.unit, quantity: i.quantity, type: i.type, section: i.section, row_type: i.row_type }))} />
      )}

      {activeTab === 'docs' && id && (
        <DocumentGenerator taskId={id} />
      )}

      {activeTab === 'estimate' && <>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 12, color: C.textSec, alignItems: 'center' }}>
        <span style={{ background: '#fffbeb', border: `1px solid ${C.warning}40`, color: C.warning, padding: '2px 8px', borderRadius: 4 }}>Оптимизировано</span>
        <span style={{ background: C.successBg, border: `1px solid ${C.success}40`, color: C.success, padding: '2px 8px', borderRadius: 4 }}>Аналог</span>
        <span style={{ color: C.textMuted }}>Цифры кликабельны для редактирования</span>
      </div>

      {/* Table */}
      <div style={{ marginBottom: 20, borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 28 }} />
            <col style={{ width: 36 }} />
            <col style={{ width: 40 }} />
            <col />
            <col style={{ width: 44 }} />
            <col style={{ width: 66 }} />
            <col style={{ width: 82 }} />
            <col style={{ width: 82 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 60 }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ ...TH, width: 28, textAlign: 'center', padding: '8px 4px' }}>
                <input type="checkbox" checked={selectedIds.size > 0 && selectedIds.size === filtered.filter(i => i.row_type !== 'section_header').length} onChange={toggleSelectAll} title="Выбрать все" />
              </th>
              {['№', 'Тип', 'Наименование', 'Ед.', 'Кол-во', 'Цена р.', 'Цена м.', 'Стоимость', ''].map(h => (
                <th key={h} style={TH}>{h}</th>
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
                      style={{ background: dragOverId === item.id ? C.primaryBg : C.surfaceAlt, cursor: 'grab' }}>
                      <td style={{ ...TD, textAlign: 'center' }} />
                      <td colSpan={9} style={{ ...TD, fontWeight: 700, fontSize: 13, padding: '6px 10px', color: C.text }}>
                        <span onClick={() => toggleSection(item.id)} style={{ cursor: 'pointer', userSelect: 'none' }}>
                          {isCollapsed ? '▶' : '▼'} {item.name}
                        </span>
                        <button onClick={() => deleteItem(item.id)} disabled={isLocked} style={{ marginLeft: 8, padding: '1px 6px', background: C.dangerBg, color: C.danger, border: `1px solid ${C.dangerBorder}`, borderRadius: 4, cursor: 'pointer', fontSize: 11, opacity: isLocked ? 0.4 : 1, pointerEvents: isLocked ? 'none' : 'auto' }}>✕</button>
                      </td>
                    </tr>
                  );
                } else {
                  if (currentSectionKey && collapsedSections.has(currentSectionKey)) return;
                  const rowBg = dragOverId === item.id ? C.primaryBg : item.is_optimized ? '#fffbeb' : item.is_analogue ? C.successBg : undefined;
                  rows.push(
                    <tr key={item.id} draggable onDragStart={e => handleDragStart(e, item.id)} onDragOver={e => handleDragOver(e, item.id)} onDrop={e => handleDrop(e, item.id)} onDragLeave={() => setDragOverId(null)}
                      style={{ background: rowBg, outline: selectedIds.has(item.id) ? `2px solid ${C.primary}` : undefined }}>
                      <td style={{ ...TD, textAlign: 'center' }}>
                        <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} />
                      </td>
                      <td style={TD}>{item.position}</td>
                      <td style={{ ...TD, textAlign: 'center', padding: '4px 2px' }}>
                        <span style={{
                          display: 'inline-block', padding: '1px 5px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                          background: item.type === 'Работа' ? '#dbeafe' : '#d1fae5',
                          color: item.type === 'Работа' ? '#1d4ed8' : '#065f46',
                        }}>
                          {item.type === 'Работа' ? 'Р' : 'М'}
                        </span>
                      </td>
                      <td style={{ ...TD, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name}
                        {item.is_analogue && <span style={{ marginLeft: 6, padding: '1px 5px', background: C.success, color: '#fff', borderRadius: 10, fontSize: 10 }}>аналог</span>}
                        {item.is_optimized && <span style={{ marginLeft: 4, padding: '1px 5px', background: C.warning, color: '#fff', borderRadius: 10, fontSize: 10 }}>опт</span>}
                      </td>
                      <td style={TD}>{item.unit}</td>
                      <td style={TD}>{editInput(item, 'quantity')}</td>
                      <td style={TD}>{editInput(item, 'work_price')}</td>
                      <td style={TD}>{editInput(item, 'mat_price')}</td>
                      <td style={TD}>{fmt(item.total)}</td>
                      <td style={TD}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => saveItemToCatalog(item.id)} title="Сохранить в каталог" style={{ padding: '2px 7px', background: C.successBg, color: C.success, border: `1px solid ${C.success}40`, borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>📋</button>
                          <button onClick={() => deleteItem(item.id)} disabled={isLocked} style={{ padding: '2px 6px', background: C.dangerBg, color: C.danger, border: `1px solid ${C.dangerBorder}`, borderRadius: 4, cursor: 'pointer', fontSize: 11, opacity: isLocked ? 0.4 : 1, pointerEvents: isLocked ? 'none' : 'auto' }}>✕</button>
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
        <button onClick={() => setShowExtras(!showExtras)} style={{ ...btnOutline('sm'), fontSize: 13 }}>
          {showExtras ? '▲' : '▼'} Накладные, транспорт, непредвиденные расходы
        </button>
        {showExtras && (
          <div style={{ ...CARD, marginTop: 8, padding: '12px 16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
              {([['Накладные расходы', 'overhead_pct', 'overhead_sum'], ['Транспортные расходы', 'transport_pct', 'transport_sum'], ['Непредвиденные расходы', 'contingency_pct', 'contingency_sum']] as [string, keyof TaskExtras, keyof TaskExtras][]).map(([label, pct, sum]) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{label}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, color: C.textSec }}>%
                      <input type="number" value={extras[pct]} onChange={e => setExtras({ ...extras, [pct]: parseFloat(e.target.value) || 0 })} style={{ ...INPUT, width: 70 }} />
                    </label>
                    <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, color: C.textSec }}>Сумма ₽
                      <input type="number" value={extras[sum]} onChange={e => setExtras({ ...extras, [sum]: parseFloat(e.target.value) || 0 })} style={{ ...INPUT, width: 100 }} />
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={saveExtras} disabled={savingExtras} style={{ ...btnPrimary('sm'), marginTop: 12 }}>
              {savingExtras ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        )}
      </div>

      {/* Totals */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', background: C.primaryBg, padding: '14px 20px', borderRadius: 8, border: `1px solid ${C.primary}22` }}>
        {([['Работы', data.total_work], ['Материалы', data.total_mat], ['Итого (базис)', data.total],
          ...(overheadAmt > 0 ? [['Накладные', overheadAmt]] : []),
          ...(transportAmt > 0 ? [['Транспорт', transportAmt]] : []),
          ...(contingencyAmt > 0 ? [['Непредвиденные', contingencyAmt]] : []),
          [`НДС ${data.vat_rate}%`, grandVat], ['ИТОГО с НДС', grandTotal]] as [string, number][]).map(([label, value]) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 12, color: C.textSec }}>{label}</span>
            <span style={{ fontSize: 15, fontWeight: label === 'ИТОГО с НДС' ? 700 : 500, color: label === 'ИТОГО с НДС' ? C.primary : C.text }}>{fmt(value)} ₽</span>
          </div>
        ))}
      </div>

      {/* Pair check result */}
      {pairResult && (
        <div style={{ marginTop: 16, padding: 16, background: pairResult.ok ? C.successBg : C.warningBg, borderRadius: 8, border: `1px solid ${pairResult.ok ? C.success : C.warning}40` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong style={{ color: pairResult.ok ? C.success : C.warning }}>{pairResult.ok ? '✅ ' : '⚠️ '}{pairResult.summary}</strong>
            <button onClick={() => setPairResult(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: C.textMuted }}>✕</button>
          </div>
          {pairResult.materials_without_work.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <strong style={{ fontSize: 12, color: C.text }}>Материалы без работ:</strong>
              <ul style={{ margin: '4px 0 0 16px', fontSize: 12, color: C.textSec }}>{pairResult.materials_without_work.map(n => <li key={n}>{n}</li>)}</ul>
            </div>
          )}
          {pairResult.works_without_material.length > 0 && (
            <div>
              <strong style={{ fontSize: 12, color: C.text }}>Работы без материалов:</strong>
              <ul style={{ margin: '4px 0 0 16px', fontSize: 12, color: C.textSec }}>{pairResult.works_without_material.map(n => <li key={n}>{n}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      {/* Move modal */}
      {showMove && (
        <div style={OVERLAY}>
          <div style={{ ...MODAL, maxWidth: 400 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Переместить в проект</h3>
            {projects.length === 0
              ? <p style={{ color: C.textMuted, fontSize: 13 }}>Нет проектов</p>
              : projects.map(p => (
                <button key={p.id} onClick={() => moveToProject(p.id)} style={{ display: 'block', width: '100%', padding: '8px 12px', marginBottom: 6, border: `1px solid ${C.border}`, borderRadius: 6, background: C.surface, cursor: 'pointer', textAlign: 'left', fontSize: 13, color: C.text }}>
                  {p.name}
                </button>
              ))}
            <button onClick={() => setShowMove(false)} style={{ ...btnOutline('sm'), marginTop: 8 }}>Отмена</button>
          </div>
        </div>
      )}

      {/* KP Request modal */}
      {showKP && data && (
        <div style={OVERLAY}>
          <div style={{ ...MODAL, maxWidth: 600 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Запрос коммерческих предложений</h3>
            <label style={{ ...LBL, marginBottom: 12 }}>Общий комментарий для поставщиков
              <textarea value={kpComment} onChange={e => setKpComment(e.target.value)} rows={3} placeholder="Пример: Доставка до объекта, оплата по факту, срок — 2 недели..."
                style={{ ...INPUT, marginTop: 4, resize: 'vertical', fontFamily: 'inherit' }} />
            </label>
            <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 600, color: C.text }}>Выберите материалы (по умолчанию — все):</div>
            <div style={{ maxHeight: 280, overflowY: 'auto', border: `1px solid ${C.border}`, borderRadius: 6, padding: 8, marginBottom: 16 }}>
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
                  <span style={{ color: C.text }}><strong>{item.name}</strong> — {item.quantity} {item.unit}</span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowKP(false)} style={btnOutline()}>Отмена</button>
              <button onClick={exportKP} style={btnPrimary()}>⬇ Скачать Excel</button>
            </div>
          </div>
        </div>
      )}

      {/* Separation sheet modal */}
      {showSepSheet && (
        <div style={OVERLAY}>
          <div style={{ ...MODAL, maxWidth: 480 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Разделительная ведомость</h3>
            <label style={LBL}>Название документа
              <input value={sepTitle} onChange={e => setSepTitle(e.target.value)} style={{ ...INPUT, marginTop: 4 }} />
            </label>
            <div style={{ display: 'flex', gap: 12, margin: '10px 0' }}>
              <label style={{ fontSize: 13, display: 'flex', gap: 4, alignItems: 'center', color: C.text }}><input type="checkbox" checked={sepIncludeWorks} onChange={e => setSepIncludeWorks(e.target.checked)} />Работы</label>
              <label style={{ fontSize: 13, display: 'flex', gap: 4, alignItems: 'center', color: C.text }}><input type="checkbox" checked={sepIncludeMaterials} onChange={e => setSepIncludeMaterials(e.target.checked)} />Материалы</label>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
              <label style={{ fontSize: 13, display: 'flex', gap: 4, alignItems: 'center', color: C.text }}><input type="radio" checked={!sepManual} onChange={() => setSepManual(false)} />По разделам</label>
              <label style={{ fontSize: 13, display: 'flex', gap: 4, alignItems: 'center', color: C.text }}><input type="radio" checked={sepManual} onChange={() => setSepManual(true)} />Вручную</label>
            </div>
            {!sepManual ? (
              <div style={{ maxHeight: 200, overflowY: 'auto', border: `1px solid ${C.border}`, borderRadius: 6, padding: 8 }}>
                <label style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4, color: C.textSec }}>
                  <input type="checkbox" onChange={e => { const all: Record<string, boolean> = {}; allSections.forEach(s => { all[s] = e.target.checked; }); setSepSections(all); }} />Все разделы
                </label>
                {allSections.map(s => (
                  <label key={s} style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center', marginBottom: 2, color: C.text }}>
                    <input type="checkbox" checked={!!sepSections[s]} onChange={e => setSepSections({ ...sepSections, [s]: e.target.checked })} />{s}
                  </label>
                ))}
              </div>
            ) : (
              <div style={{ maxHeight: 220, overflowY: 'auto', border: `1px solid ${C.border}`, borderRadius: 6, padding: 8 }}>
                {data.items.map(item => (
                  <label key={item.id} style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'flex-start', marginBottom: 2, color: C.text }}>
                    <input type="checkbox" checked={sepSelectedIds.has(item.id)} onChange={e => {
                      const next = new Set(sepSelectedIds);
                      if (e.target.checked) next.add(item.id); else next.delete(item.id);
                      setSepSelectedIds(next);
                    }} /><span>[{item.type}] {item.name}</span>
                  </label>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={downloadSepSheet} style={btnPrimary()}>⬇ Скачать Excel</button>
              <button onClick={() => setShowSepSheet(false)} style={btnOutline()}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      </>}

      {showHistory && id && <VersionHistoryDrawer taskId={id} onClose={() => setShowHistory(false)} onRestored={() => { setShowHistory(false); load(); }} />}
      {showOpt && id && <OptimizationChecklist taskId={id} onClose={() => setShowOpt(false)} onOptimized={() => { setShowOpt(false); load(); }} />}
      {analogueItemId && id && analogueItem && <AnaloguePanel taskId={id} itemId={analogueItemId} isAnalogue={analogueItem.is_analogue} onClose={() => setAnalogueItemId(null)} onApplied={() => { setAnalogueItemId(null); load(); }} />}
      {showAiAssist && id && <AiAssistModal taskId={id} onClose={() => setShowAiAssist(false)} />}
      {showBatchAnalogue && id && data && (
        <BatchAnalogueModal
          taskId={id}
          items={data.items.filter(i => selectedIds.has(i.id) && i.type === 'Материал')}
          onClose={() => setShowBatchAnalogue(false)}
          onApplied={() => { setShowBatchAnalogue(false); setSelectedIds(new Set()); load(); }}
        />
      )}
      <input ref={importRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleImport} />
    </div>
  );
}

function fmt(v: number) { return v.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
