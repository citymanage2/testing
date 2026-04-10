import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import client from '../api/client';
import { C, CARD, INPUT, LBL, MODAL, OVERLAY, TD, TH, badge, btnDanger, btnGhost, btnOutline, btnPrimary, } from '../ui';
const STATUS_LABELS = {
    draft: 'Черновик', submitted: 'На согласовании', approved: 'Согласовано',
    ordered: 'Заказано', delivered: 'Доставлено', cancelled: 'Отменено',
};
const ALL_STATUSES = ['draft', 'submitted', 'approved', 'ordered', 'delivered', 'cancelled'];
function statusBadge(s) {
    const map = {
        draft: [C.textMuted, '#f1f5f9'],
        submitted: [C.primary, C.primaryBg],
        approved: [C.success, C.successBg],
        ordered: ['#7c3aed', '#f5f3ff'],
        delivered: [C.success, C.successBg],
        cancelled: [C.danger, C.dangerBg],
    };
    const [color, bg] = map[s];
    const style = s === 'delivered' ? { ...badge(color, bg), fontWeight: 700 } : badge(color, bg);
    return _jsx("span", { style: style, children: STATUS_LABELS[s] });
}
function fmt(d) { return d ? new Date(d).toLocaleDateString('ru-RU') : '—'; }
function num(v) { return Number(v) || 0; }
const emptyItem = () => ({ name: '', unit: '', qty_requested: '', qty_delivered: 0, supplier_id: '', unit_price: '', notes: '' });
export default function PurchaseRequests({ projectId }) {
    const [purchases, setPurchases] = useState([]);
    const [contractors, setContractors] = useState([]);
    const [statusFilter, setStatusFilter] = useState('all');
    const [expanded, setExpanded] = useState({});
    const [itemsMap, setItemsMap] = useState({});
    const [loading, setLoading] = useState(false);
    // new purchase modal
    const [newModal, setNewModal] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [savingNew, setSavingNew] = useState(false);
    // items editor modal
    const [itemsModal, setItemsModal] = useState(null);
    const [editItems, setEditItems] = useState([]);
    const [savingItems, setSavingItems] = useState(false);
    // inline delivery edit
    const [deliveryEdit, setDeliveryEdit] = useState({}); // purchaseId -> itemId -> qty
    const load = useCallback(() => {
        setLoading(true);
        Promise.all([
            client.get(`/projects/${projectId}/purchases`),
            client.get('/contractors'),
        ]).then(([pr, cr]) => {
            setPurchases(pr.data);
            setContractors(cr.data);
        }).finally(() => setLoading(false));
    }, [projectId]);
    useEffect(() => { load(); }, [load]);
    const loadItems = async (id) => {
        const r = await client.get(`/projects/${projectId}/purchases/${id}/items`);
        setItemsMap(m => ({ ...m, [id]: r.data }));
    };
    const toggleExpand = (id) => {
        setExpanded(e => {
            const open = !e[id];
            if (open && !itemsMap[id])
                loadItems(id);
            return { ...e, [id]: open };
        });
    };
    const createPurchase = async () => {
        setSavingNew(true);
        try {
            await client.post(`/projects/${projectId}/purchases`, { title: newTitle });
            setNewModal(false);
            setNewTitle('');
            load();
        }
        finally {
            setSavingNew(false);
        }
    };
    const updateStatus = async (id, status) => {
        await client.patch(`/projects/${projectId}/purchases/${id}`, { status });
        load();
    };
    const deletePurchase = async (id) => {
        if (!confirm('Удалить заявку?'))
            return;
        await client.delete(`/projects/${projectId}/purchases/${id}`);
        load();
    };
    const openItemsEditor = (p) => {
        const items = itemsMap[p.id] ?? [emptyItem()];
        setEditItems(items.map(i => ({ ...i })));
        setItemsModal(p);
    };
    const saveItems = async () => {
        if (!itemsModal)
            return;
        setSavingItems(true);
        try {
            await client.put(`/projects/${projectId}/purchases/${itemsModal.id}/items`, editItems);
            await loadItems(itemsModal.id);
            load();
            setItemsModal(null);
        }
        finally {
            setSavingItems(false);
        }
    };
    const setItemField = (idx, field, val) => {
        setEditItems(items => items.map((it, i) => i === idx ? { ...it, [field]: val } : it));
    };
    const saveDelivery = async (purchaseId, itemId, qty) => {
        await client.patch(`/projects/${projectId}/purchases/${purchaseId}/items/${itemId}`, { quantity_delivered: Number(qty) });
        await loadItems(purchaseId);
        setDeliveryEdit(prev => {
            const n = { ...prev };
            if (n[purchaseId])
                delete n[purchaseId][itemId];
            return n;
        });
    };
    const filtered = statusFilter === 'all' ? purchases : purchases.filter(p => p.status === statusFilter);
    const tabStyle = (active) => ({
        ...btnOutline('sm'),
        background: active ? C.primary : C.surface,
        color: active ? '#fff' : C.text,
        border: `1px solid ${active ? C.primary : C.border}`,
    });
    const statusActions = (p) => {
        const btns = [];
        if (p.status === 'draft') {
            btns.push(_jsx("button", { style: btnOutline('sm'), onClick: () => updateStatus(p.id, 'submitted'), children: "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u043D\u0430 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0435" }, "submit"));
            btns.push(_jsx("button", { style: btnDanger('sm'), onClick: () => deletePurchase(p.id), children: "\u2715" }, "del"));
        }
        if (p.status === 'submitted') {
            btns.push(_jsx("button", { style: btnOutline('sm'), onClick: () => updateStatus(p.id, 'approved'), children: "\u0421\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u0442\u044C" }, "approve"));
            btns.push(_jsx("button", { style: btnDanger('sm'), onClick: () => updateStatus(p.id, 'cancelled'), children: "\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C" }, "cancel"));
        }
        if (p.status === 'approved') {
            btns.push(_jsx("button", { style: btnOutline('sm'), onClick: () => updateStatus(p.id, 'ordered'), children: "\u0417\u0430\u043A\u0430\u0437\u0430\u0442\u044C" }, "order"));
            btns.push(_jsx("button", { style: btnDanger('sm'), onClick: () => updateStatus(p.id, 'cancelled'), children: "\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C" }, "cancel"));
        }
        if (p.status === 'ordered') {
            btns.push(_jsx("button", { style: btnPrimary('sm'), onClick: () => updateStatus(p.id, 'delivered'), children: "\u041E\u0442\u043C\u0435\u0442\u0438\u0442\u044C \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0443" }, "deliver"));
        }
        return btns;
    };
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 12 }, children: [_jsxs("div", { style: { display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }, children: [_jsx("button", { style: tabStyle(statusFilter === 'all'), onClick: () => setStatusFilter('all'), children: "\u0412\u0441\u0435" }), ALL_STATUSES.map(s => (_jsx("button", { style: tabStyle(statusFilter === s), onClick: () => setStatusFilter(s), children: STATUS_LABELS[s] }, s))), _jsx("button", { style: { ...btnPrimary('sm'), marginLeft: 'auto' }, onClick: () => setNewModal(true), children: "+ \u041D\u043E\u0432\u0430\u044F \u0437\u0430\u044F\u0432\u043A\u0430" })] }), loading ? (_jsx("div", { style: { padding: 24, textAlign: 'center', color: C.textMuted }, children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430..." })) : filtered.length === 0 ? (_jsx("div", { style: { padding: 24, textAlign: 'center', color: C.textMuted }, children: "\u041D\u0435\u0442 \u0437\u0430\u044F\u0432\u043E\u043A" })) : (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8 }, children: filtered.map(p => (_jsxs("div", { style: { ...CARD, padding: 0 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', flexWrap: 'wrap' }, children: [_jsx("button", { style: btnGhost('sm'), onClick: () => toggleExpand(p.id), children: expanded[p.id] ? '▾' : '▸' }), _jsx("span", { style: { fontWeight: 600, fontSize: 13 }, children: p.title }), statusBadge(p.status), _jsxs("span", { style: { fontSize: 12, color: C.textMuted }, children: ["\u041F\u043E\u0437\u0438\u0446\u0438\u0439: ", p.items_count] }), _jsxs("span", { style: { fontSize: 13, fontWeight: 600 }, children: [p.total_amount?.toLocaleString('ru-RU'), " \u20BD"] }), _jsx("span", { style: { fontSize: 12, color: C.textMuted }, children: fmt(p.created_at) }), _jsxs("div", { style: { marginLeft: 'auto', display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }, children: [_jsx("button", { style: btnOutline('sm'), onClick: () => openItemsEditor(p), children: "\u041F\u043E\u0437\u0438\u0446\u0438\u0438" }), statusActions(p)] })] }), expanded[p.id] && (_jsx("div", { style: { borderTop: `1px solid ${C.border}`, padding: '12px 16px', overflowX: 'auto' }, children: !itemsMap[p.id] ? (_jsx("div", { style: { color: C.textMuted, fontSize: 13 }, children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430..." })) : itemsMap[p.id].length === 0 ? (_jsx("div", { style: { color: C.textMuted, fontSize: 13 }, children: "\u041D\u0435\u0442 \u043F\u043E\u0437\u0438\u0446\u0438\u0439" })) : (_jsxs("table", { style: { width: '100%', borderCollapse: 'collapse' }, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: TH, children: "\u041D\u0430\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u0435" }), _jsx("th", { style: TH, children: "\u0415\u0434." }), _jsx("th", { style: TH, children: "\u0417\u0430\u043A\u0430\u0437\u0430\u043D\u043E" }), _jsx("th", { style: TH, children: "\u0414\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043E" }), _jsx("th", { style: TH, children: "\u041F\u043E\u0441\u0442\u0430\u0432\u0449\u0438\u043A" }), _jsx("th", { style: TH, children: "\u0426\u0435\u043D\u0430" }), _jsx("th", { style: TH, children: "\u0421\u0443\u043C\u043C\u0430" }), _jsx("th", { style: TH, children: "\u041F\u0440\u0438\u043C\u0435\u0447\u0430\u043D\u0438\u0435" })] }) }), _jsx("tbody", { children: itemsMap[p.id].map(it => {
                                            const itemId = it.id ?? '';
                                            const editQty = deliveryEdit[p.id]?.[itemId];
                                            const supplier = contractors.find(c => c.id === it.supplier_id);
                                            return (_jsxs("tr", { children: [_jsx("td", { style: TD, children: it.name }), _jsx("td", { style: TD, children: it.unit }), _jsx("td", { style: TD, children: it.qty_requested }), _jsx("td", { style: { ...TD }, children: p.status === 'ordered' ? (_jsxs("div", { style: { display: 'flex', gap: 4, alignItems: 'center' }, children: [_jsx("input", { type: "number", style: { ...INPUT, width: 70 }, value: editQty ?? String(it.qty_delivered), onChange: e => setDeliveryEdit(prev => ({
                                                                        ...prev,
                                                                        [p.id]: { ...prev[p.id], [itemId]: e.target.value },
                                                                    })) }), editQty !== undefined && (_jsx("button", { style: btnPrimary('sm'), onClick: () => saveDelivery(p.id, itemId, editQty), children: "\u2713" }))] })) : it.qty_delivered }), _jsx("td", { style: { ...TD, fontSize: 12 }, children: supplier?.name ?? '—' }), _jsx("td", { style: TD, children: num(it.unit_price).toLocaleString('ru-RU') }), _jsx("td", { style: TD, children: (num(it.qty_requested) * num(it.unit_price)).toLocaleString('ru-RU') }), _jsx("td", { style: { ...TD, color: C.textSec, fontSize: 12 }, children: it.notes || '—' })] }, itemId));
                                        }) })] })) }))] }, p.id))) })), newModal && (_jsx("div", { style: OVERLAY, onClick: e => { if (e.target === e.currentTarget)
                    setNewModal(false); }, children: _jsxs("div", { style: { ...MODAL, maxWidth: 400 }, children: [_jsx("h3", { style: { margin: '0 0 16px', fontSize: 16, fontWeight: 600 }, children: "\u041D\u043E\u0432\u0430\u044F \u0437\u0430\u044F\u0432\u043A\u0430 \u043D\u0430 \u0437\u0430\u043A\u0443\u043F\u043A\u0443" }), _jsxs("label", { style: LBL, children: ["\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435", _jsx("input", { style: INPUT, value: newTitle, onChange: e => setNewTitle(e.target.value), placeholder: "\u041D\u0430\u043F\u0440: \u0417\u0430\u043A\u0443\u043F\u043A\u0430 \u0430\u0440\u043C\u0430\u0442\u0443\u0440\u044B", autoFocus: true })] }), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }, children: [_jsx("button", { style: btnOutline(), onClick: () => setNewModal(false), children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { style: btnPrimary(), onClick: createPurchase, disabled: !newTitle.trim() || savingNew, children: savingNew ? 'Создание...' : 'Создать' })] })] }) })), itemsModal && (_jsx("div", { style: OVERLAY, onClick: e => { if (e.target === e.currentTarget)
                    setItemsModal(null); }, children: _jsxs("div", { style: { ...MODAL, maxWidth: 920, width: '95%' }, children: [_jsxs("h3", { style: { margin: '0 0 16px', fontSize: 16, fontWeight: 600 }, children: ["\u041F\u043E\u0437\u0438\u0446\u0438\u0438 \u2014 ", itemsModal.title] }), _jsx("div", { style: { overflowX: 'auto', marginBottom: 12 }, children: _jsxs("table", { style: { width: '100%', borderCollapse: 'collapse' }, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: TH, children: "\u041D\u0430\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u0435" }), _jsx("th", { style: TH, children: "\u0415\u0434." }), _jsx("th", { style: TH, children: "\u041A\u043E\u043B-\u0432\u043E" }), _jsx("th", { style: TH, children: "\u041F\u043E\u0441\u0442\u0430\u0432\u0449\u0438\u043A" }), _jsx("th", { style: TH, children: "\u0426\u0435\u043D\u0430" }), _jsx("th", { style: TH, children: "\u0421\u0443\u043C\u043C\u0430" }), _jsx("th", { style: TH, children: "\u041F\u0440\u0438\u043C\u0435\u0447\u0430\u043D\u0438\u0435" }), _jsx("th", { style: TH })] }) }), _jsx("tbody", { children: editItems.map((it, i) => (_jsxs("tr", { children: [_jsx("td", { style: TD, children: _jsx("input", { style: { ...INPUT, minWidth: 140 }, value: it.name, onChange: e => setItemField(i, 'name', e.target.value) }) }), _jsx("td", { style: TD, children: _jsx("input", { style: { ...INPUT, width: 60 }, value: it.unit, onChange: e => setItemField(i, 'unit', e.target.value) }) }), _jsx("td", { style: TD, children: _jsx("input", { style: { ...INPUT, width: 80 }, type: "number", value: it.qty_requested, onChange: e => setItemField(i, 'qty_requested', e.target.value) }) }), _jsx("td", { style: TD, children: _jsxs("select", { style: { ...INPUT, minWidth: 120 }, value: it.supplier_id, onChange: e => setItemField(i, 'supplier_id', e.target.value), children: [_jsx("option", { value: "", children: "\u2014" }), contractors.map(c => _jsx("option", { value: c.id, children: c.name }, c.id))] }) }), _jsx("td", { style: TD, children: _jsx("input", { style: { ...INPUT, width: 100 }, type: "number", value: it.unit_price, onChange: e => setItemField(i, 'unit_price', e.target.value) }) }), _jsx("td", { style: { ...TD, fontWeight: 500 }, children: (num(it.qty_requested) * num(it.unit_price)).toLocaleString('ru-RU') }), _jsx("td", { style: TD, children: _jsx("input", { style: { ...INPUT, minWidth: 100 }, value: it.notes, onChange: e => setItemField(i, 'notes', e.target.value) }) }), _jsx("td", { style: TD, children: _jsx("button", { style: btnDanger('sm'), onClick: () => setEditItems(items => items.filter((_, j) => j !== i)), children: "\u2715" }) })] }, i))) })] }) }), _jsx("div", { style: { marginBottom: 12 }, children: _jsx("button", { style: btnOutline('sm'), onClick: () => setEditItems(items => [...items, emptyItem()]), children: "+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0441\u0442\u0440\u043E\u043A\u0443" }) }), _jsxs("div", { style: { display: 'flex', gap: 8, justifyContent: 'flex-end' }, children: [_jsx("button", { style: btnOutline(), onClick: () => setItemsModal(null), children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { style: btnPrimary(), onClick: saveItems, disabled: savingItems, children: savingItems ? 'Сохранение...' : 'Сохранить' })] })] }) }))] }));
}
