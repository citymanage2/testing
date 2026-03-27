import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import client from '../api/client';
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const TASK_TYPES = ['', 'LIST_FROM_TZ', 'LIST_FROM_TZ_PROJECT', 'LIST_FROM_PROJECT', 'RESEARCH_PROJECT', 'SMETA_FROM_LIST', 'SMETA_FROM_TZ', 'SMETA_FROM_TZ_PROJECT', 'SMETA_FROM_PROJECT', 'SMETA_FROM_EDC_PROJECT', 'SMETA_FROM_GRAND_PROJECT', 'SCAN_TO_EXCEL', 'COMPARE_PROJECT_SMETA'];
const STATUSES = ['', 'pending', 'processing', 'completed', 'failed', 'cancelled'];
export default function Admin() {
    const [tab, setTab] = useState('tasks');
    return (_jsxs("div", { style: { padding: 24, maxWidth: 1100, margin: '0 auto' }, children: [_jsx("h2", { style: { marginTop: 0 }, children: "\u0410\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435" }), _jsx("div", { style: { display: 'flex', borderBottom: '2px solid #e0e0e0', marginBottom: 24 }, children: ['tasks', 'pricelists'].map((t) => (_jsx("button", { onClick: () => setTab(t), style: { padding: '9px 20px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: tab === t ? 700 : 400, color: tab === t ? '#1565c0' : '#555', borderBottom: tab === t ? '2px solid #1565c0' : '2px solid transparent', marginBottom: -2, fontSize: 14 }, children: t === 'tasks' ? 'Задачи' : 'Прайс-листы' }, t))) }), tab === 'tasks' ? _jsx(TasksTab, {}) : _jsx(PriceListsTab, {})] }));
}
function TasksTab() {
    const [filters, setFilters] = useState({ status: '', task_type: '', date_from: '', date_to: '' });
    const [tasks, setTasks] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [detail, setDetail] = useState(null);
    const PAGE_SIZE = 20;
    async function load(p = page) {
        setLoading(true);
        try {
            const params = { page: p, page_size: PAGE_SIZE };
            if (filters.status)
                params.status = filters.status;
            if (filters.task_type)
                params.task_type = filters.task_type;
            if (filters.date_from)
                params.date_from = filters.date_from;
            if (filters.date_to)
                params.date_to = filters.date_to;
            const { data } = await client.get('/admin/tasks', { params });
            setTasks(data.items);
            setTotal(data.total);
        }
        catch {
            setTasks([]);
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => { load(page); }, [page]);
    const totalPages = Math.ceil(total / PAGE_SIZE);
    return (_jsxs("div", { children: [_jsxs("form", { onSubmit: (e) => { e.preventDefault(); setPage(1); load(1); }, style: { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20, alignItems: 'flex-end' }, children: [_jsxs("div", { children: [_jsx("label", { style: lbl, children: "\u0421\u0442\u0430\u0442\u0443\u0441" }), _jsx("select", { value: filters.status, onChange: (e) => setFilters((f) => ({ ...f, status: e.target.value })), style: sel, children: STATUSES.map((s) => _jsx("option", { value: s, children: s || 'Все' }, s)) })] }), _jsxs("div", { children: [_jsx("label", { style: lbl, children: "\u0422\u0438\u043F" }), _jsx("select", { value: filters.task_type, onChange: (e) => setFilters((f) => ({ ...f, task_type: e.target.value })), style: sel, children: TASK_TYPES.map((t) => _jsx("option", { value: t, children: t || 'Все' }, t)) })] }), _jsxs("div", { children: [_jsx("label", { style: lbl, children: "\u041E\u0442" }), _jsx("input", { type: "date", value: filters.date_from, onChange: (e) => setFilters((f) => ({ ...f, date_from: e.target.value })), style: inp })] }), _jsxs("div", { children: [_jsx("label", { style: lbl, children: "\u0414\u043E" }), _jsx("input", { type: "date", value: filters.date_to, onChange: (e) => setFilters((f) => ({ ...f, date_to: e.target.value })), style: inp })] }), _jsx("button", { type: "submit", style: { padding: '7px 16px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }, children: "\u041F\u0440\u0438\u043C\u0435\u043D\u0438\u0442\u044C" })] }), loading && _jsx("p", { style: { color: '#aaa' }, children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430..." }), !loading && tasks.length === 0 && _jsx("p", { style: { textAlign: 'center', color: '#aaa', padding: '24px 0' }, children: "\u0417\u0430\u0434\u0430\u0447 \u043D\u0435\u0442" }), !loading && tasks.length > 0 && (_jsxs(_Fragment, { children: [_jsxs("table", { style: { width: '100%', borderCollapse: 'collapse', fontSize: 13 }, children: [_jsx("thead", { children: _jsx("tr", { style: { background: '#f5f5f5' }, children: ['ID', 'Тип', 'Статус', 'Дата', 'Действия'].map((h) => _jsx("th", { style: th, children: h }, h)) }) }), _jsx("tbody", { children: tasks.map((t) => (_jsxs("tr", { style: { borderBottom: '1px solid #f0f0f0' }, children: [_jsxs("td", { style: tdS, children: [t.id.slice(0, 8), "\u2026"] }), _jsx("td", { style: tdS, children: t.task_type }), _jsx("td", { style: tdS, children: t.status }), _jsx("td", { style: tdS, children: new Date(t.created_at).toLocaleString('ru-RU') }), _jsxs("td", { style: { ...tdS, whiteSpace: 'nowrap' }, children: [_jsx("button", { onClick: async () => setDetail((await client.get(`/admin/tasks/${t.id}`)).data), style: aBtn('#1565c0'), children: "\u0414\u0435\u0442\u0430\u043B\u0438" }), _jsx("a", { href: `${API_BASE}/admin/tasks/${t.id}/download-input/0`, target: "_blank", rel: "noreferrer", style: { ...aBtn('#4caf50'), marginLeft: 6, textDecoration: 'none', display: 'inline-block' }, children: "\u0421\u043A\u0430\u0447\u0430\u0442\u044C" }), _jsx("button", { onClick: async () => { if (confirm(`Удалить ${t.id}?`)) {
                                                        await client.delete(`/admin/tasks/${t.id}`);
                                                        load(page);
                                                    } }, style: { ...aBtn('#f44336'), marginLeft: 6 }, children: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C" })] })] }, t.id))) })] }), totalPages > 1 && (_jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 14, alignItems: 'center' }, children: [_jsx("button", { onClick: () => setPage((p) => Math.max(1, p - 1)), disabled: page === 1, style: aBtn('#757575'), children: "\u2190" }), _jsxs("span", { children: ["\u0421\u0442\u0440. ", page, " / ", totalPages] }), _jsx("button", { onClick: () => setPage((p) => Math.min(totalPages, p + 1)), disabled: page === totalPages, style: aBtn('#757575'), children: "\u2192" })] }))] })), detail && (_jsx("div", { onClick: () => setDetail(null), style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }, children: _jsxs("div", { onClick: (e) => e.stopPropagation(), style: { background: '#fff', borderRadius: 8, padding: 24, maxWidth: 600, width: '90%', maxHeight: '80vh', overflowY: 'auto' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 12 }, children: [_jsx("h3", { style: { margin: 0 }, children: "\u0414\u0435\u0442\u0430\u043B\u0438 \u0437\u0430\u0434\u0430\u0447\u0438" }), _jsx("button", { onClick: () => setDetail(null), style: { border: 'none', background: 'none', fontSize: 22, cursor: 'pointer' }, children: "\u00D7" })] }), _jsx("pre", { style: { fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }, children: JSON.stringify(detail, null, 2) })] }) }))] }));
}
function PriceListsTab() {
    const [info, setInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const worksRef = useRef(null);
    const matsRef = useRef(null);
    async function loadInfo() {
        try {
            setInfo((await client.get('/admin/price-lists/info')).data);
        }
        catch {
            setInfo(null);
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => { loadInfo(); }, []);
    async function upload(type, file) {
        const fd = new FormData();
        fd.append('file', file);
        try {
            await client.post(`/admin/price-lists/${type}`, fd);
            await loadInfo();
        }
        catch {
            alert('Ошибка загрузки');
        }
    }
    if (loading)
        return _jsx("p", { style: { color: '#aaa' }, children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430..." });
    return (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 20 }, children: ['works', 'materials'].map((type) => {
            const item = type === 'works' ? info?.works : info?.materials;
            const ref = type === 'works' ? worksRef : matsRef;
            const label = type === 'works' ? 'Прайс работ' : 'Прайс материалов';
            return (_jsxs("div", { style: { border: '1px solid #e0e0e0', borderRadius: 6, padding: '16px 20px', maxWidth: 480, background: '#fafafa' }, children: [_jsx("h3", { style: { margin: '0 0 8px' }, children: label }), item ? _jsxs("p", { style: { margin: '0 0 10px', fontSize: 14, color: '#555' }, children: [_jsx("strong", { children: item.filename }), " \u2014 ", new Date(item.updated_at).toLocaleString('ru-RU')] })
                        : _jsx("p", { style: { margin: '0 0 10px', fontSize: 14, color: '#aaa' }, children: "\u0424\u0430\u0439\u043B \u043D\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D" }), _jsx("button", { onClick: () => ref.current?.click(), style: { padding: '7px 16px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }, children: "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C XLSX" }), _jsx("input", { ref: ref, type: "file", accept: ".xlsx,.xls", style: { display: 'none' }, onChange: (e) => { const f = e.target.files?.[0]; if (f)
                            upload(type, f); e.target.value = ''; } })] }, type));
        }) }));
}
const lbl = { display: 'block', fontSize: 12, marginBottom: 4, color: '#666' };
const sel = { padding: '6px 10px', fontSize: 13, borderRadius: 4, border: '1px solid #ccc' };
const inp = { padding: '6px 10px', fontSize: 13, borderRadius: 4, border: '1px solid #ccc' };
const th = { padding: '8px 10px', textAlign: 'left', border: '1px solid #e0e0e0', fontWeight: 600, whiteSpace: 'nowrap' };
const tdS = { padding: '7px 10px', border: '1px solid #e0e0e0', verticalAlign: 'middle' };
function aBtn(bg) { return { padding: '4px 10px', background: bg, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }; }
