import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
const ESTIMATE_STATUSES = [
    { value: 'draft', label: 'Черновик' },
    { value: 'internal_review', label: 'Внутреннее согласование' },
    { value: 'frozen', label: 'Заморожена' },
    { value: 'signed', label: 'Подписана' },
    { value: 'archived', label: 'В архиве' },
];
const ESTIMATE_STATUS_TRANSITIONS = {
    draft: ['internal_review'],
    internal_review: ['draft', 'frozen'],
    frozen: ['internal_review', 'signed'],
    signed: ['frozen', 'internal_review'],
    archived: [],
};
const DOC_TYPES = ['Смета', 'ТЗ', 'Проект', 'Дефектная ведомость', 'Акт выполненных работ', 'КС-2', 'КС-3', 'Локальный сметный расчёт', 'Другое'];
export default function EstimateView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showHistory, setShowHistory] = useState(false);
    const [showOpt, setShowOpt] = useState(false);
    const [analogueItemId, setAnalogueItemId] = useState(null);
    const [filterType, setFilterType] = useState('all');
    const [editCell, setEditCell] = useState(null);
    const [editVal, setEditVal] = useState('');
    const [pairResult, setPairResult] = useState(null);
    const [projects, setProjects] = useState([]);
    const [showMove, setShowMove] = useState(false);
    const [showKP, setShowKP] = useState(false);
    const [kpSelected, setKpSelected] = useState(new Set());
    const [kpComment, setKpComment] = useState('');
    const [taskName, setTaskName] = useState('');
    const [editingName, setEditingName] = useState(false);
    const [estimateStatus, setEstimateStatus] = useState('');
    const [projectStage, setProjectStage] = useState('');
    const [docType, setDocType] = useState('');
    const [extras, setExtras] = useState({ overhead_pct: 0, overhead_sum: 0, transport_pct: 0, transport_sum: 0, contingency_pct: 0, contingency_sum: 0 });
    const [showExtras, setShowExtras] = useState(false);
    const [savingExtras, setSavingExtras] = useState(false);
    const [showAddRow, setShowAddRow] = useState(false);
    const [newRow, setNewRow] = useState({ section: '', type: 'Работа', name: '', unit: 'шт', quantity: '1', work_price: '0', mat_price: '0' });
    const [addRowMode, setAddRowMode] = useState('manual');
    const [catalogQuery, setCatalogQuery] = useState('');
    const [catalogResults, setCatalogResults] = useState([]);
    const [estimateType, setEstimateType] = useState(null);
    const [showSepSheet, setShowSepSheet] = useState(false);
    const [sepSections, setSepSections] = useState({});
    const [sepManual, setSepManual] = useState(false);
    const [sepSelectedIds, setSepSelectedIds] = useState(new Set());
    const [sepIncludeWorks, setSepIncludeWorks] = useState(true);
    const [sepIncludeMaterials, setSepIncludeMaterials] = useState(true);
    const [sepTitle, setSepTitle] = useState('Разделительная ведомость');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [collapsedSections, setCollapsedSections] = useState(new Set());
    const [dragOverId, setDragOverId] = useState(null);
    const [dragItemId, setDragItemId] = useState(null);
    const [showBatchSection, setShowBatchSection] = useState(false);
    const [batchSectionTarget, setBatchSectionTarget] = useState('');
    const [showBatchCoeff, setShowBatchCoeff] = useState(false);
    const [batchCoeff, setBatchCoeff] = useState('1');
    const [showBatchAnalogue, setShowBatchAnalogue] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    const [activeTab, setActiveTab] = useState('estimate');
    const [showAiAssist, setShowAiAssist] = useState(false);
    const nameRef = useRef(null);
    const importRef = useRef(null);
    async function load() {
        if (!id)
            return;
        setLoading(true);
        try {
            const [itemsR, statusR, extrasR] = await Promise.all([
                client.get(`/projects/estimates/${id}/items`),
                client.get(`/tasks/${id}/status`),
                client.get(`/projects/estimates/${id}/extras`),
            ]);
            setData(itemsR.data);
            setTaskName(statusR.data.name || '');
            setDocType(statusR.data.doc_type || '');
            setEstimateStatus(statusR.data.estimate_status || '');
            setEstimateType(statusR.data.estimate_type || null);
            setExtras(extrasR.data);
            // Load project stage for lock check
            if (statusR.data.project_id) {
                client.get(`/projects/${statusR.data.project_id}/stage`).then(r => {
                    setProjectStage(r.data.stage || '');
                }).catch(() => { });
            }
            else {
                client.get(`/tasks/${id}`).then(taskR => {
                    if (taskR.data.project_id) {
                        client.get(`/projects/${taskR.data.project_id}/stage`).then(r => {
                            setProjectStage(r.data.stage || '');
                        }).catch(() => { });
                    }
                }).catch(() => { });
            }
        }
        catch {
            setError('Ошибка загрузки');
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => { load(); }, [id]);
    useEffect(() => { if (editingName && nameRef.current)
        nameRef.current.focus(); }, [editingName]);
    const filtered = data ? data.items.filter(i => {
        if (filterType !== 'all' && i.row_type !== 'section_header') {
            if (filterType === 'works' && i.type !== 'Работа')
                return false;
            if (filterType === 'materials' && i.type !== 'Материал')
                return false;
        }
        if (searchQuery && i.row_type !== 'section_header') {
            const q = searchQuery.toLowerCase();
            if (!i.name.toLowerCase().includes(q) && !i.section.toLowerCase().includes(q) && !i.type.toLowerCase().includes(q))
                return false;
        }
        return true;
    }) : [];
    function startEdit(item, field) {
        if (isLocked)
            return;
        setEditCell({ itemId: item.id, field });
        const val = field === 'work_price' ? item.price_work : field === 'mat_price' ? item.price_material : field === 'quantity' ? item.quantity : field === 'source_url' ? (item.source_url || '') : field === 'comment' ? (item.comment || '') : '';
        setEditVal(String(val));
    }
    async function saveEdit(item) {
        if (!editCell)
            return;
        const patch = {};
        if (editCell.field === 'work_price')
            patch.work_price = parseFloat(editVal) || 0;
        else if (editCell.field === 'mat_price')
            patch.mat_price = parseFloat(editVal) || 0;
        else if (editCell.field === 'quantity')
            patch.quantity = parseFloat(editVal) || 1;
        else if (editCell.field === 'source_url')
            patch.source_url = editVal.trim();
        else if (editCell.field === 'comment')
            patch.comment = editVal;
        try {
            await client.patch(`/projects/estimates/${id}/items/${item.id}`, patch);
            setEditCell(null);
            load();
        }
        catch {
            setEditCell(null);
        }
    }
    function editInput(item, field) {
        const active = editCell?.itemId === item.id && editCell?.field === field;
        const display = field === 'work_price' ? fmt(item.price_work) : field === 'mat_price' ? fmt(item.price_material) : field === 'quantity' ? String(item.quantity) : field === 'comment' ? (item.comment || '') : (item.source_url || '');
        if (active)
            return (_jsx("input", { autoFocus: true, value: editVal, onChange: e => setEditVal(e.target.value), onBlur: () => saveEdit(item), onKeyDown: e => { if (e.key === 'Enter')
                    saveEdit(item); if (e.key === 'Escape')
                    setEditCell(null); }, style: { width: '100%', border: `1px solid ${C.primary}`, borderRadius: 4, padding: '2px 6px', fontSize: 13 } }));
        return _jsx("span", { onClick: () => startEdit(item, field), style: { cursor: 'text', minWidth: 40, display: 'block' }, title: "\u041D\u0430\u0436\u043C\u0438\u0442\u0435 \u0434\u043B\u044F \u0440\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F", children: display || '—' });
    }
    async function exportEstimate(type) {
        const resp = await client.get(`/projects/estimates/${id}/export?filter_type=${type}`, { responseType: 'blob' });
        const url = URL.createObjectURL(resp.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `smeta_${type}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    }
    function handleImport() {
        alert('Импорт создаёт новую задачу в проекте. Используйте кнопку "Импорт Excel" в боковой панели проекта.');
        if (importRef.current)
            importRef.current.value = '';
    }
    async function checkPairs() {
        try {
            setPairResult((await client.get(`/projects/estimates/${id}/check-pairs`)).data);
        }
        catch {
            alert('Ошибка проверки');
        }
    }
    async function loadProjects() {
        try {
            setProjects((await client.get('/projects')).data);
        }
        catch { }
    }
    async function exportKP() {
        const materials = data?.items.filter(i => i.type === 'Материал') || [];
        const ids = kpSelected.size > 0 ? Array.from(kpSelected) : materials.map(i => i.id);
        const resp = await client.post(`/projects/estimates/${id}/kp-request`, { item_ids: ids, comment: kpComment }, { responseType: 'blob' });
        const url = URL.createObjectURL(resp.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'kp_request.xlsx';
        a.click();
        URL.revokeObjectURL(url);
        setShowKP(false);
    }
    async function moveToProject(projectId) {
        await client.post(`/projects/estimates/${id}/move`, { project_id: projectId });
        setShowMove(false);
        alert('Смета перемещена');
    }
    async function saveName() {
        setEditingName(false);
        await client.patch(`/tasks/${id}/name`, { name: taskName });
    }
    async function saveStatus(val) {
        if (!val)
            return;
        const prev = estimateStatus;
        setEstimateStatus(val);
        try {
            await client.patch(`/projects/estimates/${id}/status`, { status: val });
        }
        catch (e) {
            setEstimateStatus(prev);
            const msg = e?.response?.data?.detail;
            alert('Ошибка сохранения статуса' + (msg ? ': ' + msg : ''));
        }
    }
    const changeEstimateStatus = async (newStatus) => {
        const prev = estimateStatus;
        setEstimateStatus(newStatus);
        try {
            await client.patch(`/projects/estimates/${id}/status`, { status: newStatus });
        }
        catch (e) {
            setEstimateStatus(prev);
            const msg = e?.response?.data?.detail;
            alert('Ошибка смены статуса сметы' + (msg ? ': ' + msg : ''));
        }
    };
    async function saveDocType(val) {
        setDocType(val);
        await client.patch(`/tasks/${id}/doc-type`, { doc_type: val });
    }
    async function deleteTask() {
        if (!confirm('Удалить смету? Это действие необратимо.'))
            return;
        await client.delete(`/tasks/${id}`);
        navigate('/task/create');
    }
    async function deleteItem(itemId) {
        if (!confirm('Удалить строку?'))
            return;
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
        setCatalogQuery('');
        setCatalogResults([]);
        load();
    }
    async function searchCatalog(q) {
        setCatalogQuery(q);
        if (!q.trim()) {
            setCatalogResults([]);
            return;
        }
        try {
            const r = await client.get('/catalog', { params: { q, limit: '30' } });
            setCatalogResults(r.data);
        }
        catch { }
    }
    function applyCatalogItem(item) {
        setNewRow(r => ({
            ...r,
            name: item.name,
            unit: item.unit || r.unit,
            type: item.item_type === 'material' ? 'Материал' : 'Работа',
            work_price: String(item.work_price),
            mat_price: String(item.mat_price),
        }));
        setCatalogQuery('');
        setCatalogResults([]);
        setAddRowMode('manual');
    }
    async function saveExtras() {
        setSavingExtras(true);
        await client.patch(`/projects/estimates/${id}/extras`, extras);
        setSavingExtras(false);
    }
    async function addSection() {
        const name = prompt('Название раздела:');
        if (!name)
            return;
        await client.post(`/projects/estimates/${id}/items`, {
            section: '', type: 'Работа', name, unit: '', quantity: 0,
            work_price: 0, mat_price: 0, row_type: 'section_header',
        });
        load();
    }
    async function batchDelete() {
        if (!selectedIds.size || !confirm(`Удалить ${selectedIds.size} строк?`))
            return;
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
        if (isNaN(c) || c <= 0)
            return;
        await client.post(`/projects/estimates/${id}/items/batch-update`, { item_ids: Array.from(selectedIds), coefficient: c });
        setSelectedIds(new Set());
        setShowBatchCoeff(false);
        load();
    }
    async function saveItemToCatalog(itemId) {
        try {
            await client.post(`/catalog/from-estimate-item/${itemId}`);
            alert('Сохранено в каталог расценок');
        }
        catch {
            alert('Ошибка сохранения в каталог');
        }
    }
    async function batchSaveToCatalog() {
        const ids = Array.from(selectedIds);
        for (const itemId of ids) {
            try {
                await client.post(`/catalog/from-estimate-item/${itemId}`);
            }
            catch { }
        }
        alert(`${ids.length} позиций добавлено в прайс`);
        setSelectedIds(new Set());
    }
    function handleDragStart(e, itemId) {
        setDragItemId(itemId);
        e.dataTransfer.effectAllowed = 'move';
    }
    function handleDragOver(e, targetId) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverId(targetId);
    }
    async function handleDrop(e, targetId) {
        e.preventDefault();
        setDragOverId(null);
        if (!dragItemId || dragItemId === targetId || !data) {
            setDragItemId(null);
            return;
        }
        const items = [...data.items];
        const fromIndex = items.findIndex(i => i.id === dragItemId);
        const toIndex = items.findIndex(i => i.id === targetId);
        if (fromIndex < 0 || toIndex < 0) {
            setDragItemId(null);
            return;
        }
        const [moved] = items.splice(fromIndex, 1);
        items.splice(toIndex, 0, moved);
        const reorderData = items.map((item, idx) => ({ id: item.id, sort_order: idx * 1.0 }));
        await client.post(`/projects/estimates/${id}/items/reorder`, { items: reorderData });
        setDragItemId(null);
        load();
    }
    function toggleSection(sectionKey) {
        const next = new Set(collapsedSections);
        if (next.has(sectionKey))
            next.delete(sectionKey);
        else
            next.add(sectionKey);
        setCollapsedSections(next);
    }
    function toggleSelect(itemId) {
        const next = new Set(selectedIds);
        if (next.has(itemId))
            next.delete(itemId);
        else
            next.add(itemId);
        setSelectedIds(next);
    }
    function toggleSelectAll() {
        const selectableIds = filtered.filter(i => i.row_type !== 'section_header').map(i => i.id);
        if (selectedIds.size === selectableIds.length)
            setSelectedIds(new Set());
        else
            setSelectedIds(new Set(selectableIds));
    }
    async function downloadSepSheet() {
        const body = { include_works: sepIncludeWorks, include_materials: sepIncludeMaterials, title: sepTitle };
        if (sepManual)
            body.item_ids = Array.from(sepSelectedIds);
        else
            body.sections = Object.entries(sepSections).filter(([, v]) => v).map(([k]) => k);
        const resp = await client.post(`/projects/estimates/${id}/separation-sheet`, body, { responseType: 'blob' });
        const url = URL.createObjectURL(resp.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'separation_sheet.xlsx';
        a.click();
        URL.revokeObjectURL(url);
        setShowSepSheet(false);
    }
    if (loading)
        return _jsx("div", { style: { padding: 24, color: C.textSec, fontSize: 13 }, children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430..." });
    if (error)
        return _jsx("div", { style: { padding: 24, color: C.danger, fontSize: 13 }, children: error });
    if (!data)
        return null;
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
    return (_jsxs("div", { style: fullscreen ? { position: 'fixed', inset: 0, zIndex: 200, overflowY: 'auto', background: C.surfaceAlt, padding: '16px 20px' } : { padding: '0 0 16px 0' }, children: [_jsx("div", { style: { ...CARD, marginBottom: 16, padding: '16px 20px' }, children: _jsxs("div", { style: { display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }, children: [_jsxs("div", { style: { flex: 1, minWidth: 200 }, children: [editingName ? (_jsx("input", { ref: nameRef, value: taskName, onChange: e => setTaskName(e.target.value), onBlur: saveName, onKeyDown: e => { if (e.key === 'Enter')
                                        saveName(); if (e.key === 'Escape')
                                        setEditingName(false); }, style: { ...INPUT, fontSize: 18, fontWeight: 600, padding: '4px 8px' } })) : (_jsxs("h2", { style: { margin: 0, fontSize: 18, fontWeight: 700, color: C.text, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }, onClick: () => setEditingName(true), title: "\u041D\u0430\u0436\u043C\u0438\u0442\u0435 \u0434\u043B\u044F \u043F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u044F", children: [taskName || `Смета ${id?.slice(0, 8)}`, _jsx("span", { style: { fontSize: 13, color: C.textMuted }, children: "\u270E" })] })), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }, children: [_jsx(StatusBadge, { status: estimateStatus }), _jsxs("select", { value: estimateStatus, onChange: e => saveStatus(e.target.value), style: { ...INPUT, width: 'auto', fontSize: 12, padding: '3px 8px' }, children: [_jsx("option", { value: "", children: "\u2014 \u0441\u0442\u0430\u0442\u0443\u0441 \u2014" }), ESTIMATE_STATUSES.map(s => _jsx("option", { value: s.value, children: s.label }, s.value))] }), ESTIMATE_STATUS_TRANSITIONS[estimateStatus]?.map(next => {
                                            const s = ESTIMATE_STATUSES.find(s => s.value === next);
                                            return (_jsxs("button", { style: btnOutline('sm'), onClick: () => changeEstimateStatus(next), children: ["\u2192 ", s?.label] }, next));
                                        }), _jsxs("select", { value: docType, onChange: e => saveDocType(e.target.value), style: { ...INPUT, width: 'auto', fontSize: 12, padding: '3px 8px' }, children: [_jsx("option", { value: "", children: "\u2014 \u0442\u0438\u043F \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430 \u2014" }), DOC_TYPES.map(d => _jsx("option", { value: d, children: d }, d))] })] })] }), _jsxs("div", { style: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }, children: [_jsxs("div", { style: { display: 'flex', gap: 4, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 4px' }, children: [_jsx("button", { onClick: () => setShowHistory(true), style: btnGhost('sm'), title: "\u0418\u0441\u0442\u043E\u0440\u0438\u044F \u0432\u0435\u0440\u0441\u0438\u0439", children: "\u23F1 \u0418\u0441\u0442\u043E\u0440\u0438\u044F" }), _jsx("button", { onClick: () => setShowOpt(true), style: btnGhost('sm'), title: "\u041E\u043F\u0442\u0438\u043C\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0446\u0435\u043D\u044B", children: "\u2726 \u041E\u043F\u0442\u0438\u043C\u0438\u0437\u0430\u0446\u0438\u044F" }), _jsx("button", { onClick: checkPairs, style: btnGhost('sm'), title: "\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043F\u0430\u0440\u044B \u0440\u0430\u0431\u043E\u0442\u0430-\u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B", children: "\u2696 \u041F\u0430\u0440\u044B" })] }), _jsxs("div", { style: { display: 'flex', gap: 4, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 4px' }, children: [_jsx("button", { onClick: () => exportEstimate('all'), style: btnGhost('sm'), children: "\u2B07 Excel" }), _jsx("button", { onClick: () => exportEstimate('works'), style: btnGhost('sm'), children: "\u0420\u0430\u0431\u043E\u0442\u044B" }), _jsx("button", { onClick: () => exportEstimate('materials'), style: btnGhost('sm'), children: "\u041C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u044B" })] }), _jsxs("div", { style: { display: 'flex', gap: 4, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 4px' }, children: [_jsx("button", { onClick: () => { setShowMove(false); loadProjects(); setShowMove(true); }, style: btnGhost('sm'), children: "\u2197 \u041F\u0435\u0440\u0435\u043C\u0435\u0441\u0442\u0438\u0442\u044C" }), _jsx("button", { onClick: () => { setKpSelected(new Set()); setKpComment(''); setShowKP(true); }, style: btnGhost('sm'), children: "\uD83D\uDCE8 \u0417\u0430\u043F\u0440\u043E\u0441 \u041A\u041F" }), _jsx("button", { onClick: () => setShowSepSheet(true), style: btnGhost('sm'), children: "\uD83D\uDCD1 \u0412\u0435\u0434\u043E\u043C\u043E\u0441\u0442\u044C" })] }), _jsxs("div", { style: { display: 'flex', gap: 4, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 4px' }, children: [_jsx("button", { onClick: () => setShowAiAssist(true), style: btnGhost('sm'), title: "\u0418\u0418-\u043F\u043E\u043C\u043E\u0449\u043D\u0438\u043A", children: "\uD83E\uDD16 \u0418\u0418" }), _jsx("button", { onClick: () => setFullscreen(f => !f), style: btnGhost('sm'), title: fullscreen ? 'Свернуть' : 'Полный экран', children: fullscreen ? '⊡' : '⛶' })] }), _jsx("button", { onClick: deleteTask, style: btnDanger('sm'), children: "\u2715 \u0423\u0434\u0430\u043B\u0438\u0442\u044C" })] })] }) }), _jsxs("div", { style: { display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }, children: [_jsx("div", { style: { display: 'flex', gap: 2, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: 3 }, children: ['all', 'works', 'materials'].map(t => (_jsx("button", { onClick: () => setFilterType(t), style: { padding: '4px 12px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: filterType === t ? 600 : 400, background: filterType === t ? C.surface : 'transparent', color: filterType === t ? C.primary : C.textSec, boxShadow: filterType === t ? `0 1px 3px rgba(0,0,0,.1)` : 'none' }, children: { all: 'Все', works: 'Работы', materials: 'Материалы' }[t] }, t))) }), _jsx("input", { value: searchQuery, onChange: e => setSearchQuery(e.target.value), placeholder: "\uD83D\uDD0D \u041F\u043E\u0438\u0441\u043A \u043F\u043E \u0441\u0442\u0440\u043E\u043A\u0430\u043C...", style: { ...INPUT, width: 200, padding: '5px 10px' } }), _jsxs("div", { style: { marginLeft: 'auto', display: 'flex', gap: 6 }, children: [_jsx("button", { onClick: addSection, disabled: isLocked, style: { ...btnOutline('sm'), opacity: isLocked ? 0.4 : 1, pointerEvents: isLocked ? 'none' : 'auto' }, children: "+ \u0420\u0430\u0437\u0434\u0435\u043B" }), _jsx("button", { onClick: () => setShowAddRow(true), disabled: isLocked, style: { ...btnPrimary('sm'), opacity: isLocked ? 0.4 : 1, pointerEvents: isLocked ? 'none' : 'auto' }, children: "+ \u0421\u0442\u0440\u043E\u043A\u0430" })] })] }), selectedIds.size > 0 && (_jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, padding: '8px 14px', background: C.primaryBg, borderRadius: 7, border: `1px solid ${C.primary}33`, flexWrap: 'wrap' }, children: [_jsxs("span", { style: { fontSize: 13, fontWeight: 600, color: C.primary, marginRight: 4 }, children: ["\u0412\u044B\u0431\u0440\u0430\u043D\u043E: ", selectedIds.size] }), _jsx("button", { onClick: batchDelete, style: btnDanger('sm'), children: "\u2715 \u0423\u0434\u0430\u043B\u0438\u0442\u044C" }), _jsx("button", { onClick: () => { setBatchSectionTarget(''); setShowBatchSection(true); }, style: btnOutline('sm'), children: "\u2197 \u0412 \u0440\u0430\u0437\u0434\u0435\u043B" }), _jsx("button", { onClick: () => { setBatchCoeff('1'); setShowBatchCoeff(true); }, style: btnOutline('sm'), children: "\u00D7 \u041A\u043E\u044D\u0444\u0444\u0438\u0446\u0438\u0435\u043D\u0442" }), _jsx("button", { onClick: () => setShowBatchAnalogue(true), disabled: data.items.filter(i => selectedIds.has(i.id) && i.type === 'Материал').length === 0, style: { ...btnOutline('sm'), opacity: data.items.filter(i => selectedIds.has(i.id) && i.type === 'Материал').length === 0 ? 0.4 : 1 }, title: "\u041F\u043E\u0434\u043E\u0431\u0440\u0430\u0442\u044C \u0430\u043D\u0430\u043B\u043E\u0433\u0438 \u0434\u043B\u044F \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0445 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u043E\u0432", children: "\uD83D\uDD0D \u0410\u043D\u0430\u043B\u043E\u0433\u0438" }), _jsx("button", { onClick: batchSaveToCatalog, style: btnOutline('sm'), title: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0435 \u043F\u043E\u0437\u0438\u0446\u0438\u0438 \u0432 \u043F\u0440\u0430\u0439\u0441-\u043B\u0438\u0441\u0442", children: "\uD83D\uDCCB \u0412 \u043F\u0440\u0430\u0439\u0441" }), _jsx("button", { onClick: () => setSelectedIds(new Set()), style: btnGhost('sm'), children: "\u0421\u043D\u044F\u0442\u044C \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u0438\u0435" })] })), showBatchSection && (_jsx("div", { style: OVERLAY, children: _jsxs("div", { style: { ...MODAL, maxWidth: 380 }, children: [_jsx("h3", { style: { margin: '0 0 16px', fontSize: 16 }, children: "\u041F\u0435\u0440\u0435\u043C\u0435\u0441\u0442\u0438\u0442\u044C \u0432 \u0440\u0430\u0437\u0434\u0435\u043B" }), _jsxs("label", { style: LBL, children: ["\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0440\u0430\u0437\u0434\u0435\u043B\u0430", _jsx("input", { value: batchSectionTarget, onChange: e => setBatchSectionTarget(e.target.value), style: { ...INPUT, marginTop: 4 }, list: "sections-list" }), _jsx("datalist", { id: "sections-list", children: allSections.map(s => _jsx("option", { value: s }, s)) })] }), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 16 }, children: [_jsx("button", { onClick: batchMoveSection, style: btnPrimary(), children: "\u041F\u0435\u0440\u0435\u043C\u0435\u0441\u0442\u0438\u0442\u044C" }), _jsx("button", { onClick: () => setShowBatchSection(false), style: btnOutline(), children: "\u041E\u0442\u043C\u0435\u043D\u0430" })] })] }) })), showBatchCoeff && (_jsx("div", { style: OVERLAY, children: _jsxs("div", { style: { ...MODAL, maxWidth: 380 }, children: [_jsx("h3", { style: { margin: '0 0 16px', fontSize: 16 }, children: "\u041F\u0440\u0438\u043C\u0435\u043D\u0438\u0442\u044C \u043A\u043E\u044D\u0444\u0444\u0438\u0446\u0438\u0435\u043D\u0442" }), _jsxs("label", { style: LBL, children: ["\u041A\u043E\u044D\u0444\u0444\u0438\u0446\u0438\u0435\u043D\u0442 K (\u0446\u0435\u043D\u0430 \u00D7 K)", _jsx("input", { type: "number", min: "0.01", step: "0.01", value: batchCoeff, onChange: e => setBatchCoeff(e.target.value), style: { ...INPUT, marginTop: 4 } })] }), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 16 }, children: [_jsx("button", { onClick: batchApplyCoeff, style: btnPrimary(), children: "\u041F\u0440\u0438\u043C\u0435\u043D\u0438\u0442\u044C" }), _jsx("button", { onClick: () => setShowBatchCoeff(false), style: btnOutline(), children: "\u041E\u0442\u043C\u0435\u043D\u0430" })] })] }) })), showAddRow && (_jsx("div", { style: OVERLAY, children: _jsxs("div", { style: { ...MODAL, maxWidth: 480, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }, children: [_jsx("h3", { style: { margin: '0 0 12px', fontSize: 16 }, children: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0441\u0442\u0440\u043E\u043A\u0443" }), _jsx("div", { style: { display: 'flex', gap: 0, marginBottom: 12, borderRadius: 6, overflow: 'hidden', border: `1px solid ${C.border}` }, children: ['manual', 'catalog'].map(m => (_jsx("button", { onClick: () => { setAddRowMode(m); setCatalogQuery(''); setCatalogResults([]); }, style: { flex: 1, padding: '7px 0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                                    background: addRowMode === m ? C.primary : C.surfaceAlt, color: addRowMode === m ? '#fff' : C.textSec }, children: m === 'manual' ? 'Вручную' : '📋 Из каталога' }, m))) }), _jsxs("div", { style: { overflow: 'auto', flex: 1 }, children: [addRowMode === 'catalog' && (_jsxs("div", { style: { marginBottom: 10 }, children: [_jsx("input", { value: catalogQuery, onChange: e => searchCatalog(e.target.value), placeholder: "\uD83D\uDD0D \u041F\u043E\u0438\u0441\u043A \u043F\u043E \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0443 \u0440\u0430\u0441\u0446\u0435\u043D\u043E\u043A...", style: { ...INPUT, marginBottom: 6 }, autoFocus: true }), catalogResults.length > 0 && (_jsx("div", { style: { border: `1px solid ${C.border}`, borderRadius: 6, maxHeight: 260, overflow: 'auto' }, children: catalogResults.map(item => (_jsxs("div", { onClick: () => applyCatalogItem(item), style: { padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }, onMouseEnter: e => (e.currentTarget.style.background = C.primaryBg), onMouseLeave: e => (e.currentTarget.style.background = ''), children: [_jsxs("div", { children: [_jsx("div", { style: { fontWeight: 500 }, children: item.name }), _jsxs("div", { style: { fontSize: 11, color: C.textSec, marginTop: 2 }, children: [item.item_type === 'work' ? 'Работа' : 'Материал', item.unit ? ` · ${item.unit}` : ''] })] }), _jsxs("div", { style: { fontSize: 12, color: C.textSec, textAlign: 'right', flexShrink: 0, marginLeft: 12 }, children: [item.work_price > 0 && _jsxs("div", { children: ["\u0420: ", item.work_price.toLocaleString('ru-RU')] }), item.mat_price > 0 && _jsxs("div", { children: ["\u041C: ", item.mat_price.toLocaleString('ru-RU')] })] })] }, item.id))) })), catalogQuery && catalogResults.length === 0 && (_jsx("div", { style: { padding: 12, color: C.textMuted, fontSize: 13, textAlign: 'center' }, children: "\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E" }))] })), _jsxs("div", { style: { display: 'grid', gap: 8 }, children: [[['Раздел', 'section'], ['Наименование', 'name'], ['Единица измерения', 'unit']].map(([label, key]) => (_jsxs("label", { style: LBL, children: [label, _jsx("input", { value: newRow[key], onChange: e => setNewRow({ ...newRow, [key]: e.target.value }), style: { ...INPUT, marginTop: 4 } })] }, key))), _jsxs("label", { style: LBL, children: ["\u0422\u0438\u043F", _jsxs("select", { value: newRow.type, onChange: e => setNewRow({ ...newRow, type: e.target.value }), style: { ...INPUT, marginTop: 4 }, children: [_jsx("option", { children: "\u0420\u0430\u0431\u043E\u0442\u0430" }), _jsx("option", { children: "\u041C\u0430\u0442\u0435\u0440\u0438\u0430\u043B" })] })] }), [['Количество', 'quantity'], ['Цена работ', 'work_price'], ['Цена материалов', 'mat_price']].map(([label, key]) => (_jsxs("label", { style: LBL, children: [label, _jsx("input", { type: "number", value: newRow[key], onChange: e => setNewRow({ ...newRow, [key]: e.target.value }), style: { ...INPUT, marginTop: 4 } })] }, key)))] })] }), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}` }, children: [_jsx("button", { onClick: addRow, style: btnPrimary(), disabled: !newRow.name.trim(), children: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C" }), _jsx("button", { onClick: () => { setShowAddRow(false); setCatalogQuery(''); setCatalogResults([]); }, style: btnOutline(), children: "\u041E\u0442\u043C\u0435\u043D\u0430" })] })] }) })), isLocked && (_jsxs("div", { style: {
                    background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8,
                    padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
                }, children: ["\uD83D\uDD12 ", _jsx("strong", { children: "\u0421\u043C\u0435\u0442\u0430 \u0437\u0430\u0449\u0438\u0449\u0435\u043D\u0430 \u043E\u0442 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0439" }), estimateStatus === 'signed' ? ' — смета подписана' : ' — проект в стадии реализации'] })), estimateType === 'subcontractor' && (_jsxs("div", { style: {
                    background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: 8,
                    padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
                }, children: ["\uD83C\uDFD7 ", _jsx("strong", { children: "\u0421\u043C\u0435\u0442\u0430 \u0441\u0443\u0431\u043F\u043E\u0434\u0440\u044F\u0434\u0447\u0438\u043A\u0430" }), " \u2014 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442\u0441\u044F \u0434\u043B\u044F \u0440\u0430\u0441\u0447\u0451\u0442\u0430 \u043F\u0440\u0438\u0431\u044B\u043B\u0438 \u043F\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0443 (\u0440\u0430\u0437\u043D\u0438\u0446\u0430 \u0441 \u043A\u043B\u0438\u0435\u043D\u0442\u0441\u043A\u043E\u0439 \u0441\u043C\u0435\u0442\u043E\u0439)"] })), _jsx("div", { style: { display: 'flex', gap: 2, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 7, padding: 3, marginBottom: 14, width: 'fit-content' }, children: [
                    ['estimate', '📋 Смета'],
                    ...(estimateType === 'subcontractor' ? [['acceptance', '✅ КС-2 с подрядчиком']] : []),
                    ['docs', '📄 Документы'],
                ].map(([t, l]) => (_jsx("button", { onClick: () => setActiveTab(t), style: { padding: '5px 16px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: activeTab === t ? 600 : 400, background: activeTab === t ? C.surface : 'transparent', color: activeTab === t ? C.primary : C.textSec, boxShadow: activeTab === t ? '0 1px 3px rgba(0,0,0,.1)' : 'none' }, children: l }, t))) }), estimateType !== 'subcontractor' && activeTab === 'acceptance' && (_jsxs("div", { style: { ...CARD, padding: 24, textAlign: 'center', color: C.textMuted, fontSize: 14 }, children: ["\u041A\u0421-2 \u0441 \u043F\u043E\u0434\u0440\u044F\u0434\u0447\u0438\u043A\u043E\u043C \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u0434\u043B\u044F \u043A\u043B\u0438\u0435\u043D\u0442\u0441\u043A\u043E\u0439 \u0441\u043C\u0435\u0442\u044B.", _jsx("br", {}), "\u0421\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u0441\u0443\u0431\u043F\u043E\u0434\u0440\u044F\u0434\u043D\u0443\u044E \u0441\u043C\u0435\u0442\u0443 \u0432\u043E \u0432\u043A\u043B\u0430\u0434\u043A\u0435 \u00AB\u0421\u043C\u0435\u0442\u044B\u00BB \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u043F\u0440\u043E\u0435\u043A\u0442\u0430."] })), activeTab === 'acceptance' && estimateType === 'subcontractor' && id && data && (_jsx(WorkAcceptancePanel, { taskId: id, items: data.items.map(i => ({ id: i.id, name: i.name, unit: i.unit, quantity: i.quantity, type: i.type, section: i.section, row_type: i.row_type })) })), activeTab === 'docs' && id && (_jsx(DocumentGenerator, { taskId: id })), activeTab === 'estimate' && _jsxs(_Fragment, { children: [_jsxs("div", { style: { display: 'flex', gap: 16, marginBottom: 10, fontSize: 12, color: C.textSec, alignItems: 'center' }, children: [_jsx("span", { style: { background: '#fffbeb', border: `1px solid ${C.warning}40`, color: C.warning, padding: '2px 8px', borderRadius: 4 }, children: "\u041E\u043F\u0442\u0438\u043C\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u043D\u043E" }), _jsx("span", { style: { background: C.successBg, border: `1px solid ${C.success}40`, color: C.success, padding: '2px 8px', borderRadius: 4 }, children: "\u0410\u043D\u0430\u043B\u043E\u0433" }), _jsx("span", { style: { color: C.textMuted }, children: "\u0426\u0438\u0444\u0440\u044B \u043A\u043B\u0438\u043A\u0430\u0431\u0435\u043B\u044C\u043D\u044B \u0434\u043B\u044F \u0440\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F" })] }), _jsx("div", { style: { marginBottom: 20, borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }, children: _jsxs("table", { style: { width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }, children: [_jsxs("colgroup", { children: [_jsx("col", { style: { width: 28 } }), _jsx("col", { style: { width: 36 } }), _jsx("col", { style: { width: 40 } }), _jsx("col", {}), _jsx("col", { style: { width: 44 } }), _jsx("col", { style: { width: 66 } }), _jsx("col", { style: { width: 82 } }), _jsx("col", { style: { width: 82 } }), _jsx("col", { style: { width: 90 } }), _jsx("col", { style: { width: 60 } })] }), _jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: { ...TH, width: 28, textAlign: 'center', padding: '8px 4px' }, children: _jsx("input", { type: "checkbox", checked: selectedIds.size > 0 && selectedIds.size === filtered.filter(i => i.row_type !== 'section_header').length, onChange: toggleSelectAll, title: "\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u0432\u0441\u0435" }) }), ['№', 'Тип', 'Наименование', 'Ед.', 'Кол-во', 'Цена р.', 'Цена м.', 'Стоимость', ''].map(h => (_jsx("th", { style: TH, children: h }, h)))] }) }), _jsx("tbody", { children: (() => {
                                        let currentSectionKey = '';
                                        const rows = [];
                                        filtered.forEach(item => {
                                            if (item.row_type === 'section_header') {
                                                currentSectionKey = item.id;
                                                const isCollapsed = collapsedSections.has(item.id);
                                                rows.push(_jsxs("tr", { draggable: true, onDragStart: e => handleDragStart(e, item.id), onDragOver: e => handleDragOver(e, item.id), onDrop: e => handleDrop(e, item.id), onDragLeave: () => setDragOverId(null), style: { background: dragOverId === item.id ? C.primaryBg : C.surfaceAlt, cursor: 'grab' }, children: [_jsx("td", { style: { ...TD, textAlign: 'center' } }), _jsxs("td", { colSpan: 9, style: { ...TD, fontWeight: 700, fontSize: 13, padding: '6px 10px', color: C.text }, children: [_jsxs("span", { onClick: () => toggleSection(item.id), style: { cursor: 'pointer', userSelect: 'none' }, children: [isCollapsed ? '▶' : '▼', " ", item.name] }), _jsx("button", { onClick: () => deleteItem(item.id), disabled: isLocked, style: { marginLeft: 8, padding: '1px 6px', background: C.dangerBg, color: C.danger, border: `1px solid ${C.dangerBorder}`, borderRadius: 4, cursor: 'pointer', fontSize: 11, opacity: isLocked ? 0.4 : 1, pointerEvents: isLocked ? 'none' : 'auto' }, children: "\u2715" })] })] }, item.id));
                                            }
                                            else {
                                                if (currentSectionKey && collapsedSections.has(currentSectionKey))
                                                    return;
                                                const rowBg = dragOverId === item.id ? C.primaryBg : item.is_optimized ? '#fffbeb' : item.is_analogue ? C.successBg : undefined;
                                                rows.push(_jsxs("tr", { draggable: true, onDragStart: e => handleDragStart(e, item.id), onDragOver: e => handleDragOver(e, item.id), onDrop: e => handleDrop(e, item.id), onDragLeave: () => setDragOverId(null), style: { background: rowBg, outline: selectedIds.has(item.id) ? `2px solid ${C.primary}` : undefined }, children: [_jsx("td", { style: { ...TD, textAlign: 'center' }, children: _jsx("input", { type: "checkbox", checked: selectedIds.has(item.id), onChange: () => toggleSelect(item.id) }) }), _jsx("td", { style: TD, children: item.position }), _jsx("td", { style: { ...TD, textAlign: 'center', padding: '4px 2px' }, children: _jsx("span", { style: {
                                                                    display: 'inline-block', padding: '1px 5px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                                                                    background: item.type === 'Работа' ? '#dbeafe' : '#d1fae5',
                                                                    color: item.type === 'Работа' ? '#1d4ed8' : '#065f46',
                                                                }, children: item.type === 'Работа' ? 'Р' : 'М' }) }), _jsxs("td", { style: { ...TD, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: [item.name, item.is_analogue && _jsx("span", { style: { marginLeft: 6, padding: '1px 5px', background: C.success, color: '#fff', borderRadius: 10, fontSize: 10 }, children: "\u0430\u043D\u0430\u043B\u043E\u0433" }), item.is_optimized && _jsx("span", { style: { marginLeft: 4, padding: '1px 5px', background: C.warning, color: '#fff', borderRadius: 10, fontSize: 10 }, children: "\u043E\u043F\u0442" })] }), _jsx("td", { style: TD, children: item.unit }), _jsx("td", { style: TD, children: editInput(item, 'quantity') }), _jsx("td", { style: TD, children: editInput(item, 'work_price') }), _jsx("td", { style: TD, children: editInput(item, 'mat_price') }), _jsx("td", { style: TD, children: fmt(item.total) }), _jsx("td", { style: TD, children: _jsxs("div", { style: { display: 'flex', gap: 4 }, children: [_jsx("button", { onClick: () => saveItemToCatalog(item.id), title: "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0432 \u043A\u0430\u0442\u0430\u043B\u043E\u0433", style: { padding: '2px 7px', background: C.successBg, color: C.success, border: `1px solid ${C.success}40`, borderRadius: 4, cursor: 'pointer', fontSize: 11 }, children: "\uD83D\uDCCB" }), _jsx("button", { onClick: () => deleteItem(item.id), disabled: isLocked, style: { padding: '2px 6px', background: C.dangerBg, color: C.danger, border: `1px solid ${C.dangerBorder}`, borderRadius: 4, cursor: 'pointer', fontSize: 11, opacity: isLocked ? 0.4 : 1, pointerEvents: isLocked ? 'none' : 'auto' }, children: "\u2715" })] }) })] }, item.id));
                                            }
                                        });
                                        return rows;
                                    })() })] }) }), _jsxs("div", { style: { marginBottom: 16 }, children: [_jsxs("button", { onClick: () => setShowExtras(!showExtras), style: { ...btnOutline('sm'), fontSize: 13 }, children: [showExtras ? '▲' : '▼', " \u041D\u0430\u043A\u043B\u0430\u0434\u043D\u044B\u0435, \u0442\u0440\u0430\u043D\u0441\u043F\u043E\u0440\u0442, \u043D\u0435\u043F\u0440\u0435\u0434\u0432\u0438\u0434\u0435\u043D\u043D\u044B\u0435 \u0440\u0430\u0441\u0445\u043E\u0434\u044B"] }), showExtras && (_jsxs("div", { style: { ...CARD, marginTop: 8, padding: '12px 16px' }, children: [_jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }, children: [['Накладные расходы', 'overhead_pct', 'overhead_sum'], ['Транспортные расходы', 'transport_pct', 'transport_sum'], ['Непредвиденные расходы', 'contingency_pct', 'contingency_sum']].map(([label, pct, sum]) => (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 4 }, children: [_jsx("span", { style: { fontSize: 12, fontWeight: 600, color: C.text }, children: label }), _jsxs("div", { style: { display: 'flex', gap: 8 }, children: [_jsxs("label", { style: { fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, color: C.textSec }, children: ["%", _jsx("input", { type: "number", value: extras[pct], onChange: e => setExtras({ ...extras, [pct]: parseFloat(e.target.value) || 0 }), style: { ...INPUT, width: 70 } })] }), _jsxs("label", { style: { fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, color: C.textSec }, children: ["\u0421\u0443\u043C\u043C\u0430 \u20BD", _jsx("input", { type: "number", value: extras[sum], onChange: e => setExtras({ ...extras, [sum]: parseFloat(e.target.value) || 0 }), style: { ...INPUT, width: 100 } })] })] })] }, label))) }), _jsx("button", { onClick: saveExtras, disabled: savingExtras, style: { ...btnPrimary('sm'), marginTop: 12 }, children: savingExtras ? 'Сохранение...' : 'Сохранить' })] }))] }), _jsx("div", { style: { display: 'flex', gap: 20, flexWrap: 'wrap', background: C.primaryBg, padding: '14px 20px', borderRadius: 8, border: `1px solid ${C.primary}22` }, children: [['Работы', data.total_work], ['Материалы', data.total_mat], ['Итого (базис)', data.total],
                            ...(overheadAmt > 0 ? [['Накладные', overheadAmt]] : []),
                            ...(transportAmt > 0 ? [['Транспорт', transportAmt]] : []),
                            ...(contingencyAmt > 0 ? [['Непредвиденные', contingencyAmt]] : []),
                            [`НДС ${data.vat_rate}%`, grandVat], ['ИТОГО с НДС', grandTotal]].map(([label, value]) => (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 2 }, children: [_jsx("span", { style: { fontSize: 12, color: C.textSec }, children: label }), _jsxs("span", { style: { fontSize: 15, fontWeight: label === 'ИТОГО с НДС' ? 700 : 500, color: label === 'ИТОГО с НДС' ? C.primary : C.text }, children: [fmt(value), " \u20BD"] })] }, label))) }), pairResult && (_jsxs("div", { style: { marginTop: 16, padding: 16, background: pairResult.ok ? C.successBg : C.warningBg, borderRadius: 8, border: `1px solid ${pairResult.ok ? C.success : C.warning}40` }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }, children: [_jsxs("strong", { style: { color: pairResult.ok ? C.success : C.warning }, children: [pairResult.ok ? '✅ ' : '⚠️ ', pairResult.summary] }), _jsx("button", { onClick: () => setPairResult(null), style: { border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: C.textMuted }, children: "\u2715" })] }), pairResult.materials_without_work.length > 0 && (_jsxs("div", { style: { marginBottom: 6 }, children: [_jsx("strong", { style: { fontSize: 12, color: C.text }, children: "\u041C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u044B \u0431\u0435\u0437 \u0440\u0430\u0431\u043E\u0442:" }), _jsx("ul", { style: { margin: '4px 0 0 16px', fontSize: 12, color: C.textSec }, children: pairResult.materials_without_work.map(n => _jsx("li", { children: n }, n)) })] })), pairResult.works_without_material.length > 0 && (_jsxs("div", { children: [_jsx("strong", { style: { fontSize: 12, color: C.text }, children: "\u0420\u0430\u0431\u043E\u0442\u044B \u0431\u0435\u0437 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u043E\u0432:" }), _jsx("ul", { style: { margin: '4px 0 0 16px', fontSize: 12, color: C.textSec }, children: pairResult.works_without_material.map(n => _jsx("li", { children: n }, n)) })] }))] })), showMove && (_jsx("div", { style: OVERLAY, children: _jsxs("div", { style: { ...MODAL, maxWidth: 400 }, children: [_jsx("h3", { style: { margin: '0 0 16px', fontSize: 16 }, children: "\u041F\u0435\u0440\u0435\u043C\u0435\u0441\u0442\u0438\u0442\u044C \u0432 \u043F\u0440\u043E\u0435\u043A\u0442" }), projects.length === 0
                                    ? _jsx("p", { style: { color: C.textMuted, fontSize: 13 }, children: "\u041D\u0435\u0442 \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u0432" })
                                    : projects.map(p => (_jsx("button", { onClick: () => moveToProject(p.id), style: { display: 'block', width: '100%', padding: '8px 12px', marginBottom: 6, border: `1px solid ${C.border}`, borderRadius: 6, background: C.surface, cursor: 'pointer', textAlign: 'left', fontSize: 13, color: C.text }, children: p.name }, p.id))), _jsx("button", { onClick: () => setShowMove(false), style: { ...btnOutline('sm'), marginTop: 8 }, children: "\u041E\u0442\u043C\u0435\u043D\u0430" })] }) })), showKP && data && (_jsx("div", { style: OVERLAY, children: _jsxs("div", { style: { ...MODAL, maxWidth: 600 }, children: [_jsx("h3", { style: { margin: '0 0 16px', fontSize: 16 }, children: "\u0417\u0430\u043F\u0440\u043E\u0441 \u043A\u043E\u043C\u043C\u0435\u0440\u0447\u0435\u0441\u043A\u0438\u0445 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0439" }), _jsxs("label", { style: { ...LBL, marginBottom: 12 }, children: ["\u041E\u0431\u0449\u0438\u0439 \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439 \u0434\u043B\u044F \u043F\u043E\u0441\u0442\u0430\u0432\u0449\u0438\u043A\u043E\u0432", _jsx("textarea", { value: kpComment, onChange: e => setKpComment(e.target.value), rows: 3, placeholder: "\u041F\u0440\u0438\u043C\u0435\u0440: \u0414\u043E\u0441\u0442\u0430\u0432\u043A\u0430 \u0434\u043E \u043E\u0431\u044A\u0435\u043A\u0442\u0430, \u043E\u043F\u043B\u0430\u0442\u0430 \u043F\u043E \u0444\u0430\u043A\u0442\u0443, \u0441\u0440\u043E\u043A \u2014 2 \u043D\u0435\u0434\u0435\u043B\u0438...", style: { ...INPUT, marginTop: 4, resize: 'vertical', fontFamily: 'inherit' } })] }), _jsx("div", { style: { marginBottom: 8, fontSize: 13, fontWeight: 600, color: C.text }, children: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u044B (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E \u2014 \u0432\u0441\u0435):" }), _jsx("div", { style: { maxHeight: 280, overflowY: 'auto', border: `1px solid ${C.border}`, borderRadius: 6, padding: 8, marginBottom: 16 }, children: data.items.filter(i => i.type === 'Материал').map(item => (_jsxs("label", { style: { display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0', fontSize: 13, cursor: 'pointer' }, children: [_jsx("input", { type: "checkbox", checked: kpSelected.size === 0 || kpSelected.has(item.id), onChange: e => {
                                                    const all = data.items.filter(i => i.type === 'Материал');
                                                    if (kpSelected.size === 0) {
                                                        const s = new Set(all.map(i => i.id));
                                                        s.delete(item.id);
                                                        setKpSelected(s);
                                                    }
                                                    else {
                                                        const s = new Set(kpSelected);
                                                        e.target.checked ? s.add(item.id) : s.delete(item.id);
                                                        if (s.size === all.length)
                                                            setKpSelected(new Set());
                                                        else
                                                            setKpSelected(s);
                                                    }
                                                }, style: { marginTop: 2 } }), _jsxs("span", { style: { color: C.text }, children: [_jsx("strong", { children: item.name }), " \u2014 ", item.quantity, " ", item.unit] })] }, item.id))) }), _jsxs("div", { style: { display: 'flex', gap: 8, justifyContent: 'flex-end' }, children: [_jsx("button", { onClick: () => setShowKP(false), style: btnOutline(), children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { onClick: exportKP, style: btnPrimary(), children: "\u2B07 \u0421\u043A\u0430\u0447\u0430\u0442\u044C Excel" })] })] }) })), showSepSheet && (_jsx("div", { style: OVERLAY, children: _jsxs("div", { style: { ...MODAL, maxWidth: 480 }, children: [_jsx("h3", { style: { margin: '0 0 16px', fontSize: 16 }, children: "\u0420\u0430\u0437\u0434\u0435\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u0430\u044F \u0432\u0435\u0434\u043E\u043C\u043E\u0441\u0442\u044C" }), _jsxs("label", { style: LBL, children: ["\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430", _jsx("input", { value: sepTitle, onChange: e => setSepTitle(e.target.value), style: { ...INPUT, marginTop: 4 } })] }), _jsxs("div", { style: { display: 'flex', gap: 12, margin: '10px 0' }, children: [_jsxs("label", { style: { fontSize: 13, display: 'flex', gap: 4, alignItems: 'center', color: C.text }, children: [_jsx("input", { type: "checkbox", checked: sepIncludeWorks, onChange: e => setSepIncludeWorks(e.target.checked) }), "\u0420\u0430\u0431\u043E\u0442\u044B"] }), _jsxs("label", { style: { fontSize: 13, display: 'flex', gap: 4, alignItems: 'center', color: C.text }, children: [_jsx("input", { type: "checkbox", checked: sepIncludeMaterials, onChange: e => setSepIncludeMaterials(e.target.checked) }), "\u041C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u044B"] })] }), _jsxs("div", { style: { display: 'flex', gap: 12, marginBottom: 10 }, children: [_jsxs("label", { style: { fontSize: 13, display: 'flex', gap: 4, alignItems: 'center', color: C.text }, children: [_jsx("input", { type: "radio", checked: !sepManual, onChange: () => setSepManual(false) }), "\u041F\u043E \u0440\u0430\u0437\u0434\u0435\u043B\u0430\u043C"] }), _jsxs("label", { style: { fontSize: 13, display: 'flex', gap: 4, alignItems: 'center', color: C.text }, children: [_jsx("input", { type: "radio", checked: sepManual, onChange: () => setSepManual(true) }), "\u0412\u0440\u0443\u0447\u043D\u0443\u044E"] })] }), !sepManual ? (_jsxs("div", { style: { maxHeight: 200, overflowY: 'auto', border: `1px solid ${C.border}`, borderRadius: 6, padding: 8 }, children: [_jsxs("label", { style: { fontSize: 12, display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4, color: C.textSec }, children: [_jsx("input", { type: "checkbox", onChange: e => { const all = {}; allSections.forEach(s => { all[s] = e.target.checked; }); setSepSections(all); } }), "\u0412\u0441\u0435 \u0440\u0430\u0437\u0434\u0435\u043B\u044B"] }), allSections.map(s => (_jsxs("label", { style: { fontSize: 12, display: 'flex', gap: 4, alignItems: 'center', marginBottom: 2, color: C.text }, children: [_jsx("input", { type: "checkbox", checked: !!sepSections[s], onChange: e => setSepSections({ ...sepSections, [s]: e.target.checked }) }), s] }, s)))] })) : (_jsx("div", { style: { maxHeight: 220, overflowY: 'auto', border: `1px solid ${C.border}`, borderRadius: 6, padding: 8 }, children: data.items.map(item => (_jsxs("label", { style: { fontSize: 12, display: 'flex', gap: 4, alignItems: 'flex-start', marginBottom: 2, color: C.text }, children: [_jsx("input", { type: "checkbox", checked: sepSelectedIds.has(item.id), onChange: e => {
                                                    const next = new Set(sepSelectedIds);
                                                    if (e.target.checked)
                                                        next.add(item.id);
                                                    else
                                                        next.delete(item.id);
                                                    setSepSelectedIds(next);
                                                } }), _jsxs("span", { children: ["[", item.type, "] ", item.name] })] }, item.id))) })), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 16 }, children: [_jsx("button", { onClick: downloadSepSheet, style: btnPrimary(), children: "\u2B07 \u0421\u043A\u0430\u0447\u0430\u0442\u044C Excel" }), _jsx("button", { onClick: () => setShowSepSheet(false), style: btnOutline(), children: "\u041E\u0442\u043C\u0435\u043D\u0430" })] })] }) }))] }), showHistory && id && _jsx(VersionHistoryDrawer, { taskId: id, onClose: () => setShowHistory(false), onRestored: () => { setShowHistory(false); load(); } }), showOpt && id && _jsx(OptimizationChecklist, { taskId: id, onClose: () => setShowOpt(false), onOptimized: () => { setShowOpt(false); load(); } }), analogueItemId && id && analogueItem && _jsx(AnaloguePanel, { taskId: id, itemId: analogueItemId, isAnalogue: analogueItem.is_analogue, onClose: () => setAnalogueItemId(null), onApplied: () => { setAnalogueItemId(null); load(); } }), showAiAssist && id && _jsx(AiAssistModal, { taskId: id, onClose: () => setShowAiAssist(false) }), showBatchAnalogue && id && data && (_jsx(BatchAnalogueModal, { taskId: id, items: data.items.filter(i => selectedIds.has(i.id) && i.type === 'Материал'), onClose: () => setShowBatchAnalogue(false), onApplied: () => { setShowBatchAnalogue(false); setSelectedIds(new Set()); load(); } })), _jsx("input", { ref: importRef, type: "file", accept: ".xlsx", style: { display: 'none' }, onChange: handleImport })] }));
}
function fmt(v) { return v.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
