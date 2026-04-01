import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import client from '../api/client';
import { C, CARD, INPUT, LBL, MODAL, OVERLAY, TD, TH, badge, btnDanger, btnGhost, btnOutline, btnPrimary, } from '../ui';
const STATUS_LABELS = { draft: 'Черновик', approval: 'На согласовании', signed: 'Подписан' };
function statusBadge(s) {
    if (s === 'signed')
        return _jsx("span", { style: badge(C.success, C.successBg), children: STATUS_LABELS[s] });
    if (s === 'approval')
        return _jsx("span", { style: badge(C.warning, C.warningBg), children: STATUS_LABELS[s] });
    return _jsx("span", { style: badge(C.textMuted, '#f1f5f9'), children: STATUS_LABELS[s] ?? s });
}
function fmt(d) { return d ? new Date(d).toLocaleDateString('ru-RU') : '—'; }
function num(v) { return Number(v) || 0; }
const emptyItem = () => ({ name: '', unit: '', quantity: '', unit_price: '', notes: '' });
const emptyContract = { contract_number: '', contractor_id: '', status: 'draft', advance_pct: 0, guarantee_pct: 0, signed_at: '' };
export default function SubcontractorContracts({ projectId }) {
    const [contracts, setContracts] = useState([]);
    const [contractors, setContractors] = useState([]);
    const [expanded, setExpanded] = useState({});
    const [itemsMap, setItemsMap] = useState({});
    const [amendments, setAmendments] = useState({});
    const [loading, setLoading] = useState(false);
    // contract modal
    const [contractModal, setContractModal] = useState(null);
    const [form, setForm] = useState(emptyContract);
    const [saving, setSaving] = useState(false);
    // items editor modal
    const [itemsModal, setItemsModal] = useState(null);
    const [editItems, setEditItems] = useState([]);
    const [savingItems, setSavingItems] = useState(false);
    const load = useCallback(() => {
        setLoading(true);
        Promise.all([
            client.get(`/projects/${projectId}/contracts`),
            client.get('/contractors'),
        ]).then(([cr, contr]) => {
            setContracts(cr.data);
            setContractors(contr.data);
        }).finally(() => setLoading(false));
    }, [projectId]);
    useEffect(() => { load(); }, [load]);
    const loadItems = async (contractId) => {
        const r = await client.get(`/projects/${projectId}/contracts/${contractId}/items`);
        setItemsMap(m => ({ ...m, [contractId]: r.data }));
    };
    const loadAmendments = async (contractId) => {
        const r = await client.get(`/projects/${projectId}/contracts/${contractId}/amendments`);
        setAmendments(a => ({ ...a, [contractId]: r.data }));
    };
    const toggleExpand = (id) => {
        setExpanded(e => {
            const open = !e[id];
            if (open && !itemsMap[id])
                loadItems(id);
            return { ...e, [id]: open };
        });
    };
    const openNew = () => { setForm(emptyContract); setContractModal('new'); };
    const openEdit = (c) => {
        setForm({ contract_number: c.contract_number, contractor_id: c.contractor_id, status: c.status, advance_pct: c.advance_pct, guarantee_pct: c.guarantee_pct, signed_at: c.signed_at ?? '' });
        setContractModal(c);
    };
    const saveContract = async () => {
        setSaving(true);
        try {
            if (contractModal === 'new') {
                await client.post(`/projects/${projectId}/contracts`, form);
            }
            else if (contractModal) {
                await client.patch(`/projects/${projectId}/contracts/${contractModal.id}`, form);
            }
            setContractModal(null);
            load();
        }
        finally {
            setSaving(false);
        }
    };
    const deleteContract = async (id) => {
        if (!confirm('Удалить договор?'))
            return;
        await client.delete(`/projects/${projectId}/contracts/${id}`);
        load();
    };
    const openItemsEditor = async (c) => {
        const items = itemsMap[c.id] ?? [];
        setEditItems(items.length ? items.map(i => ({ ...i })) : [emptyItem()]);
        setItemsModal(c);
    };
    const saveItems = async () => {
        if (!itemsModal)
            return;
        setSavingItems(true);
        try {
            await client.put(`/projects/${projectId}/contracts/${itemsModal.id}/items`, editItems);
            await loadItems(itemsModal.id);
            setItemsModal(null);
        }
        finally {
            setSavingItems(false);
        }
    };
    const setItem = (idx, field, val) => {
        setEditItems(items => items.map((it, i) => i === idx ? { ...it, [field]: val } : it));
    };
    const addItem = () => setEditItems(items => [...items, emptyItem()]);
    const removeItem = (idx) => setEditItems(items => items.filter((_, i) => i !== idx));
    const fld = (field, val) => setForm(f => ({ ...f, [field]: val }));
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 12 }, children: [_jsx("div", { style: { display: 'flex', justifyContent: 'flex-end' }, children: _jsx("button", { style: btnPrimary('sm'), onClick: openNew, children: "+ \u041D\u043E\u0432\u044B\u0439 \u0434\u043E\u0433\u043E\u0432\u043E\u0440" }) }), loading ? (_jsx("div", { style: { padding: 24, textAlign: 'center', color: C.textMuted }, children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430..." })) : contracts.length === 0 ? (_jsx("div", { style: { padding: 24, textAlign: 'center', color: C.textMuted }, children: "\u041D\u0435\u0442 \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u043E\u0432" })) : (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8 }, children: contracts.map(c => (_jsxs("div", { style: { ...CARD, padding: 0 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', flexWrap: 'wrap' }, children: [_jsx("button", { style: btnGhost('sm'), onClick: () => toggleExpand(c.id), children: expanded[c.id] ? '▾' : '▸' }), _jsx("span", { style: { fontWeight: 600, fontSize: 13 }, children: c.contract_number }), _jsx("span", { style: { fontSize: 13, color: C.textSec }, children: c.contractor_name }), statusBadge(c.status), _jsxs("span", { style: { fontSize: 12, color: C.textMuted }, children: ["\u0410\u0432\u0430\u043D\u0441: ", c.advance_pct, "%"] }), _jsxs("span", { style: { fontSize: 12, color: C.textMuted }, children: ["\u0413\u0430\u0440\u0430\u043D\u0442\u0438\u044F: ", c.guarantee_pct, "%"] }), c.signed_at && _jsxs("span", { style: { fontSize: 12, color: C.textMuted }, children: ["\u041F\u043E\u0434\u043F\u0438\u0441\u0430\u043D: ", fmt(c.signed_at)] }), _jsxs("div", { style: { marginLeft: 'auto', display: 'flex', gap: 4 }, children: [_jsx("button", { style: btnOutline('sm'), onClick: () => openEdit(c), children: "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C" }), _jsx("button", { style: btnDanger('sm'), onClick: () => deleteContract(c.id), children: "\u2715" })] })] }), expanded[c.id] && (_jsxs("div", { style: { borderTop: `1px solid ${C.border}`, padding: '12px 16px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }, children: [_jsx("span", { style: { fontSize: 13, fontWeight: 500 }, children: "\u041F\u043E\u0437\u0438\u0446\u0438\u0438 \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0430" }), c.status !== 'signed' && (_jsx("button", { style: btnOutline('sm'), onClick: () => openItemsEditor(c), children: "\u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043F\u043E\u0437\u0438\u0446\u0438\u0438" }))] }), !itemsMap[c.id] ? (_jsx("div", { style: { color: C.textMuted, fontSize: 13 }, children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430..." })) : itemsMap[c.id].length === 0 ? (_jsx("div", { style: { color: C.textMuted, fontSize: 13 }, children: "\u041D\u0435\u0442 \u043F\u043E\u0437\u0438\u0446\u0438\u0439" })) : (_jsx("div", { style: { overflowX: 'auto' }, children: _jsxs("table", { style: { width: '100%', borderCollapse: 'collapse' }, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: TH, children: "\u041D\u0430\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u0435" }), _jsx("th", { style: TH, children: "\u0415\u0434." }), _jsx("th", { style: TH, children: "\u041A\u043E\u043B-\u0432\u043E" }), _jsx("th", { style: TH, children: "\u0426\u0435\u043D\u0430" }), _jsx("th", { style: TH, children: "\u0421\u0443\u043C\u043C\u0430" }), _jsx("th", { style: TH, children: "\u041F\u0440\u0438\u043C\u0435\u0447\u0430\u043D\u0438\u0435" })] }) }), _jsx("tbody", { children: itemsMap[c.id].map((it, i) => (_jsxs("tr", { children: [_jsx("td", { style: TD, children: it.name }), _jsx("td", { style: TD, children: it.unit }), _jsx("td", { style: TD, children: it.quantity }), _jsx("td", { style: TD, children: num(it.unit_price).toLocaleString('ru-RU') }), _jsx("td", { style: TD, children: (num(it.quantity) * num(it.unit_price)).toLocaleString('ru-RU') }), _jsx("td", { style: { ...TD, color: C.textSec, fontSize: 12 }, children: it.notes || '—' })] }, i))) })] }) })), _jsxs("div", { style: { marginTop: 12 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }, children: [_jsx("span", { style: { fontSize: 13, fontWeight: 600 }, children: "\u0414\u043E\u043F. \u0441\u043E\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u044F" }), _jsx("button", { style: btnGhost('sm'), onClick: () => loadAmendments(c.id), children: "\u21BB \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C" })] }), amendments[c.id] ? (_jsxs("table", { style: { width: '100%', borderCollapse: 'collapse', fontSize: 13 }, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: TH, children: "\u2116 \u0414\u0421" }), _jsx("th", { style: TH, children: "\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435" }), _jsx("th", { style: TH, children: "\u0394 \u0421\u0443\u043C\u043C\u0430" }), _jsx("th", { style: TH, children: "\u0421\u0442\u0430\u0442\u0443\u0441" })] }) }), _jsxs("tbody", { children: [amendments[c.id].map(a => (_jsxs("tr", { children: [_jsx("td", { style: TD, children: a.amendment_number }), _jsx("td", { style: TD, children: a.description || '—' }), _jsxs("td", { style: { ...TD, color: a.amount_delta >= 0 ? C.success : C.danger }, children: [a.amount_delta >= 0 ? '+' : '', a.amount_delta.toLocaleString('ru-RU'), " \u20BD"] }), _jsx("td", { style: TD, children: a.status })] }, a.id))), amendments[c.id].length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 4, style: { ...TD, textAlign: 'center', color: C.textMuted }, children: "\u041D\u0435\u0442 \u0414\u0421" }) }))] })] })) : (_jsx("button", { style: btnGhost('sm'), onClick: () => loadAmendments(c.id), children: "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0414\u0421" }))] })] }))] }, c.id))) })), contractModal !== null && (_jsx("div", { style: OVERLAY, onClick: e => { if (e.target === e.currentTarget)
                    setContractModal(null); }, children: _jsxs("div", { style: MODAL, children: [_jsx("h3", { style: { margin: '0 0 16px', fontSize: 16, fontWeight: 600 }, children: contractModal === 'new' ? 'Новый договор' : 'Редактировать договор' }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 12 }, children: [_jsxs("label", { style: LBL, children: ["\u041D\u043E\u043C\u0435\u0440 \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0430", _jsx("input", { style: INPUT, value: form.contract_number, onChange: e => fld('contract_number', e.target.value) })] }), _jsxs("label", { style: LBL, children: ["\u041F\u043E\u0434\u0440\u044F\u0434\u0447\u0438\u043A", _jsxs("select", { style: INPUT, value: form.contractor_id, onChange: e => fld('contractor_id', e.target.value), children: [_jsx("option", { value: "", children: "\u2014 \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u2014" }), contractors.map(c => _jsx("option", { value: c.id, children: c.name }, c.id))] })] }), _jsxs("label", { style: LBL, children: ["\u0421\u0442\u0430\u0442\u0443\u0441", _jsxs("select", { style: INPUT, value: form.status, onChange: e => fld('status', e.target.value), children: [_jsx("option", { value: "draft", children: "\u0427\u0435\u0440\u043D\u043E\u0432\u0438\u043A" }), _jsx("option", { value: "approval", children: "\u041D\u0430 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0438" }), _jsx("option", { value: "signed", children: "\u041F\u043E\u0434\u043F\u0438\u0441\u0430\u043D" })] })] }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }, children: [_jsxs("label", { style: LBL, children: ["\u0410\u0432\u0430\u043D\u0441 (%)", _jsx("input", { style: INPUT, type: "number", min: "0", max: "100", value: form.advance_pct, onChange: e => fld('advance_pct', e.target.value) })] }), _jsxs("label", { style: LBL, children: ["\u0413\u0430\u0440\u0430\u043D\u0442\u0438\u044F (%)", _jsx("input", { style: INPUT, type: "number", min: "0", max: "100", value: form.guarantee_pct, onChange: e => fld('guarantee_pct', e.target.value) })] })] }), _jsxs("label", { style: LBL, children: ["\u0414\u0430\u0442\u0430 \u043F\u043E\u0434\u043F\u0438\u0441\u0430\u043D\u0438\u044F", _jsx("input", { style: INPUT, type: "date", value: form.signed_at, onChange: e => fld('signed_at', e.target.value) })] })] }), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }, children: [_jsx("button", { style: btnOutline(), onClick: () => setContractModal(null), children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { style: btnPrimary(), onClick: saveContract, disabled: saving, children: saving ? 'Сохранение...' : 'Сохранить' })] })] }) })), itemsModal && (_jsx("div", { style: OVERLAY, onClick: e => { if (e.target === e.currentTarget)
                    setItemsModal(null); }, children: _jsxs("div", { style: { ...MODAL, maxWidth: 800, width: '95%' }, children: [_jsxs("h3", { style: { margin: '0 0 16px', fontSize: 16, fontWeight: 600 }, children: ["\u041F\u043E\u0437\u0438\u0446\u0438\u0438 \u2014 ", itemsModal.contract_number] }), _jsx("div", { style: { overflowX: 'auto', marginBottom: 12 }, children: _jsxs("table", { style: { width: '100%', borderCollapse: 'collapse' }, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: TH, children: "\u041D\u0430\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u0435" }), _jsx("th", { style: TH, children: "\u0415\u0434." }), _jsx("th", { style: TH, children: "\u041A\u043E\u043B-\u0432\u043E" }), _jsx("th", { style: TH, children: "\u0426\u0435\u043D\u0430" }), _jsx("th", { style: TH, children: "\u0421\u0443\u043C\u043C\u0430" }), _jsx("th", { style: TH, children: "\u041F\u0440\u0438\u043C\u0435\u0447\u0430\u043D\u0438\u0435" }), _jsx("th", { style: TH })] }) }), _jsx("tbody", { children: editItems.map((it, i) => (_jsxs("tr", { children: [_jsx("td", { style: TD, children: _jsx("input", { style: { ...INPUT, minWidth: 140 }, value: it.name, onChange: e => setItem(i, 'name', e.target.value) }) }), _jsx("td", { style: TD, children: _jsx("input", { style: { ...INPUT, width: 60 }, value: it.unit, onChange: e => setItem(i, 'unit', e.target.value) }) }), _jsx("td", { style: TD, children: _jsx("input", { style: { ...INPUT, width: 80 }, type: "number", value: it.quantity, onChange: e => setItem(i, 'quantity', e.target.value) }) }), _jsx("td", { style: TD, children: _jsx("input", { style: { ...INPUT, width: 100 }, type: "number", value: it.unit_price, onChange: e => setItem(i, 'unit_price', e.target.value) }) }), _jsx("td", { style: { ...TD, fontWeight: 500 }, children: (num(it.quantity) * num(it.unit_price)).toLocaleString('ru-RU') }), _jsx("td", { style: TD, children: _jsx("input", { style: { ...INPUT, minWidth: 100 }, value: it.notes, onChange: e => setItem(i, 'notes', e.target.value) }) }), _jsx("td", { style: TD, children: _jsx("button", { style: btnDanger('sm'), onClick: () => removeItem(i), children: "\u2715" }) })] }, i))) })] }) }), _jsx("div", { style: { marginBottom: 16 }, children: _jsx("button", { style: btnOutline('sm'), onClick: addItem, children: "+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0441\u0442\u0440\u043E\u043A\u0443" }) }), _jsxs("div", { style: { display: 'flex', gap: 8, justifyContent: 'flex-end' }, children: [_jsx("button", { style: btnOutline(), onClick: () => setItemsModal(null), children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { style: btnPrimary(), onClick: saveItems, disabled: savingItems, children: savingItems ? 'Сохранение...' : 'Сохранить' })] })] }) }))] }));
}
