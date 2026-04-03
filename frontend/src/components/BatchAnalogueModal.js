import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import client from '../api/client';
import { C, btnPrimary, btnOutline, OVERLAY, MODAL } from '../ui';
const fmt = (n) => n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export default function BatchAnalogueModal({ taskId, items, onClose, onApplied }) {
    const base = `/projects/estimates/${taskId}/items`;
    const [results, setResults] = useState(items.map(item => ({ item, analogues: [], loading: true, error: '', selected: null })));
    const [applying, setApplying] = useState(false);
    useEffect(() => {
        items.forEach((item, idx) => {
            client.post(`${base}/${item.id}/find-analogues`)
                .then(({ data }) => {
                setResults(prev => prev.map((r, i) => i === idx ? { ...r, loading: false, analogues: data, selected: data[0]?.id ?? null } : r));
            })
                .catch(() => {
                setResults(prev => prev.map((r, i) => i === idx ? { ...r, loading: false, error: 'Не найдено' } : r));
            });
        });
    }, [taskId]);
    function toggleSelected(idx, analogueId) {
        setResults(prev => prev.map((r, i) => i === idx ? { ...r, selected: r.selected === analogueId ? null : analogueId } : r));
    }
    async function applyAll() {
        setApplying(true);
        let applied = 0;
        for (const r of results) {
            if (!r.selected)
                continue;
            try {
                await client.post(`${base}/${r.item.id}/apply-analogue`, { analogue_id: r.selected });
                applied++;
            }
            catch { }
        }
        setApplying(false);
        if (applied > 0)
            onApplied();
        else
            onClose();
    }
    const readyCount = results.filter(r => r.selected).length;
    return (_jsx("div", { style: OVERLAY, children: _jsxs("div", { style: { ...MODAL, maxWidth: 680, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexShrink: 0 }, children: [_jsxs("h3", { style: { margin: 0, fontSize: 16 }, children: ["\u041F\u043E\u0434\u0431\u043E\u0440 \u0430\u043D\u0430\u043B\u043E\u0433\u043E\u0432 (", items.length, " \u043F\u043E\u0437\u0438\u0446\u0438\u0439)"] }), _jsx("button", { onClick: onClose, style: { border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: C.textMuted }, children: "\u00D7" })] }), _jsx("div", { style: { flex: 1, overflowY: 'auto' }, children: results.map((r, idx) => (_jsxs("div", { style: { border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 12, overflow: 'hidden' }, children: [_jsx("div", { style: { padding: '8px 12px', background: C.surfaceAlt, borderBottom: `1px solid ${C.border}` }, children: _jsx("span", { style: { fontWeight: 600, fontSize: 13, color: C.text }, children: r.item.name }) }), _jsxs("div", { style: { padding: '8px 12px' }, children: [r.loading && _jsx("p", { style: { margin: 0, fontSize: 13, color: C.textMuted }, children: "\u041F\u043E\u0438\u0441\u043A..." }), r.error && _jsx("p", { style: { margin: 0, fontSize: 13, color: C.danger }, children: r.error }), !r.loading && !r.error && r.analogues.length === 0 && (_jsx("p", { style: { margin: 0, fontSize: 13, color: C.textMuted }, children: "\u0410\u043D\u0430\u043B\u043E\u0433\u0438 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B" })), r.analogues.map(a => (_jsxs("div", { onClick: () => toggleSelected(idx, a.id), style: { display: 'flex', gap: 10, alignItems: 'flex-start', padding: '7px 10px', borderRadius: 6, marginBottom: 6, cursor: 'pointer', border: `1px solid ${r.selected === a.id ? C.primary : C.border}`, background: r.selected === a.id ? C.primaryBg : C.surface }, children: [_jsx("input", { type: "radio", checked: r.selected === a.id, onChange: () => toggleSelected(idx, a.id), style: { marginTop: 2, flexShrink: 0 } }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("div", { style: { fontSize: 13, fontWeight: 500, color: C.text }, children: a.name }), _jsxs("div", { style: { fontSize: 12, color: C.textSec, marginTop: 2 }, children: [fmt(a.price), " \u20BD/", a.unit, " \u00B7 ", a.supplier, a.economy_pct > 0 && _jsxs("span", { style: { marginLeft: 8, color: C.success, fontWeight: 600 }, children: ["\u2212", a.economy_pct.toFixed(1), "%"] })] })] })] }, a.id)))] })] }, r.item.id))) }), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 16, paddingTop: 12, borderTop: `1px solid ${C.border}`, flexShrink: 0 }, children: [_jsx("button", { onClick: applyAll, disabled: applying || readyCount === 0, style: { ...btnPrimary(), opacity: readyCount === 0 ? 0.5 : 1 }, children: applying ? 'Применение...' : `Применить (${readyCount})` }), _jsx("button", { onClick: onClose, style: btnOutline(), children: "\u041E\u0442\u043C\u0435\u043D\u0430" })] })] }) }));
}
