import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState, useMemo } from 'react';
import client from '../api/client';
import { C, btnPrimary, btnOutline, btnDanger, INPUT, LBL, CARD, TH, TD, OVERLAY, MODAL } from '../ui';
const STATUS_LABELS = {
    pending: 'Ожидается',
    received: 'Получено',
    accepted: 'Принято',
    rejected: 'Отклонено',
};
function fmt(n) {
    return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
const emptyForm = () => ({
    item_name: '',
    unit: '',
    quantity: '',
    unit_price: '0',
    supplier_id: '',
    notes: '',
    estimate_item_id: '',
    max_qty: Infinity,
    mode: 'estimate',
});
export default function KpRequests({ projectId }) {
    const [requests, setRequests] = useState([]);
    const [estimateItems, setEstimateItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modal, setModal] = useState(null);
    const [form, setForm] = useState(emptyForm());
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const load = async () => {
        setLoading(true);
        try {
            const [reqR, eiR] = await Promise.all([
                client.get(`/projects/${projectId}/kp-requests`),
                client.get(`/projects/${projectId}/kp-estimate-items`),
            ]);
            setRequests(reqR.data);
            setEstimateItems(eiR.data);
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => { load(); }, [projectId]);
    const estimateReqs = useMemo(() => requests.filter(r => r.estimate_item_id), [requests]);
    const extraReqs = useMemo(() => requests.filter(r => !r.estimate_item_id), [requests]);
    const grouped = useMemo(() => {
        const q = search.trim().toLowerCase();
        const filtered = q
            ? estimateItems.filter(i => i.name.toLowerCase().includes(q) || i.section.toLowerCase().includes(q))
            : estimateItems;
        const map = new Map();
        for (const item of filtered) {
            const key = [item.task_name, item.section].filter(Boolean).join(' — ') || 'Без раздела';
            if (!map.has(key))
                map.set(key, []);
            map.get(key).push(item);
        }
        return map;
    }, [estimateItems, search]);
    const openNew = () => { setForm(emptyForm()); setSearch(''); setModal('new'); };
    const openEdit = (req) => {
        setForm({
            item_name: req.item_name,
            unit: req.unit || '',
            quantity: String(req.quantity),
            unit_price: String(req.unit_price),
            supplier_id: req.supplier_id || '',
            notes: req.notes || '',
            estimate_item_id: req.estimate_item_id || '',
            max_qty: Infinity,
            mode: req.estimate_item_id ? 'estimate' : 'custom',
        });
        setModal(req);
    };
    const selectEstimateItem = (item) => {
        setForm(f => ({ ...f, item_name: item.name, unit: item.unit, quantity: String(item.quantity), estimate_item_id: item.id, max_qty: item.quantity }));
        setSearch('');
    };
    const computedTotal = () => (parseFloat(form.quantity) || 0) * (parseFloat(form.unit_price) || 0);
    const save = async () => {
        setSaving(true);
        try {
            const qty = Math.min(parseFloat(form.quantity) || 0, form.max_qty === Infinity ? Infinity : form.max_qty);
            const payload = {
                item_name: form.item_name,
                unit: form.unit || undefined,
                quantity: qty,
                unit_price: parseFloat(form.unit_price) || 0,
                supplier_id: form.supplier_id || undefined,
                notes: form.notes || undefined,
                estimate_item_id: form.estimate_item_id || undefined,
            };
            if (modal === 'new') {
                await client.post(`/projects/${projectId}/kp-requests`, payload);
            }
            else if (modal) {
                await client.patch(`/projects/${projectId}/kp-requests/${modal.id}`, payload);
            }
            setModal(null);
            load();
        }
        finally {
            setSaving(false);
        }
    };
    const deleteRequest = async (id) => {
        if (!confirm('Удалить?'))
            return;
        await client.delete(`/projects/${projectId}/kp-requests/${id}`);
        load();
    };
    const changeStatus = async (id, s) => {
        await client.patch(`/projects/${projectId}/kp-requests/${id}`, { status: s });
        load();
    };
    const fld = (field, val) => setForm(f => ({ ...f, [field]: val }));
    const renderTable = (rows, title, extra) => (_jsxs("div", { style: { borderRadius: 8, border: `1px solid ${extra ? C.dangerBorder : C.border}`, overflow: 'hidden', marginBottom: 10 }, children: [_jsxs("div", { style: { padding: '8px 14px', background: extra ? C.dangerBg : C.primaryBg, borderBottom: `1px solid ${extra ? C.dangerBorder : C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsx("span", { style: { fontSize: 13, fontWeight: 700, color: extra ? C.danger : C.primary }, children: title }), _jsxs("span", { style: { fontSize: 12, color: C.textSec }, children: ["\u0418\u0442\u043E\u0433\u043E: ", fmt(rows.reduce((s, r) => s + r.total, 0)), " \u20BD"] })] }), _jsxs("table", { style: { width: '100%', borderCollapse: 'collapse', fontSize: 13 }, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: TH, children: "\u041F\u043E\u0437\u0438\u0446\u0438\u044F" }), _jsx("th", { style: TH, children: "\u0415\u0434." }), _jsx("th", { style: TH, children: "\u041A\u043E\u043B-\u0432\u043E" }), _jsx("th", { style: TH, children: "\u0426\u0435\u043D\u0430" }), _jsx("th", { style: TH, children: "\u0421\u0443\u043C\u043C\u0430" }), _jsx("th", { style: TH, children: "\u0421\u0442\u0430\u0442\u0443\u0441" }), _jsx("th", { style: TH })] }) }), _jsx("tbody", { children: rows.map(req => (_jsxs("tr", { children: [_jsxs("td", { style: TD, children: [_jsx("div", { style: { fontWeight: 500 }, children: req.item_name }), req.notes && _jsx("div", { style: { fontSize: 11, color: C.textSec, marginTop: 2 }, children: req.notes })] }), _jsx("td", { style: TD, children: req.unit || '—' }), _jsx("td", { style: TD, children: req.quantity }), _jsxs("td", { style: TD, children: [fmt(req.unit_price), " \u20BD"] }), _jsxs("td", { style: { ...TD, fontWeight: 600 }, children: [fmt(req.total), " \u20BD"] }), _jsx("td", { style: TD, children: _jsx("select", { value: req.status, onChange: e => changeStatus(req.id, e.target.value), style: { ...INPUT, fontSize: 12, padding: '2px 6px', width: 'auto' }, children: Object.entries(STATUS_LABELS).map(([v, l]) => _jsx("option", { value: v, children: l }, v)) }) }), _jsx("td", { style: TD, children: _jsxs("div", { style: { display: 'flex', gap: 4 }, children: [_jsx("button", { style: btnOutline('sm'), onClick: () => openEdit(req), children: "\u270E" }), _jsx("button", { style: btnDanger('sm'), onClick: () => deleteRequest(req.id), children: "\u2715" })] }) })] }, req.id))) })] })] }));
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 12 }, children: [_jsx("div", { style: { display: 'flex', justifyContent: 'flex-end' }, children: _jsx("button", { style: btnPrimary('sm'), onClick: openNew, children: "+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B" }) }), loading ? (_jsx("div", { style: { padding: 24, textAlign: 'center', color: C.textMuted }, children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430..." })) : requests.length === 0 ? (_jsx("div", { style: { ...CARD, padding: 40, textAlign: 'center', color: C.textMuted }, children: "\u041D\u0435\u0442 \u0437\u0430\u044F\u0432\u043E\u043A \u043D\u0430 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u044B" })) : (_jsxs(_Fragment, { children: [estimateReqs.length > 0 && renderTable(estimateReqs, 'Материалы по смете'), extraReqs.length > 0 && renderTable(extraReqs, 'Дополнительные затраты', true)] })), modal !== null && (_jsx("div", { style: OVERLAY, onClick: e => { if (e.target === e.currentTarget)
                    setModal(null); }, children: _jsxs("div", { style: { ...MODAL, maxWidth: 540, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }, children: [_jsx("h3", { style: { margin: '0 0 14px', fontSize: 16, fontWeight: 600 }, children: modal === 'new' ? 'Добавить материал' : 'Редактировать' }), modal === 'new' && (_jsx("div", { style: { display: 'flex', gap: 0, marginBottom: 14, borderRadius: 6, overflow: 'hidden', border: `1px solid ${C.border}` }, children: ['estimate', 'custom'].map(m => (_jsx("button", { onClick: () => { setForm(f => ({ ...f, mode: m, item_name: '', unit: '', quantity: '', estimate_item_id: '', max_qty: Infinity })); setSearch(''); }, style: { flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: form.mode === m ? C.primary : C.surfaceAlt, color: form.mode === m ? '#fff' : C.textSec }, children: m === 'estimate' ? 'Из сметы' : 'Произвольно (доп. затраты)' }, m))) })), _jsxs("div", { style: { overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }, children: [form.mode === 'estimate' && (_jsx("div", { children: form.estimate_item_id ? (_jsxs("div", { style: { padding: '8px 12px', background: C.primaryBg, borderRadius: 6, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }, children: [_jsx("span", { style: { color: C.primary, fontWeight: 600 }, children: form.item_name }), _jsx("button", { onClick: () => setForm(f => ({ ...f, item_name: '', unit: '', quantity: '', estimate_item_id: '', max_qty: Infinity })), style: { background: 'none', border: 'none', cursor: 'pointer', color: C.textSec, fontSize: 12 }, children: "\u0421\u043C\u0435\u043D\u0438\u0442\u044C" })] })) : (_jsxs(_Fragment, { children: [_jsx("input", { style: { ...INPUT, marginBottom: 8 }, placeholder: "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u043D\u0430\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u044E \u0438\u043B\u0438 \u0440\u0430\u0437\u0434\u0435\u043B\u0443...", value: search, onChange: e => setSearch(e.target.value) }), _jsxs("div", { style: { border: `1px solid ${C.border}`, borderRadius: 6, maxHeight: 250, overflow: 'auto' }, children: [grouped.size === 0 && _jsx("div", { style: { padding: 16, color: C.textMuted, fontSize: 13, textAlign: 'center' }, children: "\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E" }), Array.from(grouped.entries()).map(([section, items]) => (_jsxs("div", { children: [_jsx("div", { style: { padding: '5px 10px', fontSize: 11, fontWeight: 700, color: C.textSec, background: C.surfaceAlt, borderBottom: `1px solid ${C.border}` }, children: section }), items.map(item => (_jsxs("div", { onClick: () => selectEstimateItem(item), style: { padding: '7px 12px', cursor: 'pointer', fontSize: 13, borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, onMouseEnter: e => (e.currentTarget.style.background = C.primaryBg), onMouseLeave: e => (e.currentTarget.style.background = ''), children: [_jsx("span", { children: item.name }), _jsxs("span", { style: { color: C.textSec, fontSize: 12, marginLeft: 8, whiteSpace: 'nowrap' }, children: [item.quantity, " ", item.unit] })] }, item.id)))] }, section)))] })] })) })), form.mode === 'custom' && (_jsxs("label", { style: LBL, children: ["\u041D\u0430\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u0435 *", _jsx("input", { style: INPUT, value: form.item_name, onChange: e => fld('item_name', e.target.value), placeholder: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u0430 \u0438\u043B\u0438 \u043F\u043E\u0437\u0438\u0446\u0438\u0438" })] })), (form.estimate_item_id || form.mode === 'custom' || modal !== 'new') && (_jsxs(_Fragment, { children: [_jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }, children: [_jsxs("label", { style: LBL, children: ["\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E", form.max_qty !== Infinity ? ` (макс. ${form.max_qty})` : '', _jsx("input", { style: INPUT, type: "number", min: "0", max: form.max_qty !== Infinity ? form.max_qty : undefined, step: "any", value: form.quantity, onChange: e => {
                                                                const v = parseFloat(e.target.value) || 0;
                                                                fld('quantity', String(form.max_qty !== Infinity ? Math.min(v, form.max_qty) : v));
                                                            } })] }), _jsxs("label", { style: LBL, children: ["\u0415\u0434. \u0438\u0437\u043C.", _jsx("input", { style: INPUT, value: form.unit, onChange: e => fld('unit', e.target.value), placeholder: "\u0448\u0442, \u043C\u00B2, \u043A\u0433...", readOnly: !!form.estimate_item_id && modal === 'new' })] })] }), _jsxs("label", { style: LBL, children: ["\u0426\u0435\u043D\u0430 \u0437\u0430 \u0435\u0434\u0438\u043D\u0438\u0446\u0443 \u20BD", _jsx("input", { style: INPUT, type: "number", min: "0", step: "any", value: form.unit_price, onChange: e => fld('unit_price', e.target.value) })] }), _jsxs("div", { style: { padding: '8px 12px', background: C.primaryBg, borderRadius: 6, fontSize: 13 }, children: [_jsx("span", { style: { color: C.textSec }, children: "\u0418\u0442\u043E\u0433\u043E: " }), _jsxs("strong", { style: { color: C.primary }, children: [fmt(computedTotal()), " \u20BD"] })] }), _jsxs("label", { style: LBL, children: ["\u041F\u0440\u0438\u043C\u0435\u0447\u0430\u043D\u0438\u044F", _jsx("textarea", { style: { ...INPUT, marginTop: 4, resize: 'vertical' }, rows: 2, value: form.notes, onChange: e => fld('notes', e.target.value) })] })] }))] }), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end', borderTop: `1px solid ${C.border}`, paddingTop: 14 }, children: [_jsx("button", { style: btnOutline(), onClick: () => setModal(null), children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { style: btnPrimary(), onClick: save, disabled: saving || !form.item_name.trim(), children: saving ? 'Сохранение...' : 'Сохранить' })] })] }) }))] }));
}
