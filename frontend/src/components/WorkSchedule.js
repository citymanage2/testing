import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import client from '../api/client';
import { C, CARD, INPUT, LBL, MODAL, OVERLAY, TD, TH, btnDanger, btnGhost, btnOutline, btnPrimary, } from '../ui';
function genMonthPeriods(start, end) {
    // start/end: "YYYY-MM"
    const result = [];
    if (!start || !end)
        return result;
    let [sy, sm] = start.split('-').map(Number);
    const [ey, em] = end.split('-').map(Number);
    while (sy < ey || (sy === ey && sm <= em)) {
        result.push(`${sy}-${String(sm).padStart(2, '0')}`);
        sm++;
        if (sm > 12) {
            sm = 1;
            sy++;
        }
        if (result.length > 120)
            break; // safety
    }
    return result;
}
function genWeekPeriods(start, end) {
    // start/end: "YYYY-MM" — generate ISO weeks that fall within the month range
    const result = [];
    if (!start || !end)
        return result;
    const startDate = new Date(`${start}-01`);
    const [ey, em] = end.split('-').map(Number);
    const endDate = new Date(ey, em, 0); // last day of end month
    let d = new Date(startDate);
    // move to Monday of week containing startDate
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    while (d <= endDate) {
        const year = d.getFullYear();
        // ISO week number
        const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
        const week = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        result.push(`${year}-W${String(week).padStart(2, '0')}`);
        d.setDate(d.getDate() + 7);
        if (result.length > 200)
            break;
    }
    return result;
}
function periodLabel(p, type) {
    if (type === 'week')
        return p; // already "YYYY-W01"
    const [y, m] = p.split('-');
    const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
    return `${months[parseInt(m) - 1]} ${y}`;
}
function cellColor(plan, fact) {
    if (plan === 0 && fact === 0)
        return 'transparent';
    if (fact > plan)
        return C.successBg;
    if (plan > 0 && fact < plan)
        return C.warningBg;
    return 'transparent';
}
const defaultStart = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const defaultEnd = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 5);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
export default function WorkSchedule({ projectId }) {
    const [items, setItems] = useState([]);
    const [periodType, setPeriodType] = useState('month');
    const [startPeriod, setStartPeriod] = useState(defaultStart);
    const [endPeriod, setEndPeriod] = useState(defaultEnd);
    const [loading, setLoading] = useState(false);
    // local edits: {itemId: {periodLabel: {planned_qty, actual_qty}}}
    const [edits, setEdits] = useState({});
    const [saving, setSaving] = useState(null);
    // add/edit item modal
    const [itemModal, setItemModal] = useState(null);
    const [itemForm, setItemForm] = useState({ name: '', unit: '', total_quantity: '' });
    const [savingItem, setSavingItem] = useState(false);
    const periods = periodType === 'month'
        ? genMonthPeriods(startPeriod, endPeriod)
        : genWeekPeriods(startPeriod, endPeriod);
    const load = useCallback(() => {
        setLoading(true);
        client.get(`/projects/${projectId}/schedule/items`)
            .then(r => setItems(r.data))
            .finally(() => setLoading(false));
    }, [projectId]);
    useEffect(() => { load(); }, [load]);
    const getEntry = (item, period) => {
        const e = item.entries?.find(e => e.period_label === period);
        return e ?? { period_label: period, period_type: periodType, planned_qty: 0, actual_qty: 0 };
    };
    const getEdit = (itemId, period, base) => {
        return edits[itemId]?.[period] ?? { planned_qty: base.planned_qty, actual_qty: base.actual_qty };
    };
    const setEdit = (itemId, period, field, val) => {
        setEdits(prev => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                [period]: {
                    ...((prev[itemId]?.[period]) ?? { planned_qty: 0, actual_qty: 0 }),
                    [field]: parseFloat(val) || 0,
                },
            },
        }));
    };
    const saveRow = async (item) => {
        setSaving(item.id);
        const itemEdits = edits[item.id] ?? {};
        const entries = periods.map(p => {
            const base = getEntry(item, p);
            const edit = itemEdits[p];
            return {
                period_label: p,
                period_type: periodType,
                planned_qty: edit?.planned_qty ?? base.planned_qty,
                actual_qty: edit?.actual_qty ?? base.actual_qty,
            };
        });
        try {
            await client.put(`/projects/${projectId}/schedule/items/${item.id}/entries`, entries);
            load();
            setEdits(prev => { const n = { ...prev }; delete n[item.id]; return n; });
        }
        finally {
            setSaving(null);
        }
    };
    const loadFromEstimates = async () => {
        await client.post(`/projects/${projectId}/schedule/items/from-estimates`).catch(() => { });
        load();
    };
    const openNew = () => { setItemForm({ name: '', unit: '', total_quantity: '' }); setItemModal('new'); };
    const openEditItem = (item) => {
        setItemForm({ name: item.name, unit: item.unit, total_quantity: String(item.total_quantity) });
        setItemModal(item);
    };
    const saveItem = async () => {
        setSavingItem(true);
        try {
            const payload = { name: itemForm.name, unit: itemForm.unit, total_quantity: parseFloat(itemForm.total_quantity) || 0 };
            if (itemModal === 'new') {
                await client.post(`/projects/${projectId}/schedule/items`, payload);
            }
            else if (itemModal) {
                await client.patch(`/projects/${projectId}/schedule/items/${itemModal.id}`, payload);
            }
            setItemModal(null);
            load();
        }
        finally {
            setSavingItem(false);
        }
    };
    const deleteItem = async (id) => {
        if (!confirm('Удалить строку?'))
            return;
        await client.delete(`/projects/${projectId}/schedule/items/${id}`);
        load();
    };
    // totals per period
    const planTotals = periods.map(p => items.reduce((sum, item) => {
        const base = getEntry(item, p);
        return sum + (edits[item.id]?.[p]?.planned_qty ?? base.planned_qty);
    }, 0));
    const factTotals = periods.map(p => items.reduce((sum, item) => {
        const base = getEntry(item, p);
        return sum + (edits[item.id]?.[p]?.actual_qty ?? base.actual_qty);
    }, 0));
    const leftColW = 220;
    const cellW = 70;
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 12 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }, children: [_jsx("div", { style: { display: 'flex', gap: 2 }, children: ['month', 'week'].map(pt => (_jsx("button", { style: {
                                ...btnOutline('sm'),
                                background: periodType === pt ? C.primary : C.surface,
                                color: periodType === pt ? '#fff' : C.text,
                                border: `1px solid ${periodType === pt ? C.primary : C.border}`,
                            }, onClick: () => setPeriodType(pt), children: pt === 'month' ? 'Месяцы' : 'Недели' }, pt))) }), _jsxs("label", { style: { fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }, children: ["\u0421:", _jsx("input", { style: { ...INPUT, width: 130 }, type: "month", value: startPeriod, onChange: e => setStartPeriod(e.target.value) })] }), _jsxs("label", { style: { fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }, children: ["\u041F\u043E:", _jsx("input", { style: { ...INPUT, width: 130 }, type: "month", value: endPeriod, onChange: e => setEndPeriod(e.target.value) })] }), _jsx("button", { style: btnOutline('sm'), onClick: loadFromEstimates, children: "\u0418\u0437 \u0441\u043C\u0435\u0442\u044B" }), _jsx("button", { style: btnPrimary('sm'), onClick: openNew, children: "+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0441\u0442\u0440\u043E\u043A\u0443" }), _jsx("button", { style: btnGhost('sm'), onClick: async () => {
                            const resp = await client.get(`/projects/${projectId}/schedule/export-excel`, { responseType: 'blob' });
                            const url = URL.createObjectURL(resp.data);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'gpr.xlsx';
                            a.click();
                            URL.revokeObjectURL(url);
                        }, children: "\u2B07 Excel" })] }), _jsx("div", { style: { ...CARD, padding: 0, overflowX: 'auto' }, children: loading ? (_jsx("div", { style: { padding: 24, textAlign: 'center', color: C.textMuted }, children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430..." })) : (_jsxs("table", { style: { borderCollapse: 'collapse', tableLayout: 'fixed' }, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: { ...TH, width: leftColW, minWidth: leftColW, position: 'sticky', left: 0, zIndex: 2 }, children: "\u041D\u0430\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u0435 / \u0415\u0434. / \u041A\u043E\u043B-\u0432\u043E" }), periods.map(p => (_jsxs("th", { style: { ...TH, width: cellW, minWidth: cellW, textAlign: 'center' }, children: [_jsx("div", { style: { fontSize: 11 }, children: periodLabel(p, periodType) }), _jsxs("div", { style: { fontSize: 10, color: C.textMuted, display: 'flex', gap: 4, justifyContent: 'center' }, children: [_jsx("span", { children: "\u041F" }), _jsx("span", { children: "\u0424" })] })] }, p))), _jsx("th", { style: TH })] }) }), _jsxs("tbody", { children: [items.map(item => (_jsxs("tr", { children: [_jsxs("td", { style: { ...TD, position: 'sticky', left: 0, background: C.surface, zIndex: 1, width: leftColW, minWidth: leftColW }, children: [_jsx("div", { style: { fontWeight: 500, fontSize: 13 }, children: item.name }), _jsxs("div", { style: { fontSize: 11, color: C.textMuted }, children: [item.unit, " \u00B7 ", item.total_quantity] })] }), periods.map(p => {
                                            const base = getEntry(item, p);
                                            const { planned_qty, actual_qty } = getEdit(item.id, p, base);
                                            return (_jsx("td", { style: { ...TD, padding: 2, background: cellColor(planned_qty, actual_qty), width: cellW }, children: _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 1 }, children: [_jsx("input", { type: "number", value: planned_qty || '', onChange: e => setEdit(item.id, p, 'planned_qty', e.target.value), style: { width: '100%', fontSize: 11, padding: '2px 3px', border: `1px solid ${C.border}`, borderRadius: 3, textAlign: 'center', background: 'transparent', outline: 'none', boxSizing: 'border-box' }, placeholder: "\u041F" }), _jsx("input", { type: "number", value: actual_qty || '', onChange: e => setEdit(item.id, p, 'actual_qty', e.target.value), style: { width: '100%', fontSize: 11, padding: '2px 3px', border: `1px solid ${C.border}`, borderRadius: 3, textAlign: 'center', background: 'transparent', outline: 'none', boxSizing: 'border-box' }, placeholder: "\u0424" })] }) }, p));
                                        }), _jsxs("td", { style: { ...TD, whiteSpace: 'nowrap' }, children: [edits[item.id] && (_jsx("button", { style: btnPrimary('sm'), onClick: () => saveRow(item), disabled: saving === item.id, children: saving === item.id ? '...' : 'Сохранить' })), ' ', _jsx("button", { style: btnGhost('sm'), onClick: () => openEditItem(item), children: "\u270F\uFE0F" }), _jsx("button", { style: btnDanger('sm'), onClick: () => deleteItem(item.id), children: "\u2715" })] })] }, item.id))), _jsxs("tr", { style: { background: C.primaryBg }, children: [_jsx("td", { style: { ...TD, position: 'sticky', left: 0, background: C.primaryBg, fontWeight: 600, fontSize: 12, zIndex: 1 }, children: "\u0418\u0442\u043E\u0433\u043E \u043F\u043B\u0430\u043D" }), planTotals.map((t, i) => (_jsx("td", { style: { ...TD, textAlign: 'center', fontWeight: 600, fontSize: 12 }, children: t > 0 ? t.toFixed(1) : '' }, i))), _jsx("td", { style: TD })] }), _jsxs("tr", { style: { background: C.successBg }, children: [_jsx("td", { style: { ...TD, position: 'sticky', left: 0, background: C.successBg, fontWeight: 600, fontSize: 12, zIndex: 1 }, children: "\u0418\u0442\u043E\u0433\u043E \u0444\u0430\u043A\u0442" }), factTotals.map((t, i) => (_jsx("td", { style: { ...TD, textAlign: 'center', fontWeight: 600, fontSize: 12 }, children: t > 0 ? t.toFixed(1) : '' }, i))), _jsx("td", { style: TD })] })] })] })) }), itemModal !== null && (_jsx("div", { style: OVERLAY, onClick: e => { if (e.target === e.currentTarget)
                    setItemModal(null); }, children: _jsxs("div", { style: { ...MODAL, maxWidth: 400 }, children: [_jsx("h3", { style: { margin: '0 0 16px', fontSize: 16, fontWeight: 600 }, children: itemModal === 'new' ? 'Новая строка' : 'Редактировать строку' }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 12 }, children: [_jsxs("label", { style: LBL, children: ["\u041D\u0430\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u0435", _jsx("input", { style: INPUT, value: itemForm.name, onChange: e => setItemForm(f => ({ ...f, name: e.target.value })) })] }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }, children: [_jsxs("label", { style: LBL, children: ["\u0415\u0434\u0438\u043D\u0438\u0446\u0430", _jsx("input", { style: INPUT, value: itemForm.unit, onChange: e => setItemForm(f => ({ ...f, unit: e.target.value })) })] }), _jsxs("label", { style: LBL, children: ["\u041A\u043E\u043B-\u0432\u043E", _jsx("input", { style: INPUT, type: "number", value: itemForm.total_quantity, onChange: e => setItemForm(f => ({ ...f, total_quantity: e.target.value })) })] })] })] }), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }, children: [_jsx("button", { style: btnOutline(), onClick: () => setItemModal(null), children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { style: btnPrimary(), onClick: saveItem, disabled: savingItem, children: savingItem ? 'Сохранение...' : 'Сохранить' })] })] }) }))] }));
}
