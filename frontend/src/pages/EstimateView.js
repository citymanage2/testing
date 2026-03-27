import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import StatusBadge from '../components/StatusBadge';
import VersionHistoryDrawer from '../components/VersionHistoryDrawer';
import OptimizationChecklist from '../components/OptimizationChecklist';
import AnaloguePanel from '../components/AnaloguePanel';
const ESTIMATE_STATUSES = [
    { value: 'created', label: 'Создана' },
    { value: 'calculated', label: 'Рассчитана себестоимость' },
    { value: 'optimized', label: 'Оптимизирована' },
    { value: 'ready', label: 'Готова к подаче' },
];
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
    const [docType, setDocType] = useState('');
    const [extras, setExtras] = useState({ overhead_pct: 0, overhead_sum: 0, transport_pct: 0, transport_sum: 0, contingency_pct: 0, contingency_sum: 0 });
    const [showExtras, setShowExtras] = useState(false);
    const [savingExtras, setSavingExtras] = useState(false);
    const [showAddRow, setShowAddRow] = useState(false);
    const [newRow, setNewRow] = useState({ section: '', type: 'Работа', name: '', unit: 'шт', quantity: '1', work_price: '0', mat_price: '0' });
    const [showSepSheet, setShowSepSheet] = useState(false);
    const [sepSections, setSepSections] = useState({});
    const [sepManual, setSepManual] = useState(false);
    const [sepSelectedIds, setSepSelectedIds] = useState(new Set());
    const [sepIncludeWorks, setSepIncludeWorks] = useState(true);
    const [sepIncludeMaterials, setSepIncludeMaterials] = useState(true);
    const [sepTitle, setSepTitle] = useState('Разделительная ведомость');
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
            setExtras(extrasR.data);
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
    const filtered = data ? data.items.filter(i => filterType === 'all' || (filterType === 'works' ? i.type === 'Работа' : i.type === 'Материал')) : [];
    function startEdit(item, field) {
        setEditCell({ itemId: item.id, field });
        const val = field === 'work_price' ? item.price_work : field === 'mat_price' ? item.price_material : field === 'quantity' ? item.quantity : field === 'source_url' ? (item.source_url || '') : '';
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
                    setEditCell(null); }, style: { width: '100%', border: '1px solid #1565c0', borderRadius: 3, padding: '2px 4px', fontSize: 13 } }));
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
        setEstimateStatus(val);
        await client.patch(`/projects/estimates/${id}/status`, { status: val });
    }
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
        load();
    }
    async function saveExtras() {
        setSavingExtras(true);
        await client.patch(`/projects/estimates/${id}/extras`, extras);
        setSavingExtras(false);
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
        return _jsx("div", { style: { padding: 24 }, children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430..." });
    if (error)
        return _jsx("div", { style: { padding: 24, color: '#f44336' }, children: error });
    if (!data)
        return null;
    const analogueItem = analogueItemId ? data.items.find(i => i.id === analogueItemId) : null;
    const allSections = Array.from(new Set(data.items.map(i => i.section || ''))).filter(Boolean);
    // Compute extra amounts
    const overheadAmt = extras.overhead_sum + data.total * extras.overhead_pct / 100;
    const transportAmt = extras.transport_sum + data.total * extras.transport_pct / 100;
    const contingencyAmt = extras.contingency_sum + data.total * extras.contingency_pct / 100;
    const grandBase = data.total + overheadAmt + transportAmt + contingencyAmt;
    const grandVat = grandBase * data.vat_rate / 100;
    const grandTotal = grandBase + grandVat;
    return (_jsxs("div", { style: { padding: 24, maxWidth: 1400, margin: '0 auto' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14, flexWrap: 'wrap' }, children: [_jsxs("div", { style: { flex: 1, minWidth: 220 }, children: [editingName ? (_jsx("input", { ref: nameRef, value: taskName, onChange: e => setTaskName(e.target.value), onBlur: saveName, onKeyDown: e => { if (e.key === 'Enter')
                                    saveName(); if (e.key === 'Escape')
                                    setEditingName(false); }, style: { fontSize: 20, fontWeight: 600, border: '1px solid #1976d2', borderRadius: 4, padding: '3px 8px', width: '100%' } })) : (_jsxs("h2", { style: { margin: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }, onClick: () => setEditingName(true), title: "\u041D\u0430\u0436\u043C\u0438\u0442\u0435 \u0447\u0442\u043E\u0431\u044B \u043F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u0442\u044C", children: [taskName || `Смета ${id?.slice(0, 8)}`, _jsx("span", { style: { fontSize: 14, color: '#aaa' }, children: "\u270E" })] })), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }, children: [_jsx(StatusBadge, { status: estimateStatus }), _jsxs("select", { value: estimateStatus, onChange: e => saveStatus(e.target.value), style: { fontSize: 12, padding: '2px 6px', border: '1px solid #ccc', borderRadius: 4 }, children: [_jsx("option", { value: "", children: "\u2014 \u0441\u0442\u0430\u0442\u0443\u0441 \u2014" }), ESTIMATE_STATUSES.map(s => _jsx("option", { value: s.value, children: s.label }, s.value))] }), _jsxs("select", { value: docType, onChange: e => saveDocType(e.target.value), style: { fontSize: 12, padding: '2px 6px', border: '1px solid #ccc', borderRadius: 4 }, children: [_jsx("option", { value: "", children: "\u2014 \u0442\u0438\u043F \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430 \u2014" }), DOC_TYPES.map(d => _jsx("option", { value: d, children: d }, d))] })] })] }), _jsxs("div", { style: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }, children: [_jsx("button", { onClick: () => setShowHistory(true), style: btn('#757575'), children: "\u0418\u0441\u0442\u043E\u0440\u0438\u044F" }), _jsx("button", { onClick: () => setShowOpt(true), style: btn('#ff9800'), children: "\u041E\u043F\u0442\u0438\u043C\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u0442\u044C" }), _jsx("button", { onClick: checkPairs, style: btn('#7b1fa2'), children: "\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043F\u0430\u0440\u044B" }), _jsx("button", { onClick: () => { setShowMove(false); loadProjects(); setShowMove(true); }, style: btn('#00796b'), children: "\u041F\u0435\u0440\u0435\u043C\u0435\u0441\u0442\u0438\u0442\u044C" }), _jsx("button", { onClick: () => { setKpSelected(new Set()); setKpComment(''); setShowKP(true); }, style: btn('#e65100'), children: "\u0417\u0430\u043F\u0440\u043E\u0441 \u041A\u041F" }), _jsx("button", { onClick: () => setShowSepSheet(true), style: btn('#0288d1'), children: "\u0412\u0435\u0434\u043E\u043C\u043E\u0441\u0442\u044C" }), _jsx("button", { onClick: deleteTask, style: btn('#d32f2f'), children: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C" })] })] }), _jsxs("div", { style: { display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }, children: [_jsx("span", { style: { fontSize: 13, fontWeight: 600 }, children: "\u0424\u0438\u043B\u044C\u0442\u0440:" }), ['all', 'works', 'materials'].map(t => (_jsx("button", { onClick: () => setFilterType(t), style: { padding: '4px 12px', borderRadius: 4, border: '1px solid #ccc', background: filterType === t ? '#1565c0' : '#fff', color: filterType === t ? '#fff' : '#333', cursor: 'pointer', fontSize: 13 }, children: { all: 'Все', works: 'Работы', materials: 'Материалы' }[t] }, t))), _jsxs("div", { style: { marginLeft: 'auto', display: 'flex', gap: 6 }, children: [_jsx("button", { onClick: () => exportEstimate('all'), style: btn('#2e7d32'), children: "\u2B07 \u0412\u0441\u0435" }), _jsx("button", { onClick: () => exportEstimate('works'), style: btn('#1565c0'), children: "\u2B07 \u0420\u0430\u0431\u043E\u0442\u044B" }), _jsx("button", { onClick: () => exportEstimate('materials'), style: btn('#6a1b9a'), children: "\u2B07 \u041C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u044B" }), _jsx("button", { onClick: () => setShowAddRow(true), style: btn('#6a1b9a'), children: "+ \u0421\u0442\u0440\u043E\u043A\u0430" })] })] }), showAddRow && (_jsx("div", { style: overlay, children: _jsxs("div", { style: modal, children: [_jsx("h3", { style: { margin: '0 0 14px' }, children: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0441\u0442\u0440\u043E\u043A\u0443" }), _jsxs("div", { style: { display: 'grid', gap: 8 }, children: [[['Раздел', 'section'], ['Наименование', 'name'], ['Единица измерения', 'unit']].map(([label, key]) => (_jsxs("label", { style: lbl, children: [label, _jsx("input", { value: newRow[key], onChange: e => setNewRow({ ...newRow, [key]: e.target.value }), style: inp })] }, key))), _jsxs("label", { style: lbl, children: ["\u0422\u0438\u043F", _jsxs("select", { value: newRow.type, onChange: e => setNewRow({ ...newRow, type: e.target.value }), style: inp, children: [_jsx("option", { children: "\u0420\u0430\u0431\u043E\u0442\u0430" }), _jsx("option", { children: "\u041C\u0430\u0442\u0435\u0440\u0438\u0430\u043B" })] })] }), [['Количество', 'quantity'], ['Цена работ', 'work_price'], ['Цена материалов', 'mat_price']].map(([label, key]) => (_jsxs("label", { style: lbl, children: [label, _jsx("input", { type: "number", value: newRow[key], onChange: e => setNewRow({ ...newRow, [key]: e.target.value }), style: inp })] }, key)))] }), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 14 }, children: [_jsx("button", { onClick: addRow, style: btn('#1976d2'), children: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C" }), _jsx("button", { onClick: () => setShowAddRow(false), style: btn('#757575'), children: "\u041E\u0442\u043C\u0435\u043D\u0430" })] })] }) })), _jsxs("div", { style: { display: 'flex', gap: 16, marginBottom: 10, fontSize: 12, color: '#555' }, children: [_jsx("span", { style: { background: '#FFF3CD', padding: '2px 8px', borderRadius: 3 }, children: "\u041E\u043F\u0442\u0438\u043C\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u043D\u043E" }), _jsx("span", { style: { background: '#C8E6C9', padding: '2px 8px', borderRadius: 3 }, children: "\u0410\u043D\u0430\u043B\u043E\u0433" }), _jsx("span", { style: { color: '#888' }, children: "\u0426\u0438\u0444\u0440\u044B \u043A\u043B\u0438\u043A\u0430\u0431\u0435\u043B\u044C\u043D\u044B \u0434\u043B\u044F \u0440\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F" })] }), _jsx("div", { style: { overflowX: 'auto', marginBottom: 20 }, children: _jsxs("table", { style: { width: '100%', borderCollapse: 'collapse', fontSize: 13 }, children: [_jsx("thead", { children: _jsx("tr", { style: { background: '#f5f5f5' }, children: ['№', 'Раздел', 'Тип', 'Наименование', 'Ед.', 'Кол-во', 'Цена работ', 'Цена мат.', 'Стоимость', 'Источник', 'Комментарий', ''].map(h => (_jsx("th", { style: { padding: '8px 8px', textAlign: 'left', border: '1px solid #e0e0e0', fontWeight: 600, whiteSpace: 'nowrap' }, children: h }, h))) }) }), _jsx("tbody", { children: filtered.map(item => {
                                const rowBg = item.is_optimized ? '#FFF3CD' : item.is_analogue ? '#C8E6C9' : undefined;
                                return (_jsxs("tr", { style: { background: rowBg }, children: [_jsx("td", { style: td, children: item.position }), _jsx("td", { style: td, children: item.section }), _jsx("td", { style: td, children: item.type }), _jsxs("td", { style: { ...td, maxWidth: 280 }, children: [item.name, item.is_analogue && _jsx("span", { style: { marginLeft: 6, padding: '1px 5px', background: '#4caf50', color: '#fff', borderRadius: 10, fontSize: 10 }, children: "\u0430\u043D\u0430\u043B\u043E\u0433" }), item.is_optimized && _jsx("span", { style: { marginLeft: 4, padding: '1px 5px', background: '#ff9800', color: '#fff', borderRadius: 10, fontSize: 10 }, children: "\u043E\u043F\u0442" })] }), _jsx("td", { style: td, children: item.unit }), _jsx("td", { style: { ...td, minWidth: 60 }, children: editInput(item, 'quantity') }), _jsx("td", { style: { ...td, minWidth: 80 }, children: editInput(item, 'work_price') }), _jsx("td", { style: { ...td, minWidth: 80 }, children: editInput(item, 'mat_price') }), _jsx("td", { style: td, children: fmt(item.total) }), _jsx("td", { style: { ...td, minWidth: 120 }, children: item.type === 'Материал' && (item.source_url
                                                ? _jsxs("a", { href: item.source_url, target: "_blank", rel: "noopener noreferrer", style: { fontSize: 11, color: '#1565c0', wordBreak: 'break-all' }, children: ["\uD83D\uDD17 ", item.source_url.replace(/^https?:\/\//, '').slice(0, 25), "\u2026"] })
                                                : editInput(item, 'source_url')) }), _jsx("td", { style: { ...td, minWidth: 120 }, children: editInput(item, 'comment') }), _jsx("td", { style: td, children: _jsxs("div", { style: { display: 'flex', gap: 4 }, children: [item.type === 'Материал' && (_jsx("button", { onClick: () => setAnalogueItemId(item.id), style: { padding: '2px 8px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }, children: "\u0410\u043D\u0430\u043B\u043E\u0433\u0438" })), _jsx("button", { onClick: () => deleteItem(item.id), style: { padding: '2px 6px', background: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a', borderRadius: 4, cursor: 'pointer', fontSize: 11 }, children: "\u2715" })] }) })] }, item.id));
                            }) })] }) }), _jsxs("div", { style: { marginBottom: 16 }, children: [_jsxs("button", { onClick: () => setShowExtras(!showExtras), style: { ...btn('#546e7a'), fontSize: 13 }, children: [showExtras ? '▲' : '▼', " \u041D\u0430\u043A\u043B\u0430\u0434\u043D\u044B\u0435, \u0442\u0440\u0430\u043D\u0441\u043F\u043E\u0440\u0442, \u043D\u0435\u043F\u0440\u0435\u0434\u0432\u0438\u0434\u0435\u043D\u043D\u044B\u0435 \u0440\u0430\u0441\u0445\u043E\u0434\u044B"] }), showExtras && (_jsxs("div", { style: { background: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: 6, padding: '12px 16px', marginTop: 8 }, children: [_jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }, children: [['Накладные расходы', 'overhead_pct', 'overhead_sum'], ['Транспортные расходы', 'transport_pct', 'transport_sum'], ['Непредвиденные расходы', 'contingency_pct', 'contingency_sum']].map(([label, pct, sum]) => (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 4 }, children: [_jsx("span", { style: { fontSize: 12, fontWeight: 600 }, children: label }), _jsxs("div", { style: { display: 'flex', gap: 8 }, children: [_jsxs("label", { style: { fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }, children: ["%", _jsx("input", { type: "number", value: extras[pct], onChange: e => setExtras({ ...extras, [pct]: parseFloat(e.target.value) || 0 }), style: { ...inp, width: 70 } })] }), _jsxs("label", { style: { fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }, children: ["\u0421\u0443\u043C\u043C\u0430 \u20BD", _jsx("input", { type: "number", value: extras[sum], onChange: e => setExtras({ ...extras, [sum]: parseFloat(e.target.value) || 0 }), style: { ...inp, width: 100 } })] })] })] }, label))) }), _jsx("button", { onClick: saveExtras, disabled: savingExtras, style: { ...btn('#1976d2'), marginTop: 12, fontSize: 13 }, children: savingExtras ? 'Сохранение...' : 'Сохранить' })] }))] }), _jsx("div", { style: { display: 'flex', gap: 20, flexWrap: 'wrap', background: '#f9f9f9', padding: '14px 20px', borderRadius: 6, border: '1px solid #e0e0e0' }, children: [['Работы', data.total_work], ['Материалы', data.total_mat], ['Итого (базис)', data.total],
                    ...(overheadAmt > 0 ? [['Накладные', overheadAmt]] : []),
                    ...(transportAmt > 0 ? [['Транспорт', transportAmt]] : []),
                    ...(contingencyAmt > 0 ? [['Непредвиденные', contingencyAmt]] : []),
                    [`НДС ${data.vat_rate}%`, grandVat], ['ИТОГО с НДС', grandTotal]].map(([label, value]) => (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 2 }, children: [_jsx("span", { style: { fontSize: 12, color: '#888' }, children: label }), _jsxs("span", { style: { fontSize: 15, fontWeight: label === 'ИТОГО с НДС' ? 700 : 500 }, children: [fmt(value), " \u20BD"] })] }, label))) }), pairResult && (_jsxs("div", { style: { marginTop: 16, padding: 16, background: pairResult.ok ? '#e8f5e9' : '#fff3e0', borderRadius: 6, border: `1px solid ${pairResult.ok ? '#a5d6a7' : '#ffcc80'}` }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }, children: [_jsxs("strong", { children: [pairResult.ok ? '✅ ' : '⚠️ ', pairResult.summary] }), _jsx("button", { onClick: () => setPairResult(null), style: { border: 'none', background: 'none', cursor: 'pointer', fontSize: 16 }, children: "\u2715" })] }), pairResult.materials_without_work.length > 0 && (_jsxs("div", { style: { marginBottom: 6 }, children: [_jsx("strong", { style: { fontSize: 12 }, children: "\u041C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u044B \u0431\u0435\u0437 \u0440\u0430\u0431\u043E\u0442:" }), _jsx("ul", { style: { margin: '4px 0 0 16px', fontSize: 12 }, children: pairResult.materials_without_work.map(n => _jsx("li", { children: n }, n)) })] })), pairResult.works_without_material.length > 0 && (_jsxs("div", { children: [_jsx("strong", { style: { fontSize: 12 }, children: "\u0420\u0430\u0431\u043E\u0442\u044B \u0431\u0435\u0437 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u043E\u0432:" }), _jsx("ul", { style: { margin: '4px 0 0 16px', fontSize: 12 }, children: pairResult.works_without_material.map(n => _jsx("li", { children: n }, n)) })] }))] })), showMove && (_jsx("div", { style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }, children: _jsxs("div", { style: { background: '#fff', borderRadius: 8, padding: 24, minWidth: 300, maxWidth: 400, width: '90%' }, children: [_jsx("h3", { style: { margin: '0 0 16px' }, children: "\u041F\u0435\u0440\u0435\u043C\u0435\u0441\u0442\u0438\u0442\u044C \u0432 \u043F\u0440\u043E\u0435\u043A\u0442" }), projects.length === 0 ? _jsx("p", { style: { color: '#888' }, children: "\u041D\u0435\u0442 \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u0432" }) : projects.map(p => (_jsx("button", { onClick: () => moveToProject(p.id), style: { display: 'block', width: '100%', padding: '8px 12px', marginBottom: 8, border: '1px solid #ccc', borderRadius: 4, background: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: 14 }, children: p.name }, p.id))), _jsx("button", { onClick: () => setShowMove(false), style: { marginTop: 8, padding: '6px 16px', border: 'none', borderRadius: 4, background: '#eee', cursor: 'pointer' }, children: "\u041E\u0442\u043C\u0435\u043D\u0430" })] }) })), showKP && data && (_jsx("div", { style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }, children: _jsxs("div", { style: { background: '#fff', borderRadius: 8, padding: 24, width: '90%', maxWidth: 600, maxHeight: '80vh', overflowY: 'auto' }, children: [_jsx("h3", { style: { margin: '0 0 12px' }, children: "\u0417\u0430\u043F\u0440\u043E\u0441 \u043A\u043E\u043C\u043C\u0435\u0440\u0447\u0435\u0441\u043A\u0438\u0445 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0439" }), _jsxs("div", { style: { marginBottom: 12 }, children: [_jsx("label", { style: { display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }, children: "\u041E\u0431\u0449\u0438\u0439 \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439 \u0434\u043B\u044F \u043F\u043E\u0441\u0442\u0430\u0432\u0449\u0438\u043A\u043E\u0432:" }), _jsx("textarea", { value: kpComment, onChange: e => setKpComment(e.target.value), rows: 3, placeholder: "\u041F\u0440\u0438\u043C\u0435\u0440: \u0414\u043E\u0441\u0442\u0430\u0432\u043A\u0430 \u0434\u043E \u043E\u0431\u044A\u0435\u043A\u0442\u0430, \u043E\u043F\u043B\u0430\u0442\u0430 \u043F\u043E \u0444\u0430\u043A\u0442\u0443, \u0441\u0440\u043E\u043A \u2014 2 \u043D\u0435\u0434\u0435\u043B\u0438...", style: { width: '100%', padding: '8px', fontSize: 13, borderRadius: 4, border: '1px solid #ccc', resize: 'vertical', boxSizing: 'border-box' } })] }), _jsx("div", { style: { marginBottom: 12, fontSize: 13, fontWeight: 600 }, children: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u044B (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E \u2014 \u0432\u0441\u0435):" }), _jsx("div", { style: { maxHeight: 300, overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: 4, padding: 8, marginBottom: 16 }, children: data.items.filter(i => i.type === 'Материал').map(item => (_jsxs("label", { style: { display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0', fontSize: 13, cursor: 'pointer' }, children: [_jsx("input", { type: "checkbox", checked: kpSelected.size === 0 || kpSelected.has(item.id), onChange: e => {
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
                                        }, style: { marginTop: 2 } }), _jsxs("span", { children: [_jsx("strong", { children: item.name }), " \u2014 ", item.quantity, " ", item.unit] })] }, item.id))) }), _jsxs("div", { style: { display: 'flex', gap: 8, justifyContent: 'flex-end' }, children: [_jsx("button", { onClick: () => setShowKP(false), style: { padding: '8px 16px', border: 'none', borderRadius: 4, background: '#eee', cursor: 'pointer' }, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { onClick: exportKP, style: { padding: '8px 20px', border: 'none', borderRadius: 4, background: '#e65100', color: '#fff', cursor: 'pointer', fontWeight: 600 }, children: "\u2B07 \u0421\u043A\u0430\u0447\u0430\u0442\u044C Excel" })] })] }) })), showSepSheet && (_jsx("div", { style: overlay, children: _jsxs("div", { style: modal, children: [_jsx("h3", { style: { margin: '0 0 12px' }, children: "\u0420\u0430\u0437\u0434\u0435\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u0430\u044F \u0432\u0435\u0434\u043E\u043C\u043E\u0441\u0442\u044C" }), _jsxs("label", { style: lbl, children: ["\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430", _jsx("input", { value: sepTitle, onChange: e => setSepTitle(e.target.value), style: inp })] }), _jsxs("div", { style: { display: 'flex', gap: 12, margin: '8px 0' }, children: [_jsxs("label", { style: { fontSize: 13, display: 'flex', gap: 4, alignItems: 'center' }, children: [_jsx("input", { type: "checkbox", checked: sepIncludeWorks, onChange: e => setSepIncludeWorks(e.target.checked) }), "\u0420\u0430\u0431\u043E\u0442\u044B"] }), _jsxs("label", { style: { fontSize: 13, display: 'flex', gap: 4, alignItems: 'center' }, children: [_jsx("input", { type: "checkbox", checked: sepIncludeMaterials, onChange: e => setSepIncludeMaterials(e.target.checked) }), "\u041C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u044B"] })] }), _jsxs("div", { style: { display: 'flex', gap: 12, marginBottom: 8 }, children: [_jsxs("label", { style: { fontSize: 13, display: 'flex', gap: 4, alignItems: 'center' }, children: [_jsx("input", { type: "radio", checked: !sepManual, onChange: () => setSepManual(false) }), "\u041F\u043E \u0440\u0430\u0437\u0434\u0435\u043B\u0430\u043C"] }), _jsxs("label", { style: { fontSize: 13, display: 'flex', gap: 4, alignItems: 'center' }, children: [_jsx("input", { type: "radio", checked: sepManual, onChange: () => setSepManual(true) }), "\u0412\u0440\u0443\u0447\u043D\u0443\u044E"] })] }), !sepManual ? (_jsxs("div", { style: { maxHeight: 200, overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: 4, padding: 8 }, children: [_jsxs("label", { style: { fontSize: 12, display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }, children: [_jsx("input", { type: "checkbox", onChange: e => { const all = {}; allSections.forEach(s => { all[s] = e.target.checked; }); setSepSections(all); } }), "\u0412\u0441\u0435 \u0440\u0430\u0437\u0434\u0435\u043B\u044B"] }), allSections.map(s => (_jsxs("label", { style: { fontSize: 12, display: 'flex', gap: 4, alignItems: 'center', marginBottom: 2 }, children: [_jsx("input", { type: "checkbox", checked: !!sepSections[s], onChange: e => setSepSections({ ...sepSections, [s]: e.target.checked }) }), s] }, s)))] })) : (_jsx("div", { style: { maxHeight: 220, overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: 4, padding: 8 }, children: data.items.map(item => (_jsxs("label", { style: { fontSize: 12, display: 'flex', gap: 4, alignItems: 'flex-start', marginBottom: 2 }, children: [_jsx("input", { type: "checkbox", checked: sepSelectedIds.has(item.id), onChange: e => {
                                            const next = new Set(sepSelectedIds);
                                            if (e.target.checked)
                                                next.add(item.id);
                                            else
                                                next.delete(item.id);
                                            setSepSelectedIds(next);
                                        } }), _jsxs("span", { children: ["[", item.type, "] ", item.name] })] }, item.id))) })), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 14 }, children: [_jsx("button", { onClick: downloadSepSheet, style: btn('#0288d1'), children: "\u2B07 \u0421\u043A\u0430\u0447\u0430\u0442\u044C Excel" }), _jsx("button", { onClick: () => setShowSepSheet(false), style: btn('#757575'), children: "\u041E\u0442\u043C\u0435\u043D\u0430" })] })] }) })), showHistory && id && _jsx(VersionHistoryDrawer, { taskId: id, onClose: () => setShowHistory(false), onRestored: () => { setShowHistory(false); load(); } }), showOpt && id && _jsx(OptimizationChecklist, { taskId: id, onClose: () => setShowOpt(false), onOptimized: () => { setShowOpt(false); load(); } }), analogueItemId && id && analogueItem && _jsx(AnaloguePanel, { taskId: id, itemId: analogueItemId, isAnalogue: analogueItem.is_analogue, onClose: () => setAnalogueItemId(null), onApplied: () => { setAnalogueItemId(null); load(); } }), _jsx("input", { ref: importRef, type: "file", accept: ".xlsx", style: { display: 'none' }, onChange: handleImport })] }));
}
const td = { padding: '5px 8px', border: '1px solid #e0e0e0', verticalAlign: 'middle' };
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal = { background: '#fff', borderRadius: 8, padding: 24, width: '90%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto' };
const inp = { padding: '5px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13, width: '100%', boxSizing: 'border-box' };
const lbl = { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 13, marginBottom: 8 };
function fmt(v) { return v.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function btn(bg) { return { padding: '6px 12px', background: bg, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 500 }; }
