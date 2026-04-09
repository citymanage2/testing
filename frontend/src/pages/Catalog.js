import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useRef } from 'react';
import client from '../api/client';
import { C, btnPrimary, btnOutline, btnDanger, btnGhost, INPUT, LBL, CARD, TH, TD, OVERLAY, MODAL } from '../ui';
const empty = { item_type: 'work', name: '', unit: '', work_price: '0', mat_price: '0', tags: '' };
export default function Catalog() {
    const [list, setList] = useState([]);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ ...empty });
    const [editId, setEditId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [dupCount, setDupCount] = useState(null);
    const [deletingDups, setDeletingDups] = useState(false);
    const importRef = useRef(null);
    async function load(q) {
        const params = {};
        if (q)
            params.q = q;
        if (typeFilter !== 'all')
            params.item_type = typeFilter;
        params.limit = '200';
        const r = await client.get('/catalog', { params });
        setList(r.data);
    }
    async function loadDupCount() {
        try {
            const r = await client.get('/catalog/duplicates/count');
            setDupCount(r.data.count);
        }
        catch {
            setDupCount(null);
        }
    }
    async function deleteDups() {
        if (!confirm(`Удалить ${dupCount} дублирующих записей? Останется одна (последняя) версия каждой позиции.`))
            return;
        setDeletingDups(true);
        try {
            await client.delete('/catalog/duplicates');
            await load(search || undefined);
            await loadDupCount();
        }
        finally {
            setDeletingDups(false);
        }
    }
    useEffect(() => { load(search || undefined); }, [search, typeFilter]);
    useEffect(() => { loadDupCount(); }, []);
    function openAdd() { setForm({ ...empty }); setEditId(null); setShowForm(true); }
    function openEdit(e) {
        setForm({ item_type: e.item_type, name: e.name, unit: e.unit || '', work_price: String(e.work_price), mat_price: String(e.mat_price), tags: (e.tags || []).join(', ') });
        setEditId(e.id);
        setShowForm(true);
    }
    async function save() {
        setSaving(true);
        const body = { item_type: form.item_type, name: form.name, unit: form.unit || undefined, work_price: parseFloat(form.work_price) || 0, mat_price: parseFloat(form.mat_price) || 0, tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [] };
        try {
            if (editId)
                await client.put(`/catalog/${editId}`, body);
            else
                await client.post('/catalog', body);
            setShowForm(false);
            load(search || undefined);
        }
        finally {
            setSaving(false);
        }
    }
    async function del(id) {
        if (!confirm('Удалить запись из каталога?'))
            return;
        await client.delete(`/catalog/${id}`);
        load(search || undefined);
    }
    async function downloadTemplate() {
        const resp = await client.get('/catalog/template', { responseType: 'blob' });
        const url = URL.createObjectURL(resp.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'catalog_template.xlsx';
        a.click();
        URL.revokeObjectURL(url);
    }
    async function handleImport(e) {
        const file = e.target.files?.[0];
        if (!file)
            return;
        setImporting(true);
        setImportResult(null);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const r = await client.post('/catalog/import-excel', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            setImportResult(r.data);
            load(search || undefined);
        }
        catch {
            setImportResult({ imported: 0, updated: 0, errors: ['Ошибка загрузки файла'] });
        }
        finally {
            setImporting(false);
            if (importRef.current)
                importRef.current.value = '';
        }
    }
    return (_jsxs("div", { style: { padding: 24, maxWidth: 1200 }, children: [_jsxs("div", { style: { ...CARD, padding: '16px 20px', marginBottom: 16 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }, children: [_jsx("h2", { style: { margin: 0, fontSize: 18, fontWeight: 700, color: C.text, flex: 1 }, children: "\u041A\u043E\u0440\u043F\u043E\u0440\u0430\u0442\u0438\u0432\u043D\u044B\u0439 \u043A\u0430\u0442\u0430\u043B\u043E\u0433 \u0440\u0430\u0441\u0446\u0435\u043D\u043E\u043A" }), _jsxs("div", { style: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }, children: [dupCount !== null && dupCount > 0 && (_jsx("button", { onClick: deleteDups, disabled: deletingDups, style: { ...btnDanger('sm'), display: 'inline-flex', alignItems: 'center', gap: 4 }, children: deletingDups ? '⏳...' : `🗑 Дубликаты (${dupCount})` })), _jsx("button", { onClick: downloadTemplate, style: btnGhost('sm'), title: "\u0421\u043A\u0430\u0447\u0430\u0442\u044C \u0448\u0430\u0431\u043B\u043E\u043D Excel", children: "\u2B07 \u0428\u0430\u0431\u043B\u043E\u043D" }), _jsxs("label", { style: { ...btnOutline('sm'), cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }, children: [importing ? '⏳ Импорт...' : '📥 Импорт Excel', _jsx("input", { ref: importRef, type: "file", accept: ".xlsx", style: { display: 'none' }, onChange: handleImport, disabled: importing })] }), _jsx("button", { onClick: openAdd, style: btnPrimary('sm'), children: "+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C" })] })] }), importResult && (_jsxs("div", { style: { marginTop: 10, padding: '8px 12px', borderRadius: 6, background: importResult.errors.length > 0 ? C.warningBg : C.successBg, border: `1px solid ${importResult.errors.length > 0 ? C.warning : C.success}40`, fontSize: 13 }, children: ["\u2705 \u0418\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u043E: ", importResult.imported, ", \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u043E: ", importResult.updated, importResult.errors.length > 0 && _jsxs("div", { style: { color: C.warning, marginTop: 4 }, children: ["\u041E\u0448\u0438\u0431\u043A\u0438: ", importResult.errors.join('; ')] })] }))] }), _jsxs("div", { style: { display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }, children: [_jsx("div", { style: { display: 'flex', gap: 2, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: 3 }, children: [['all', 'Все'], ['work', 'Работы'], ['material', 'Материалы']].map(([v, l]) => (_jsx("button", { onClick: () => setTypeFilter(v), style: { padding: '4px 12px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: typeFilter === v ? 600 : 400, background: typeFilter === v ? C.surface : 'transparent', color: typeFilter === v ? C.primary : C.textSec, boxShadow: typeFilter === v ? '0 1px 3px rgba(0,0,0,.1)' : 'none' }, children: l }, v))) }), _jsx("input", { value: search, onChange: e => setSearch(e.target.value), placeholder: "\uD83D\uDD0D \u041F\u043E\u0438\u0441\u043A \u043F\u043E \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044E...", style: { ...INPUT, width: 260 } }), _jsxs("span", { style: { fontSize: 12, color: C.textMuted }, children: [list.length, " \u0437\u0430\u043F\u0438\u0441\u0435\u0439"] })] }), list.length === 0
                ? _jsx("div", { style: { ...CARD, padding: 40, textAlign: 'center', color: C.textMuted }, children: "\u041A\u0430\u0442\u0430\u043B\u043E\u0433 \u043F\u0443\u0441\u0442. \u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0437\u0430\u043F\u0438\u0441\u0438 \u0432\u0440\u0443\u0447\u043D\u0443\u044E, \u0441\u043A\u0430\u0447\u0430\u0439\u0442\u0435 \u0448\u0430\u0431\u043B\u043E\u043D \u0438 \u0438\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u0443\u0439\u0442\u0435 \u0438\u0437 Excel, \u0438\u043B\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0439\u0442\u0435 \u0441\u0442\u0440\u043E\u043A\u0438 \u0438\u0437 \u0441\u043C\u0435\u0442." })
                : (_jsx("div", { style: { overflowX: 'auto', borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }, children: _jsxs("table", { style: { width: '100%', borderCollapse: 'collapse', fontSize: 13 }, children: [_jsx("thead", { children: _jsx("tr", { children: ['Тип', 'Наименование', 'Ед.', 'Цена работ', 'Цена мат.', 'Теги', 'Обновлено', ''].map(h => (_jsx("th", { style: TH, children: h }, h))) }) }), _jsx("tbody", { children: list.map(e => (_jsxs("tr", { style: { borderBottom: `1px solid ${C.border}` }, children: [_jsx("td", { style: TD, children: _jsx("span", { style: { padding: '2px 8px', borderRadius: 10, fontSize: 11, background: e.item_type === 'work' ? C.primaryBg : C.successBg, color: e.item_type === 'work' ? C.primary : C.success, fontWeight: 600 }, children: e.item_type === 'work' ? 'Работа' : 'Материал' }) }), _jsx("td", { style: { ...TD, fontWeight: 500, maxWidth: 340 }, children: e.name }), _jsx("td", { style: TD, children: e.unit || '—' }), _jsx("td", { style: TD, children: e.work_price > 0 ? fmt(e.work_price) : '—' }), _jsx("td", { style: TD, children: e.mat_price > 0 ? fmt(e.mat_price) : '—' }), _jsx("td", { style: TD, children: (e.tags || []).map(t => _jsx("span", { style: { marginRight: 4, padding: '1px 6px', background: C.primaryBg, color: C.primary, borderRadius: 10, fontSize: 11 }, children: t }, t)) }), _jsx("td", { style: { ...TD, fontSize: 11, color: C.textMuted, whiteSpace: 'nowrap' }, children: new Date(e.updated_at || e.created_at).toLocaleDateString('ru-RU') }), _jsx("td", { style: TD, children: _jsxs("div", { style: { display: 'flex', gap: 4 }, children: [_jsx("button", { onClick: () => openEdit(e), style: btnGhost('sm'), children: "\u270E" }), _jsx("button", { onClick: () => del(e.id), style: { ...btnDanger('sm'), padding: '2px 6px' }, children: "\u2715" })] }) })] }, e.id))) })] }) })), showForm && (_jsx("div", { style: OVERLAY, children: _jsxs("div", { style: { ...MODAL, maxWidth: 480 }, children: [_jsxs("h3", { style: { margin: '0 0 16px', fontSize: 16 }, children: [editId ? 'Редактировать' : 'Добавить', " \u0440\u0430\u0441\u0446\u0435\u043D\u043A\u0443"] }), _jsxs("div", { style: { display: 'grid', gap: 10 }, children: [_jsxs("label", { style: LBL, children: ["\u0422\u0438\u043F", _jsxs("select", { value: form.item_type, onChange: e => setForm(f => ({ ...f, item_type: e.target.value })), style: { ...INPUT, marginTop: 4 }, children: [_jsx("option", { value: "work", children: "\u0420\u0430\u0431\u043E\u0442\u0430" }), _jsx("option", { value: "material", children: "\u041C\u0430\u0442\u0435\u0440\u0438\u0430\u043B" })] })] }), _jsxs("label", { style: LBL, children: ["\u041D\u0430\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u0435 *", _jsx("input", { value: form.name, onChange: e => setForm(f => ({ ...f, name: e.target.value })), style: { ...INPUT, marginTop: 4 } })] }), _jsxs("label", { style: LBL, children: ["\u0415\u0434\u0438\u043D\u0438\u0446\u0430 \u0438\u0437\u043C\u0435\u0440\u0435\u043D\u0438\u044F", _jsx("input", { value: form.unit, onChange: e => setForm(f => ({ ...f, unit: e.target.value })), style: { ...INPUT, marginTop: 4 } })] }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }, children: [_jsxs("label", { style: LBL, children: ["\u0426\u0435\u043D\u0430 \u0440\u0430\u0431\u043E\u0442 \u20BD", _jsx("input", { type: "number", value: form.work_price, onChange: e => setForm(f => ({ ...f, work_price: e.target.value })), style: { ...INPUT, marginTop: 4 } })] }), _jsxs("label", { style: LBL, children: ["\u0426\u0435\u043D\u0430 \u043C\u0430\u0442. \u20BD", _jsx("input", { type: "number", value: form.mat_price, onChange: e => setForm(f => ({ ...f, mat_price: e.target.value })), style: { ...INPUT, marginTop: 4 } })] })] }), _jsxs("label", { style: LBL, children: ["\u0422\u0435\u0433\u0438 (\u0447\u0435\u0440\u0435\u0437 \u0437\u0430\u043F\u044F\u0442\u0443\u044E)", _jsx("input", { value: form.tags, onChange: e => setForm(f => ({ ...f, tags: e.target.value })), style: { ...INPUT, marginTop: 4 }, placeholder: "\u0443\u043A\u043B\u0430\u0434\u043A\u0430, \u043F\u043B\u0438\u0442\u043A\u0430, \u0441\u0430\u043D\u0443\u0437\u0435\u043B" })] })] }), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 16 }, children: [_jsx("button", { onClick: save, disabled: saving || !form.name.trim(), style: btnPrimary(), children: saving ? 'Сохранение...' : 'Сохранить' }), _jsx("button", { onClick: () => setShowForm(false), style: btnOutline(), children: "\u041E\u0442\u043C\u0435\u043D\u0430" })] })] }) }))] }));
}
function fmt(v) { return v.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
