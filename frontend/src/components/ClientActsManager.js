import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import client from '../api/client';
import { C, CARD, INPUT, LBL, MODAL, OVERLAY, TD, TH, badge, btnDanger, btnGhost, btnOutline, btnPrimary, } from '../ui';
const STATUS_LABELS = {
    draft: 'Черновик', sent: 'Отправлен', revision: 'На доработке', signed: 'Подписан', cancelled: 'Отменён',
};
function statusBadge(s) {
    const map = {
        draft: [C.textMuted, '#f1f5f9'],
        sent: [C.primary, C.primaryBg],
        revision: [C.warning, C.warningBg],
        signed: [C.success, C.successBg],
        cancelled: [C.danger, C.dangerBg],
    };
    const [color, bg] = map[s] ?? [C.textMuted, '#f1f5f9'];
    return _jsx("span", { style: badge(color, bg), children: STATUS_LABELS[s] ?? s });
}
function fmt(d) { return d ? new Date(d).toLocaleDateString('ru-RU') : '—'; }
function pct(a, b) { return b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0; }
export default function ClientActsManager({ projectId }) {
    const [tab, setTab] = useState('acts');
    const [acts, setActs] = useState([]);
    const [contractors, setContractors] = useState([]);
    const [summary, setSummary] = useState([]);
    const [expanded, setExpanded] = useState({});
    const [itemsMap, setItemsMap] = useState({});
    const [loading, setLoading] = useState(false);
    // new act modal
    const [actModal, setActModal] = useState(false);
    const [actForm, setActForm] = useState({ act_number: '', contractor_id: '', period_start: '', period_end: '' });
    const [savingAct, setSavingAct] = useState(false);
    // items editor modal
    const [itemsModal, setItemsModal] = useState(null);
    const [editItems, setEditItems] = useState([]);
    const [savingItems, setSavingItems] = useState(false);
    const load = useCallback(() => {
        setLoading(true);
        Promise.all([
            client.get(`/projects/${projectId}/client-acts`),
            client.get('/contractors'),
        ]).then(([actsR, contrR]) => {
            setActs(actsR.data);
            setContractors(contrR.data);
        }).finally(() => setLoading(false));
    }, [projectId]);
    const loadSummary = useCallback(() => {
        client.get(`/projects/${projectId}/actioning-summary`).then(r => setSummary(r.data));
    }, [projectId]);
    useEffect(() => { load(); }, [load]);
    useEffect(() => { if (tab === 'summary')
        loadSummary(); }, [tab, loadSummary]);
    const loadActItems = async (actId) => {
        const r = await client.get(`/projects/${projectId}/client-acts/${actId}/items`);
        setItemsMap(m => ({ ...m, [actId]: r.data }));
    };
    const toggleExpand = (id) => {
        setExpanded(e => {
            const open = !e[id];
            if (open && !itemsMap[id])
                loadActItems(id);
            return { ...e, [id]: open };
        });
    };
    const saveAct = async () => {
        setSavingAct(true);
        try {
            await client.post(`/projects/${projectId}/client-acts`, actForm);
            setActModal(false);
            load();
        }
        finally {
            setSavingAct(false);
        }
    };
    const updateStatus = async (act, status) => {
        await client.patch(`/projects/${projectId}/client-acts/${act.id}`, { status });
        load();
    };
    const deleteAct = async (id) => {
        if (!confirm('Удалить акт?'))
            return;
        await client.delete(`/projects/${projectId}/client-acts/${id}`);
        load();
    };
    const openItemsEditor = async (act) => {
        const r = await client.get(`/projects/${projectId}/actioning-summary`);
        const summaryItems = r.data;
        const existing = itemsMap[act.id] ?? [];
        const items = summaryItems.map(si => {
            const ex = existing.find(e => e.estimate_item_id === si.estimate_item_id);
            return {
                estimate_item_id: si.estimate_item_id,
                name: si.name,
                unit: si.unit,
                total_qty: si.quantity_total,
                already_actioned: si.quantity_actioned - (ex ? Number(ex.quantity_presented) : 0),
                remaining: si.quantity_remaining + (ex ? Number(ex.quantity_presented) : 0),
                quantity_presented: ex ? ex.quantity_presented : 0,
                unit_price: ex ? ex.unit_price : 0,
            };
        });
        setEditItems(items);
        setItemsModal(act);
    };
    const saveItems = async () => {
        if (!itemsModal)
            return;
        setSavingItems(true);
        try {
            const payload = editItems
                .filter(it => Number(it.quantity_presented) > 0)
                .map(it => ({
                estimate_item_id: it.estimate_item_id,
                quantity_presented: Number(it.quantity_presented),
                unit_price: Number(it.unit_price),
            }));
            await client.put(`/projects/${projectId}/client-acts/${itemsModal.id}/items`, payload);
            await loadActItems(itemsModal.id);
            setItemsModal(null);
        }
        finally {
            setSavingItems(false);
        }
    };
    const setItemField = (idx, field, val) => {
        setEditItems(items => items.map((it, i) => i === idx ? { ...it, [field]: val } : it));
    };
    const tabStyle = (active) => ({
        ...btnOutline('sm'),
        background: active ? C.primary : C.surface,
        color: active ? '#fff' : C.text,
        border: `1px solid ${active ? C.primary : C.border}`,
    });
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 12 }, children: [_jsxs("div", { style: { display: 'flex', gap: 2 }, children: [_jsx("button", { style: tabStyle(tab === 'acts'), onClick: () => setTab('acts'), children: "\u0410\u043A\u0442\u044B \u041A\u0421-2" }), _jsx("button", { style: tabStyle(tab === 'summary'), onClick: () => setTab('summary'), children: "\u041F\u0440\u043E\u0433\u0440\u0435\u0441\u0441 \u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F" })] }), tab === 'acts' && (_jsxs(_Fragment, { children: [_jsx("div", { style: { display: 'flex', justifyContent: 'flex-end' }, children: _jsx("button", { style: btnPrimary('sm'), onClick: () => setActModal(true), children: "+ \u041D\u043E\u0432\u044B\u0439 \u0430\u043A\u0442" }) }), loading ? (_jsx("div", { style: { padding: 24, textAlign: 'center', color: C.textMuted }, children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430..." })) : acts.length === 0 ? (_jsx("div", { style: { padding: 24, textAlign: 'center', color: C.textMuted }, children: "\u041D\u0435\u0442 \u0430\u043A\u0442\u043E\u0432" })) : (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8 }, children: acts.map(act => (_jsxs("div", { style: { ...CARD, padding: 0 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', flexWrap: 'wrap' }, children: [_jsx("button", { style: btnGhost('sm'), onClick: () => toggleExpand(act.id), children: expanded[act.id] ? '▾' : '▸' }), _jsxs("span", { style: { fontWeight: 600, fontSize: 13 }, children: ["\u2116 ", act.act_number] }), statusBadge(act.status), _jsx("span", { style: { fontSize: 13, color: C.textSec }, children: act.contractor_name }), _jsxs("span", { style: { fontSize: 12, color: C.textMuted }, children: [fmt(act.period_start), " \u2013 ", fmt(act.period_end)] }), _jsxs("span", { style: { fontSize: 13, fontWeight: 600 }, children: [act.total_amount?.toLocaleString('ru-RU'), " \u20BD"] }), _jsxs("div", { style: { marginLeft: 'auto', display: 'flex', gap: 4, flexWrap: 'wrap' }, children: [_jsx("button", { style: btnOutline('sm'), onClick: () => openItemsEditor(act), children: "\u041F\u043E\u0437\u0438\u0446\u0438\u0438" }), act.status === 'draft' && (_jsx("button", { style: btnOutline('sm'), onClick: () => updateStatus(act, 'sent'), children: "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C" })), act.status === 'sent' && (_jsxs(_Fragment, { children: [_jsx("button", { style: btnOutline('sm'), onClick: () => updateStatus(act, 'signed'), children: "\u041F\u043E\u0434\u043F\u0438\u0441\u0430\u0442\u044C" }), _jsx("button", { style: btnOutline('sm'), onClick: () => updateStatus(act, 'revision'), children: "\u041D\u0430 \u0434\u043E\u0440\u0430\u0431\u043E\u0442\u043A\u0443" })] })), act.status === 'revision' && (_jsx("button", { style: btnOutline('sm'), onClick: () => updateStatus(act, 'sent'), children: "\u041F\u043E\u0432\u0442\u043E\u0440\u043D\u043E \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C" })), act.status === 'draft' && (_jsx("button", { style: btnDanger('sm'), onClick: () => deleteAct(act.id), children: "\u2715" })), act.status === 'signed' && (_jsx("a", { href: `${import.meta.env.VITE_API_BASE_URL || ''}/projects/${projectId}/client-acts/${act.id}/export-ks2`, target: "_blank", rel: "noreferrer", style: btnOutline('sm'), children: "\uD83D\uDCC4 \u041A\u0421-2" }))] })] }), expanded[act.id] && (_jsx("div", { style: { borderTop: `1px solid ${C.border}`, padding: '12px 16px' }, children: !itemsMap[act.id] ? (_jsx("div", { style: { color: C.textMuted, fontSize: 13 }, children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430..." })) : itemsMap[act.id].length === 0 ? (_jsx("div", { style: { color: C.textMuted, fontSize: 13 }, children: "\u041D\u0435\u0442 \u043F\u043E\u0437\u0438\u0446\u0438\u0439" })) : (_jsxs("table", { style: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }, children: [_jsxs("colgroup", { children: [_jsx("col", {}), _jsx("col", { style: { width: 52 } }), _jsx("col", { style: { width: 80 } }), _jsx("col", { style: { width: 100 } }), _jsx("col", { style: { width: 110 } })] }), _jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: TH, children: "\u041D\u0430\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u0435" }), _jsx("th", { style: TH, children: "\u0415\u0434." }), _jsx("th", { style: TH, children: "\u041A\u043E\u043B-\u0432\u043E" }), _jsx("th", { style: TH, children: "\u0426\u0435\u043D\u0430" }), _jsx("th", { style: TH, children: "\u0421\u0443\u043C\u043C\u0430" })] }) }), _jsx("tbody", { children: itemsMap[act.id].map((it, i) => (_jsxs("tr", { children: [_jsx("td", { style: TD, children: it.name }), _jsx("td", { style: TD, children: it.unit }), _jsx("td", { style: TD, children: it.quantity_presented }), _jsx("td", { style: TD, children: Number(it.unit_price).toLocaleString('ru-RU') }), _jsx("td", { style: TD, children: (Number(it.quantity_presented) * Number(it.unit_price)).toLocaleString('ru-RU') })] }, i))) })] })) }))] }, act.id))) }))] })), tab === 'summary' && (_jsx("div", { style: { ...CARD, padding: 0, overflow: 'hidden' }, children: _jsxs("table", { style: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }, children: [_jsxs("colgroup", { children: [_jsx("col", {}), _jsx("col", { style: { width: 52 } }), _jsx("col", { style: { width: 80 } }), _jsx("col", { style: { width: 90 } }), _jsx("col", { style: { width: 80 } }), _jsx("col", { style: { width: 140 } })] }), _jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: TH, children: "\u041D\u0430\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u0435" }), _jsx("th", { style: TH, children: "\u0415\u0434." }), _jsx("th", { style: TH, children: "\u041F\u043E \u0441\u043C\u0435\u0442\u0435" }), _jsx("th", { style: TH, children: "\u0410\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u043E" }), _jsx("th", { style: TH, children: "\u041E\u0441\u0442\u0430\u0442\u043E\u043A" }), _jsx("th", { style: TH, children: "%" })] }) }), _jsxs("tbody", { children: [summary.map(it => {
                                    const p = pct(it.quantity_actioned, it.quantity_total);
                                    return (_jsxs("tr", { children: [_jsx("td", { style: TD, children: it.name }), _jsx("td", { style: TD, children: it.unit }), _jsx("td", { style: TD, children: it.quantity_total }), _jsx("td", { style: TD, children: it.quantity_actioned }), _jsx("td", { style: { ...TD, color: it.quantity_remaining < 0 ? C.danger : C.text }, children: it.quantity_remaining }), _jsx("td", { style: TD, children: _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("div", { style: { flex: 1, height: 8, background: C.border, borderRadius: 4, overflow: 'hidden' }, children: _jsx("div", { style: { height: '100%', width: `${p}%`, background: p >= 100 ? C.success : C.primary, borderRadius: 4 } }) }), _jsxs("span", { style: { fontSize: 12, fontWeight: 500, minWidth: 32, textAlign: 'right' }, children: [p, "%"] })] }) })] }, it.estimate_item_id));
                                }), summary.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 6, style: { ...TD, textAlign: 'center', color: C.textMuted }, children: "\u041D\u0435\u0442 \u0434\u0430\u043D\u043D\u044B\u0445" }) }))] })] }) })), actModal && (_jsx("div", { style: OVERLAY, onClick: e => { if (e.target === e.currentTarget)
                    setActModal(false); }, children: _jsxs("div", { style: { ...MODAL, maxWidth: 440 }, children: [_jsx("h3", { style: { margin: '0 0 16px', fontSize: 16, fontWeight: 600 }, children: "\u041D\u043E\u0432\u044B\u0439 \u0430\u043A\u0442 \u041A\u0421-2" }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 12 }, children: [_jsxs("label", { style: LBL, children: ["\u041D\u043E\u043C\u0435\u0440 \u0430\u043A\u0442\u0430", _jsx("input", { style: INPUT, value: actForm.act_number, onChange: e => setActForm(f => ({ ...f, act_number: e.target.value })) })] }), _jsxs("label", { style: LBL, children: ["\u0417\u0430\u043A\u0430\u0437\u0447\u0438\u043A / \u043F\u043E\u0434\u0440\u044F\u0434\u0447\u0438\u043A", _jsxs("select", { style: INPUT, value: actForm.contractor_id, onChange: e => setActForm(f => ({ ...f, contractor_id: e.target.value })), children: [_jsx("option", { value: "", children: "\u2014 \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u2014" }), contractors.map(c => _jsx("option", { value: c.id, children: c.name }, c.id))] })] }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }, children: [_jsxs("label", { style: LBL, children: ["\u041F\u0435\u0440\u0438\u043E\u0434 \u0441", _jsx("input", { style: INPUT, type: "date", value: actForm.period_start, onChange: e => setActForm(f => ({ ...f, period_start: e.target.value })) })] }), _jsxs("label", { style: LBL, children: ["\u041F\u0435\u0440\u0438\u043E\u0434 \u043F\u043E", _jsx("input", { style: INPUT, type: "date", value: actForm.period_end, onChange: e => setActForm(f => ({ ...f, period_end: e.target.value })) })] })] })] }), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }, children: [_jsx("button", { style: btnOutline(), onClick: () => setActModal(false), children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { style: btnPrimary(), onClick: saveAct, disabled: savingAct, children: savingAct ? 'Создание...' : 'Создать' })] })] }) })), itemsModal && (_jsx("div", { style: OVERLAY, onClick: e => { if (e.target === e.currentTarget)
                    setItemsModal(null); }, children: _jsxs("div", { style: { ...MODAL, maxWidth: 900, width: '95%' }, children: [_jsxs("h3", { style: { margin: '0 0 16px', fontSize: 16, fontWeight: 600 }, children: ["\u041F\u043E\u0437\u0438\u0446\u0438\u0438 \u0430\u043A\u0442\u0430 \u2116 ", itemsModal.act_number] }), _jsx("div", { style: { overflowX: 'auto', marginBottom: 12 }, children: _jsxs("table", { style: { width: '100%', borderCollapse: 'collapse' }, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: TH, children: "\u041D\u0430\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u0435" }), _jsx("th", { style: TH, children: "\u0415\u0434." }), _jsx("th", { style: TH, children: "\u041F\u043E \u0441\u043C\u0435\u0442\u0435" }), _jsx("th", { style: TH, children: "\u0423\u0436\u0435 \u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u043E" }), _jsx("th", { style: TH, children: "\u041E\u0441\u0442\u0430\u0442\u043E\u043A" }), _jsx("th", { style: TH, children: "\u041F\u0440\u0435\u0434\u044A\u044F\u0432\u043B\u044F\u044E" }), _jsx("th", { style: TH, children: "\u0426\u0435\u043D\u0430" })] }) }), _jsx("tbody", { children: editItems.map((it, i) => {
                                            const qty = Number(it.quantity_presented) || 0;
                                            const over = qty > it.remaining;
                                            return (_jsxs("tr", { children: [_jsx("td", { style: TD, children: it.name }), _jsx("td", { style: TD, children: it.unit }), _jsx("td", { style: TD, children: it.total_qty }), _jsx("td", { style: TD, children: it.already_actioned }), _jsx("td", { style: { ...TD, color: over ? C.danger : C.text, fontWeight: over ? 600 : 400 }, children: it.remaining }), _jsxs("td", { style: TD, children: [_jsx("input", { type: "number", style: { ...INPUT, width: 90, borderColor: over ? C.danger : C.border }, value: it.quantity_presented, onChange: e => setItemField(i, 'quantity_presented', e.target.value) }), over && _jsx("div", { style: { fontSize: 11, color: C.danger }, children: "\u041F\u0440\u0435\u0432\u044B\u0448\u0430\u0435\u0442 \u043E\u0441\u0442\u0430\u0442\u043E\u043A" })] }), _jsx("td", { style: TD, children: _jsx("input", { type: "number", style: { ...INPUT, width: 100 }, value: it.unit_price, onChange: e => setItemField(i, 'unit_price', e.target.value) }) })] }, i));
                                        }) })] }) }), _jsxs("div", { style: { display: 'flex', gap: 8, justifyContent: 'flex-end' }, children: [_jsx("button", { style: btnOutline(), onClick: () => setItemsModal(null), children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { style: btnPrimary(), onClick: saveItems, disabled: savingItems, children: savingItems ? 'Сохранение...' : 'Сохранить' })] })] }) }))] }));
}
