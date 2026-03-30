import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import client from '../api/client';
const KIND_LABELS = { client: 'Заказчик', supplier: 'Поставщик', subcontractor: 'Субподрядчик' };
const KINDS = ['client', 'supplier', 'subcontractor'];
const empty = { kind: 'client', name: '', inn: '', kpp: '', address: '', contact: '', notes: '' };
export default function Contractors() {
    const [list, setList] = useState([]);
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ ...empty });
    const [editId, setEditId] = useState(null);
    const [saving, setSaving] = useState(false);
    async function load() {
        const r = await client.get('/contractors');
        setList(r.data);
    }
    useEffect(() => { load(); }, []);
    function openAdd() { setForm({ ...empty }); setEditId(null); setShowForm(true); }
    function openEdit(c) {
        setForm({ kind: c.kind, name: c.name, inn: c.inn || '', kpp: c.kpp || '', address: c.address || '', contact: c.contact || '', notes: c.notes || '' });
        setEditId(c.id);
        setShowForm(true);
    }
    async function save() {
        setSaving(true);
        try {
            if (editId)
                await client.put(`/contractors/${editId}`, form);
            else
                await client.post('/contractors', form);
            setShowForm(false);
            load();
        }
        finally {
            setSaving(false);
        }
    }
    async function del(id) {
        if (!confirm('Удалить контрагента?'))
            return;
        await client.delete(`/contractors/${id}`);
        load();
    }
    const visible = list.filter(c => (filter === 'all' || c.kind === filter) &&
        (!search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.inn || '').includes(search)));
    return (_jsxs("div", { style: { padding: 24, maxWidth: 1100 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }, children: [_jsx("h2", { style: { margin: 0 }, children: "\u041A\u043E\u043D\u0442\u0440\u0430\u0433\u0435\u043D\u0442\u044B" }), _jsx("button", { onClick: openAdd, style: btn('#1565c0'), children: "+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C" })] }), _jsxs("div", { style: { display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }, children: [['all', ...KINDS].map(k => (_jsx("button", { onClick: () => setFilter(k), style: { padding: '4px 14px', borderRadius: 4, border: '1px solid #ccc', background: filter === k ? '#1565c0' : '#fff', color: filter === k ? '#fff' : '#333', cursor: 'pointer', fontSize: 13 }, children: k === 'all' ? 'Все' : KIND_LABELS[k] }, k))), _jsx("input", { value: search, onChange: e => setSearch(e.target.value), placeholder: "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044E \u0438\u043B\u0438 \u0418\u041D\u041D...", style: { padding: '4px 10px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13, minWidth: 220 } })] }), visible.length === 0
                ? _jsx("div", { style: { padding: 32, textAlign: 'center', color: '#aaa' }, children: "\u041D\u0435\u0442 \u043A\u043E\u043D\u0442\u0440\u0430\u0433\u0435\u043D\u0442\u043E\u0432" })
                : (_jsx("div", { style: { overflowX: 'auto' }, children: _jsxs("table", { style: { width: '100%', borderCollapse: 'collapse', fontSize: 13 }, children: [_jsx("thead", { children: _jsx("tr", { style: { background: '#f5f5f5' }, children: ['Тип', 'Наименование', 'ИНН', 'КПП', 'Контакт', 'Адрес', ''].map(h => (_jsx("th", { style: { padding: '8px 10px', border: '1px solid #e0e0e0', textAlign: 'left', fontWeight: 600 }, children: h }, h))) }) }), _jsx("tbody", { children: visible.map(c => (_jsxs("tr", { children: [_jsx("td", { style: td, children: _jsx("span", { style: { padding: '2px 8px', borderRadius: 10, fontSize: 11, background: kindColor(c.kind), color: '#fff' }, children: KIND_LABELS[c.kind] }) }), _jsx("td", { style: { ...td, fontWeight: 500 }, children: c.name }), _jsx("td", { style: td, children: c.inn || '—' }), _jsx("td", { style: td, children: c.kpp || '—' }), _jsx("td", { style: td, children: c.contact || '—' }), _jsx("td", { style: { ...td, maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, children: c.address || '—' }), _jsx("td", { style: td, children: _jsxs("div", { style: { display: 'flex', gap: 4 }, children: [_jsx("button", { onClick: () => openEdit(c), style: { padding: '2px 8px', fontSize: 11, border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', background: '#fff' }, children: "\u270E" }), _jsx("button", { onClick: () => del(c.id), style: { padding: '2px 6px', fontSize: 11, border: '1px solid #ef9a9a', borderRadius: 4, cursor: 'pointer', background: '#ffebee', color: '#c62828' }, children: "\u2715" })] }) })] }, c.id))) })] }) })), showForm && (_jsx("div", { style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }, children: _jsxs("div", { style: { background: '#fff', borderRadius: 8, padding: 24, width: '90%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }, children: [_jsxs("h3", { style: { margin: '0 0 16px' }, children: [editId ? 'Редактировать' : 'Добавить', " \u043A\u043E\u043D\u0442\u0440\u0430\u0433\u0435\u043D\u0442\u0430"] }), _jsxs("div", { style: { display: 'grid', gap: 10 }, children: [_jsxs("label", { style: lbl, children: ["\u0422\u0438\u043F", _jsx("select", { value: form.kind, onChange: e => setForm(f => ({ ...f, kind: e.target.value })), style: inp, children: KINDS.map(k => _jsx("option", { value: k, children: KIND_LABELS[k] }, k)) })] }), _jsxs("label", { style: lbl, children: ["\u041D\u0430\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u0435 *", _jsx("input", { required: true, value: form.name, onChange: e => setForm(f => ({ ...f, name: e.target.value })), style: inp })] }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }, children: [_jsxs("label", { style: lbl, children: ["\u0418\u041D\u041D", _jsx("input", { value: form.inn, onChange: e => setForm(f => ({ ...f, inn: e.target.value })), style: inp })] }), _jsxs("label", { style: lbl, children: ["\u041A\u041F\u041F", _jsx("input", { value: form.kpp, onChange: e => setForm(f => ({ ...f, kpp: e.target.value })), style: inp })] })] }), _jsxs("label", { style: lbl, children: ["\u041A\u043E\u043D\u0442\u0430\u043A\u0442 (\u0442\u0435\u043B/email)", _jsx("input", { value: form.contact, onChange: e => setForm(f => ({ ...f, contact: e.target.value })), style: inp })] }), _jsxs("label", { style: lbl, children: ["\u0410\u0434\u0440\u0435\u0441", _jsx("input", { value: form.address, onChange: e => setForm(f => ({ ...f, address: e.target.value })), style: inp })] }), _jsxs("label", { style: lbl, children: ["\u041F\u0440\u0438\u043C\u0435\u0447\u0430\u043D\u0438\u0435", _jsx("textarea", { value: form.notes, onChange: e => setForm(f => ({ ...f, notes: e.target.value })), rows: 2, style: { ...inp, resize: 'vertical' } })] })] }), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 16 }, children: [_jsx("button", { onClick: save, disabled: saving || !form.name.trim(), style: btn('#1565c0'), children: saving ? 'Сохранение...' : 'Сохранить' }), _jsx("button", { onClick: () => setShowForm(false), style: btn('#757575'), children: "\u041E\u0442\u043C\u0435\u043D\u0430" })] })] }) }))] }));
}
function kindColor(k) { return k === 'client' ? '#1565c0' : k === 'supplier' ? '#2e7d32' : '#6a1b9a'; }
const td = { padding: '6px 10px', border: '1px solid #e0e0e0', verticalAlign: 'middle' };
const lbl = { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 13 };
const inp = { padding: '6px 10px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13, width: '100%', boxSizing: 'border-box' };
function btn(bg) { return { padding: '7px 16px', background: bg, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }; }
