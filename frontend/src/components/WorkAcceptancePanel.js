import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import client from '../api/client';
import { C, btnPrimary, btnOutline, btnGhost, btnDanger, INPUT, LBL, CARD, TH, TD } from '../ui';
// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_LABEL = {
    draft: 'Черновик',
    accepted: 'Принят',
    rejected: 'Отклонён',
};
function statusBadge(status) {
    const styles = {
        draft: { color: C.textSec, bg: C.surfaceAlt, border: C.border },
        accepted: { color: C.success, bg: C.successBg, border: '#bbf7d0' },
        rejected: { color: C.danger, bg: C.dangerBg, border: C.dangerBorder },
    };
    const s = styles[status] ?? styles.draft;
    return {
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 600,
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
    };
}
// ─── Component ────────────────────────────────────────────────────────────────
export default function WorkAcceptancePanel({ taskId, items }) {
    const base = `/projects/estimates/${taskId}`;
    // Data
    const [contractors, setContractors] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [acceptances, setAcceptances] = useState([]);
    const [progress, setProgress] = useState([]);
    // Assignment form
    const [showNewAssign, setShowNewAssign] = useState(false);
    const [newAssign, setNewAssign] = useState({
        contractor_id: '',
        scope_type: 'all',
        scope_ref: '',
        notes: '',
    });
    // Acceptance form
    const [showNewAcc, setShowNewAcc] = useState(false);
    const [newAcc, setNewAcc] = useState({
        contractor_id: '',
        act_number: '',
        period_start: '',
        period_end: '',
        notes: '',
    });
    // Expanded acceptance items editor
    const [expandedAccId, setExpandedAccId] = useState(null);
    const [accItems, setAccItems] = useState({});
    // Loading
    const [savingAssign, setSavingAssign] = useState(false);
    const [savingAcc, setSavingAcc] = useState(false);
    const [savingItems, setSavingItems] = useState(null);
    const [deletingAssign, setDeletingAssign] = useState(null);
    const [deletingAcc, setDeletingAcc] = useState(null);
    const [updatingStatus, setUpdatingStatus] = useState(null);
    // ── Fetch on mount ──────────────────────────────────────────────────────────
    useEffect(() => {
        client.get('/contractors').then(({ data }) => setContractors(data)).catch(() => { });
        client.get(`${base}/assignments`).then(({ data }) => setAssignments(data)).catch(() => { });
        client.get(`${base}/acceptances`).then(({ data }) => setAcceptances(data)).catch(() => { });
        client.get(`${base}/acceptance-progress`).then(({ data }) => setProgress(data)).catch(() => { });
    }, [taskId]);
    // ── Helpers ─────────────────────────────────────────────────────────────────
    function contractorName(id) {
        return contractors.find((c) => c.id === id)?.name ?? id;
    }
    function nonHeaderItems() {
        return items.filter((i) => i.row_type !== 'section_header');
    }
    // ── Assignment actions ───────────────────────────────────────────────────────
    async function saveAssignment() {
        if (!newAssign.contractor_id)
            return;
        setSavingAssign(true);
        try {
            const { data } = await client.post(`${base}/assignments`, newAssign);
            setAssignments((prev) => [...prev, data]);
            setShowNewAssign(false);
            setNewAssign({ contractor_id: '', scope_type: 'all', scope_ref: '', notes: '' });
        }
        catch {
            alert('Ошибка сохранения назначения');
        }
        finally {
            setSavingAssign(false);
        }
    }
    async function deleteAssignment(id) {
        setDeletingAssign(id);
        try {
            await client.delete(`${base}/assignments/${id}`);
            setAssignments((prev) => prev.filter((a) => a.id !== id));
        }
        catch {
            alert('Ошибка удаления');
        }
        finally {
            setDeletingAssign(null);
        }
    }
    // ── Acceptance actions ───────────────────────────────────────────────────────
    async function saveAcceptance() {
        if (!newAcc.contractor_id || !newAcc.act_number)
            return;
        setSavingAcc(true);
        try {
            const { data } = await client.post(`${base}/acceptances`, newAcc);
            setAcceptances((prev) => [...prev, data]);
            setShowNewAcc(false);
            setNewAcc({ contractor_id: '', act_number: '', period_start: '', period_end: '', notes: '' });
        }
        catch {
            alert('Ошибка сохранения акта');
        }
        finally {
            setSavingAcc(false);
        }
    }
    async function deleteAcceptance(id) {
        setDeletingAcc(id);
        try {
            await client.delete(`${base}/acceptances/${id}`);
            setAcceptances((prev) => prev.filter((a) => a.id !== id));
            if (expandedAccId === id)
                setExpandedAccId(null);
        }
        catch {
            alert('Ошибка удаления акта');
        }
        finally {
            setDeletingAcc(null);
        }
    }
    async function updateStatus(id, status) {
        setUpdatingStatus(id);
        try {
            const { data } = await client.patch(`${base}/acceptances/${id}`, { status });
            setAcceptances((prev) => prev.map((a) => (a.id === id ? data : a)));
        }
        catch {
            alert('Ошибка изменения статуса');
        }
        finally {
            setUpdatingStatus(null);
        }
    }
    // ── Acceptance items ─────────────────────────────────────────────────────────
    function toggleExpand(accId) {
        if (expandedAccId === accId) {
            setExpandedAccId(null);
            return;
        }
        setExpandedAccId(accId);
        if (!accItems[accId]) {
            // Pre-populate with zeros for every non-header item
            const init = nonHeaderItems().map((i) => ({
                estimate_item_id: i.id,
                quantity_accepted: 0,
            }));
            // Fetch existing saved items and merge
            client.get(`${base}/acceptances/${accId}/items`)
                .then(({ data }) => {
                const map = {};
                data.forEach((d) => { map[d.estimate_item_id] = d.quantity_accepted; });
                setAccItems((prev) => ({
                    ...prev,
                    [accId]: init.map((i) => ({ ...i, quantity_accepted: map[i.estimate_item_id] ?? 0 })),
                }));
            })
                .catch(() => {
                setAccItems((prev) => ({ ...prev, [accId]: init }));
            });
        }
    }
    function setAccItemQty(accId, itemId, qty) {
        setAccItems((prev) => ({
            ...prev,
            [accId]: (prev[accId] ?? []).map((r) => r.estimate_item_id === itemId ? { ...r, quantity_accepted: qty } : r),
        }));
    }
    async function saveAccItems(accId) {
        setSavingItems(accId);
        try {
            await client.put(`${base}/acceptances/${accId}/items`, accItems[accId] ?? []);
            // Refresh acceptances to update totals
            const { data } = await client.get(`${base}/acceptances`);
            setAcceptances(data);
        }
        catch (e) {
            const msg = e?.response?.data?.detail;
            alert('Ошибка сохранения позиций' + (msg ? ': ' + msg : ''));
        }
        finally {
            setSavingItems(null);
        }
    }
    // ─── Render ──────────────────────────────────────────────────────────────────
    const sectionTitle = {
        fontSize: 14,
        fontWeight: 700,
        color: C.text,
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
    };
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 20 }, children: [_jsxs("div", { style: CARD, children: [_jsxs("div", { style: sectionTitle, children: [_jsx("span", { children: "\u041D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0441\u0443\u0431\u043F\u043E\u0434\u0440\u044F\u0434\u0447\u0438\u043A\u043E\u0432" }), !showNewAssign && (_jsx("button", { style: btnOutline('sm'), onClick: () => setShowNewAssign(true), children: "+ \u041D\u0430\u0437\u043D\u0430\u0447\u0438\u0442\u044C" }))] }), assignments.length === 0 && !showNewAssign && (_jsx("p", { style: { fontSize: 13, color: C.textMuted, margin: 0 }, children: "\u041D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0439 \u043D\u0435\u0442" })), assignments.map((a) => (_jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 0',
                            borderBottom: `1px solid ${C.border}`,
                        }, children: [_jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("span", { style: { fontSize: 13, fontWeight: 500, color: C.text }, children: contractorName(a.contractor_id) }), _jsx("span", { style: { fontSize: 12, color: C.textSec, marginLeft: 8 }, children: a.scope_type === 'all' ? 'Весь объём' : a.scope_type === 'section' ? `Раздел: ${a.scope_ref}` : `Позиция: ${a.scope_ref}` }), a.notes && (_jsxs("span", { style: { fontSize: 12, color: C.textMuted, marginLeft: 8 }, children: ["\u2014 ", a.notes] }))] }), _jsx("button", { style: btnDanger('sm'), disabled: deletingAssign === a.id, onClick: () => deleteAssignment(a.id), title: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435", children: deletingAssign === a.id ? '...' : '✕' })] }, a.id))), showNewAssign && (_jsxs("div", { style: {
                            marginTop: 12,
                            padding: 14,
                            background: C.surfaceAlt,
                            borderRadius: 6,
                            border: `1px solid ${C.border}`,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10,
                        }, children: [_jsxs("label", { style: LBL, children: ["\u041F\u043E\u0434\u0440\u044F\u0434\u0447\u0438\u043A", _jsxs("select", { style: INPUT, value: newAssign.contractor_id, onChange: (e) => setNewAssign((p) => ({ ...p, contractor_id: e.target.value })), children: [_jsx("option", { value: "", children: "\u2014 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u2014" }), contractors.map((c) => (_jsxs("option", { value: c.id, children: [c.name, " (", c.kind, ")"] }, c.id)))] })] }), _jsxs("label", { style: LBL, children: ["\u041E\u0431\u043B\u0430\u0441\u0442\u044C \u0440\u0430\u0431\u043E\u0442", _jsx("div", { style: { display: 'flex', gap: 14, marginTop: 4 }, children: ['all', 'section', 'item'].map((st) => (_jsxs("label", { style: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, cursor: 'pointer' }, children: [_jsx("input", { type: "radio", name: "scope_type", value: st, checked: newAssign.scope_type === st, onChange: () => setNewAssign((p) => ({ ...p, scope_type: st, scope_ref: '' })) }), st === 'all' ? 'Весь объём' : st === 'section' ? 'Раздел' : 'Позиция'] }, st))) })] }), newAssign.scope_type !== 'all' && (_jsxs("label", { style: LBL, children: [newAssign.scope_type === 'section' ? 'Название раздела' : 'Название позиции', _jsx("input", { style: INPUT, list: "scope-ref-options", value: newAssign.scope_ref, onChange: (e) => setNewAssign((p) => ({ ...p, scope_ref: e.target.value })), placeholder: newAssign.scope_type === 'section' ? 'Введите раздел...' : 'Введите позицию...' }), _jsx("datalist", { id: "scope-ref-options", children: newAssign.scope_type === 'section'
                                            ? [...new Set(items.map((i) => i.section))].map((s) => _jsx("option", { value: s }, s))
                                            : nonHeaderItems().map((i) => _jsx("option", { value: i.name }, i.id)) })] })), _jsxs("label", { style: LBL, children: ["\u041F\u0440\u0438\u043C\u0435\u0447\u0430\u043D\u0438\u044F", _jsx("input", { style: INPUT, value: newAssign.notes, onChange: (e) => setNewAssign((p) => ({ ...p, notes: e.target.value })), placeholder: "\u041D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E..." })] }), _jsxs("div", { style: { display: 'flex', gap: 8 }, children: [_jsx("button", { style: btnPrimary('sm'), disabled: savingAssign || !newAssign.contractor_id, onClick: saveAssignment, children: savingAssign ? 'Сохранение...' : 'Сохранить' }), _jsx("button", { style: btnGhost('sm'), onClick: () => { setShowNewAssign(false); setNewAssign({ contractor_id: '', scope_type: 'all', scope_ref: '', notes: '' }); }, children: "\u041E\u0442\u043C\u0435\u043D\u0430" })] })] }))] }), _jsxs("div", { style: CARD, children: [_jsxs("div", { style: sectionTitle, children: [_jsx("span", { children: "\u0410\u043A\u0442\u044B \u043F\u0440\u0438\u0435\u043C\u043A\u0438 \u0440\u0430\u0431\u043E\u0442" }), !showNewAcc && (_jsx("button", { style: btnPrimary('sm'), onClick: () => setShowNewAcc(true), children: "+ \u041D\u043E\u0432\u044B\u0439 \u0430\u043A\u0442" }))] }), showNewAcc && (_jsxs("div", { style: {
                            marginBottom: 14,
                            padding: 14,
                            background: C.surfaceAlt,
                            borderRadius: 6,
                            border: `1px solid ${C.border}`,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10,
                        }, children: [_jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }, children: [_jsxs("label", { style: LBL, children: ["\u041F\u043E\u0434\u0440\u044F\u0434\u0447\u0438\u043A", _jsxs("select", { style: INPUT, value: newAcc.contractor_id, onChange: (e) => setNewAcc((p) => ({ ...p, contractor_id: e.target.value })), children: [_jsx("option", { value: "", children: "\u2014 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u2014" }), contractors.map((c) => (_jsx("option", { value: c.id, children: c.name }, c.id)))] })] }), _jsxs("label", { style: LBL, children: ["\u041D\u043E\u043C\u0435\u0440 \u0430\u043A\u0442\u0430", _jsx("input", { style: INPUT, value: newAcc.act_number, onChange: (e) => setNewAcc((p) => ({ ...p, act_number: e.target.value })), placeholder: "\u041A\u0421-2/1" })] }), _jsxs("label", { style: LBL, children: ["\u041F\u0435\u0440\u0438\u043E\u0434 \u0441", _jsx("input", { type: "date", style: INPUT, value: newAcc.period_start, onChange: (e) => setNewAcc((p) => ({ ...p, period_start: e.target.value })) })] }), _jsxs("label", { style: LBL, children: ["\u041F\u0435\u0440\u0438\u043E\u0434 \u043F\u043E", _jsx("input", { type: "date", style: INPUT, value: newAcc.period_end, onChange: (e) => setNewAcc((p) => ({ ...p, period_end: e.target.value })) })] })] }), _jsxs("label", { style: LBL, children: ["\u041F\u0440\u0438\u043C\u0435\u0447\u0430\u043D\u0438\u044F", _jsx("input", { style: INPUT, value: newAcc.notes, onChange: (e) => setNewAcc((p) => ({ ...p, notes: e.target.value })), placeholder: "\u041D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E..." })] }), _jsxs("div", { style: { display: 'flex', gap: 8 }, children: [_jsx("button", { style: btnPrimary('sm'), disabled: savingAcc || !newAcc.contractor_id || !newAcc.act_number, onClick: saveAcceptance, children: savingAcc ? 'Сохранение...' : 'Сохранить' }), _jsx("button", { style: btnGhost('sm'), onClick: () => { setShowNewAcc(false); setNewAcc({ contractor_id: '', act_number: '', period_start: '', period_end: '', notes: '' }); }, children: "\u041E\u0442\u043C\u0435\u043D\u0430" })] })] })), acceptances.length === 0 && !showNewAcc && (_jsx("p", { style: { fontSize: 13, color: C.textMuted, margin: 0 }, children: "\u0410\u043A\u0442\u043E\u0432 \u043D\u0435\u0442" })), acceptances.map((acc) => {
                        const isExpanded = expandedAccId === acc.id;
                        const rows = accItems[acc.id] ?? [];
                        return (_jsxs("div", { style: {
                                border: `1px solid ${C.border}`,
                                borderRadius: 6,
                                marginBottom: 8,
                                overflow: 'hidden',
                            }, children: [_jsxs("div", { style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        padding: '10px 12px',
                                        background: isExpanded ? C.primaryBg : C.surface,
                                    }, children: [_jsx("button", { style: { ...btnGhost('sm'), padding: '2px 6px', fontSize: 16, color: C.primary }, onClick: () => toggleExpand(acc.id), title: isExpanded ? 'Свернуть' : 'Развернуть', children: isExpanded ? '▾' : '▸' }), _jsxs("span", { style: { fontWeight: 600, fontSize: 13, color: C.text, minWidth: 80 }, children: ["\u2116 ", acc.act_number] }), _jsxs("span", { style: { fontSize: 13, color: C.textSec, flex: 1 }, children: [contractorName(acc.contractor_id), acc.period_start && acc.period_end && (_jsxs("span", { style: { color: C.textMuted, marginLeft: 8 }, children: [acc.period_start, " \u2014 ", acc.period_end] }))] }), _jsx("span", { style: statusBadge(acc.status), children: STATUS_LABEL[acc.status] ?? acc.status }), _jsxs("span", { style: { fontSize: 12, color: C.textSec }, children: [acc.items_count, " \u043F\u043E\u0437. \u00B7 ", acc.total_accepted_value?.toLocaleString('ru-RU'), " \u20BD"] }), _jsx("button", { style: btnOutline('sm'), disabled: updatingStatus === acc.id, title: "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0441\u0442\u0430\u0442\u0443\u0441", onClick: () => {
                                                const next = acc.status === 'draft' ? 'accepted' : acc.status === 'accepted' ? 'rejected' : 'draft';
                                                updateStatus(acc.id, next);
                                            }, children: updatingStatus === acc.id ? '...' : '⟳' }), _jsx("button", { style: btnDanger('sm'), disabled: deletingAcc === acc.id, title: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0430\u043A\u0442", onClick: () => deleteAcceptance(acc.id), children: deletingAcc === acc.id ? '...' : '✕' })] }), isExpanded && (_jsxs("div", { style: { borderTop: `1px solid ${C.border}` }, children: [_jsx("div", { style: { overflowX: 'auto' }, children: _jsxs("table", { style: { width: '100%', borderCollapse: 'collapse' }, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: { ...TH, width: '40%' }, children: "\u041D\u0430\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u0435" }), _jsx("th", { style: { ...TH, textAlign: 'center' }, children: "\u0415\u0434." }), _jsx("th", { style: { ...TH, textAlign: 'right' }, children: "\u0412\u0441\u0435\u0433\u043E \u0432 \u0441\u043C\u0435\u0442\u0435" }), _jsx("th", { style: { ...TH, textAlign: 'right', width: 110 }, children: "\u041F\u0440\u0438\u043D\u044F\u0442\u043E" }), _jsx("th", { style: { ...TH, textAlign: 'right' }, children: "\u041E\u0441\u0442\u0430\u0442\u043E\u043A" })] }) }), _jsx("tbody", { children: nonHeaderItems().map((item) => {
                                                            const row = rows.find((r) => r.estimate_item_id === item.id);
                                                            const qtyAcc = row?.quantity_accepted ?? 0;
                                                            const remaining = Math.max(0, item.quantity - qtyAcc);
                                                            return (_jsxs("tr", { children: [_jsx("td", { style: TD, children: item.name }), _jsx("td", { style: { ...TD, textAlign: 'center', color: C.textSec }, children: item.unit }), _jsx("td", { style: { ...TD, textAlign: 'right' }, children: item.quantity }), _jsx("td", { style: { ...TD, textAlign: 'right', padding: '4px 10px' }, children: _jsx("input", { type: "number", min: 0, max: item.quantity, step: "any", style: { ...INPUT, width: 80, textAlign: 'right', padding: '4px 6px' }, value: qtyAcc, onChange: (e) => setAccItemQty(acc.id, item.id, parseFloat(e.target.value) || 0) }) }), _jsx("td", { style: { ...TD, textAlign: 'right', color: remaining > 0 ? C.textSec : C.success }, children: remaining })] }, item.id));
                                                        }) })] }) }), _jsxs("div", { style: { display: 'flex', gap: 8, padding: '10px 12px', borderTop: `1px solid ${C.border}`, background: C.surfaceAlt }, children: [_jsx("button", { style: btnPrimary('sm'), disabled: savingItems === acc.id, onClick: () => saveAccItems(acc.id), children: savingItems === acc.id ? 'Сохранение...' : 'Сохранить позиции' }), _jsx("button", { style: btnOutline('sm'), onClick: () => {
                                                        // Emit a custom event that the parent EstimateView can listen to
                                                        window.dispatchEvent(new CustomEvent('generate-ks2', { detail: { acceptanceId: acc.id, taskId } }));
                                                    }, children: "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u041A\u0421-2" })] })] }))] }, acc.id));
                    })] }), _jsxs("div", { style: CARD, children: [_jsx("div", { style: { ...sectionTitle, marginBottom: 14 }, children: _jsx("span", { children: "\u041F\u0440\u043E\u0433\u0440\u0435\u0441\u0441 \u043F\u043E \u043F\u043E\u0437\u0438\u0446\u0438\u044F\u043C" }) }), progress.length === 0 ? (_jsx("p", { style: { fontSize: 13, color: C.textMuted, margin: 0 }, children: "\u041D\u0435\u0442 \u0434\u0430\u043D\u043D\u044B\u0445 \u043E \u043F\u0440\u043E\u0433\u0440\u0435\u0441\u0441\u0435" })) : (_jsx("div", { style: { overflowX: 'auto' }, children: _jsxs("table", { style: { width: '100%', borderCollapse: 'collapse' }, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: { ...TH, width: '35%' }, children: "\u041D\u0430\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u0435" }), _jsx("th", { style: { ...TH, textAlign: 'center' }, children: "\u0415\u0434." }), _jsx("th", { style: { ...TH, textAlign: 'right' }, children: "\u041F\u043E \u0441\u043C\u0435\u0442\u0435" }), _jsx("th", { style: { ...TH, textAlign: 'right' }, children: "\u041F\u0440\u0438\u043D\u044F\u0442\u043E" }), _jsx("th", { style: { ...TH, textAlign: 'right' }, children: "\u041E\u0441\u0442\u0430\u0442\u043E\u043A" }), _jsx("th", { style: { ...TH, width: 140 }, children: "\u041F\u0440\u043E\u0433\u0440\u0435\u0441\u0441" })] }) }), _jsx("tbody", { children: progress.map((p) => {
                                        const pct = Math.min(100, Math.max(0, p.pct_complete));
                                        const barColor = pct >= 100 ? C.success : pct > 0 ? C.warning : C.textMuted;
                                        return (_jsxs("tr", { children: [_jsx("td", { style: TD, children: p.name }), _jsx("td", { style: { ...TD, textAlign: 'center', color: C.textSec }, children: p.unit }), _jsx("td", { style: { ...TD, textAlign: 'right' }, children: p.quantity_total }), _jsx("td", { style: { ...TD, textAlign: 'right' }, children: p.quantity_accepted }), _jsx("td", { style: { ...TD, textAlign: 'right', color: p.quantity_remaining > 0 ? C.textSec : C.success }, children: p.quantity_remaining }), _jsx("td", { style: TD, children: _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6 }, children: [_jsx("div", { style: {
                                                                    flex: 1,
                                                                    height: 8,
                                                                    background: C.border,
                                                                    borderRadius: 99,
                                                                    overflow: 'hidden',
                                                                }, children: _jsx("div", { style: {
                                                                        width: `${pct}%`,
                                                                        height: '100%',
                                                                        background: barColor,
                                                                        borderRadius: 99,
                                                                        transition: 'width .3s ease',
                                                                    } }) }), _jsxs("span", { style: { fontSize: 11, color: barColor, fontWeight: 600, minWidth: 32, textAlign: 'right' }, children: [pct.toFixed(0), "%"] })] }) })] }, p.estimate_item_id));
                                    }) })] }) }))] })] }));
}
