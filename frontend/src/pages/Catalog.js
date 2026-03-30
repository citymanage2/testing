import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import client from '../api/client';
const empty = { item_type: 'work', name: '', unit: '', work_price: '0', mat_price: '0', tags: '' };
export default function Catalog() {
    const [list, setList] = useState([]);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ ...empty });
    const [editId, setEditId] = useState(null);
    const [saving, setSaving] = useState(false);
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
    useEffect(() => { load(search || undefined); }, [search, typeFilter]);
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
    return (_jsxs("div", { style: { padding: 24, maxWidth: 1100 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }, children: [_jsx("h2", { style: { margin: 0 }, children: "\u041A\u043E\u0440\u043F\u043E\u0440\u0430\u0442\u0438\u0432\u043D\u044B\u0439 \u043A\u0430\u0442\u0430\u043B\u043E\u0433 \u0440\u0430\u0441\u0446\u0435\u043D\u043E\u043A" }), _jsx("button", { onClick: openAdd, style: btn('#1565c0'), children: "+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C" })] }), _jsxs("div", { style: { display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }, children: [[['all', 'Все'], ['work', 'Работы'], ['material', 'Материалы']].map(([v, l]) => (_jsx("button", { onClick: () => setTypeFilter(v), style: { padding: '4px 14px', borderRadius: 4, border: '1px solid #ccc', background: typeFilter === v ? '#1565c0' : '#fff', color: typeFilter === v ? '#fff' : '#333', cursor: 'pointer', fontSize: 13 }, children: l }, v))), _jsx("input", { value: search, onChange: e => setSearch(e.target.value), placeholder: "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044E...", style: { padding: '4px 10px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13, minWidth: 240 } }), _jsxs("span", { style: { fontSize: 12, color: '#888', marginLeft: 4 }, children: [list.length, " \u0437\u0430\u043F\u0438\u0441\u0435\u0439"] })] }), list.length === 0
                ? _jsx("div", { style: { padding: 32, textAlign: 'center', color: '#aaa' }, children: "\u041A\u0430\u0442\u0430\u043B\u043E\u0433 \u043F\u0443\u0441\u0442. \u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0437\u0430\u043F\u0438\u0441\u0438 \u0432\u0440\u0443\u0447\u043D\u0443\u044E \u0438\u043B\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0439\u0442\u0435 \u0441\u0442\u0440\u043E\u043A\u0438 \u0438\u0437 \u0441\u043C\u0435\u0442." })
                : (_jsx("div", { style: { overflowX: 'auto' }, children: _jsxs("table", { style: { width: '100%', borderCollapse: 'collapse', fontSize: 13 }, children: [_jsx("thead", { children: _jsx("tr", { style: { background: '#f5f5f5' }, children: ['Тип', 'Наименование', 'Ед.', 'Цена работ', 'Цена мат.', 'Теги', ''].map(h => (_jsx("th", { style: { padding: '8px 10px', border: '1px solid #e0e0e0', textAlign: 'left', fontWeight: 600 }, children: h }, h))) }) }), _jsx("tbody", { children: list.map(e => (_jsxs("tr", { children: [_jsx("td", { style: td, children: _jsx("span", { style: { padding: '2px 7px', borderRadius: 10, fontSize: 11, background: e.item_type === 'work' ? '#1565c0' : '#2e7d32', color: '#fff' }, children: e.item_type === 'work' ? 'Работа' : 'Материал' }) }), _jsx("td", { style: { ...td, fontWeight: 500, maxWidth: 320 }, children: e.name }), _jsx("td", { style: td, children: e.unit || '—' }), _jsx("td", { style: td, children: e.work_price > 0 ? fmt(e.work_price) : '—' }), _jsx("td", { style: td, children: e.mat_price > 0 ? fmt(e.mat_price) : '—' }), _jsx("td", { style: td, children: (e.tags || []).map(t => _jsx("span", { style: { marginRight: 4, padding: '1px 5px', background: '#e3f2fd', borderRadius: 10, fontSize: 11 }, children: t }, t)) }), _jsx("td", { style: td, children: _jsxs("div", { style: { display: 'flex', gap: 4 }, children: [_jsx("button", { onClick: () => openEdit(e), style: { padding: '2px 8px', fontSize: 11, border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', background: '#fff' }, children: "\u270E" }), _jsx("button", { onClick: () => del(e.id), style: { padding: '2px 6px', fontSize: 11, border: '1px solid #ef9a9a', borderRadius: 4, cursor: 'pointer', background: '#ffebee', color: '#c62828' }, children: "\u2715" })] }) })] }, e.id))) })] }) })), showForm && (_jsx("div", { style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }, children: _jsxs("div", { style: { background: '#fff', borderRadius: 8, padding: 24, width: '90%', maxWidth: 480 }, children: [_jsxs("h3", { style: { margin: '0 0 16px' }, children: [editId ? 'Редактировать' : 'Добавить', " \u0440\u0430\u0441\u0446\u0435\u043D\u043A\u0443"] }), _jsxs("div", { style: { display: 'grid', gap: 10 }, children: [_jsxs("label", { style: lbl, children: ["\u0422\u0438\u043F", _jsxs("select", { value: form.item_type, onChange: e => setForm(f => ({ ...f, item_type: e.target.value })), style: inp, children: [_jsx("option", { value: "work", children: "\u0420\u0430\u0431\u043E\u0442\u0430" }), _jsx("option", { value: "material", children: "\u041C\u0430\u0442\u0435\u0440\u0438\u0430\u043B" })] })] }), _jsxs("label", { style: lbl, children: ["\u041D\u0430\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u0435 *", _jsx("input", { value: form.name, onChange: e => setForm(f => ({ ...f, name: e.target.value })), style: inp })] }), _jsxs("label", { style: lbl, children: ["\u0415\u0434\u0438\u043D\u0438\u0446\u0430 \u0438\u0437\u043C\u0435\u0440\u0435\u043D\u0438\u044F", _jsx("input", { value: form.unit, onChange: e => setForm(f => ({ ...f, unit: e.target.value })), style: inp })] }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }, children: [_jsxs("label", { style: lbl, children: ["\u0426\u0435\u043D\u0430 \u0440\u0430\u0431\u043E\u0442 \u20BD", _jsx("input", { type: "number", value: form.work_price, onChange: e => setForm(f => ({ ...f, work_price: e.target.value })), style: inp })] }), _jsxs("label", { style: lbl, children: ["\u0426\u0435\u043D\u0430 \u043C\u0430\u0442. \u20BD", _jsx("input", { type: "number", value: form.mat_price, onChange: e => setForm(f => ({ ...f, mat_price: e.target.value })), style: inp })] })] }), _jsxs("label", { style: lbl, children: ["\u0422\u0435\u0433\u0438 (\u0447\u0435\u0440\u0435\u0437 \u0437\u0430\u043F\u044F\u0442\u0443\u044E)", _jsx("input", { value: form.tags, onChange: e => setForm(f => ({ ...f, tags: e.target.value })), style: inp, placeholder: "\u0443\u043A\u043B\u0430\u0434\u043A\u0430, \u043F\u043B\u0438\u0442\u043A\u0430, \u0441\u0430\u043D\u0443\u0437\u0435\u043B" })] })] }), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 16 }, children: [_jsx("button", { onClick: save, disabled: saving || !form.name.trim(), style: btn('#1565c0'), children: saving ? 'Сохранение...' : 'Сохранить' }), _jsx("button", { onClick: () => setShowForm(false), style: btn('#757575'), children: "\u041E\u0442\u043C\u0435\u043D\u0430" })] })] }) }))] }));
}
function fmt(v) { return v.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
const td = { padding: '6px 10px', border: '1px solid #e0e0e0', verticalAlign: 'middle' };
const lbl = { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 13 };
const inp = { padding: '6px 10px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13, width: '100%', boxSizing: 'border-box' };
function btn(bg) { return { padding: '7px 16px', background: bg, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }; }
