import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import client from '../api/client';
export default function OptimizationChecklist({ taskId, onClose, onOptimized }) {
    const [items, setItems] = useState([]);
    const [totalSavings, setTotalSavings] = useState(0);
    const [selected, setSelected] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [executing, setExecuting] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        client.post(`/projects/estimates/${taskId}/optimize/plan`)
            .then(({ data }) => { setItems(data.items); setTotalSavings(data.total_savings); setSelected(new Set(data.items.map((i) => i.id))); })
            .catch(() => setError('Ошибка получения плана'))
            .finally(() => setLoading(false));
    }, [taskId]);
    function toggle(id) {
        setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
    }
    async function execute() {
        setExecuting(true);
        try {
            await client.post(`/projects/estimates/${taskId}/optimize/execute`, { item_ids: Array.from(selected) });
            onOptimized();
        }
        catch {
            alert('Ошибка оптимизации');
        }
        finally {
            setExecuting(false);
        }
    }
    const selectedSavings = items.filter((i) => selected.has(i.id)).reduce((s, i) => s + i.savings, 0);
    return (_jsx("div", { style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center' }, children: _jsxs("div", { style: { background: '#fff', borderRadius: 8, width: '90%', maxWidth: 620, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }, children: [_jsxs("div", { style: { padding: '14px 20px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsx("h3", { style: { margin: 0 }, children: "\u041E\u043F\u0442\u0438\u043C\u0438\u0437\u0430\u0446\u0438\u044F \u0441\u043C\u0435\u0442\u044B" }), _jsx("button", { onClick: onClose, style: { border: 'none', background: 'none', fontSize: 22, cursor: 'pointer' }, children: "\u00D7" })] }), _jsxs("div", { style: { flex: 1, overflowY: 'auto', padding: 16 }, children: [loading && _jsx("p", { style: { color: '#aaa' }, children: "\u0410\u043D\u0430\u043B\u0438\u0437..." }), error && _jsx("p", { style: { color: '#f44336' }, children: error }), !loading && !error && items.length === 0 && _jsx("p", { style: { color: '#aaa' }, children: "\u041D\u0435\u0442 \u043F\u043E\u0437\u0438\u0446\u0438\u0439 \u0434\u043B\u044F \u043E\u043F\u0442\u0438\u043C\u0438\u0437\u0430\u0446\u0438\u0438" }), _jsxs("p", { style: { margin: '0 0 12px', fontSize: 14 }, children: ["\u041C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F \u044D\u043A\u043E\u043D\u043E\u043C\u0438\u044F: ", _jsxs("strong", { children: [fmt(totalSavings), " \u20BD"] })] }), items.map((item) => (_jsxs("div", { onClick: () => toggle(item.id), style: { display: 'flex', gap: 12, padding: '10px 12px', border: '1px solid #e0e0e0', borderRadius: 6, marginBottom: 8, cursor: 'pointer', background: selected.has(item.id) ? '#f0f7ff' : '#fafafa' }, children: [_jsx("input", { type: "checkbox", checked: selected.has(item.id), onChange: () => toggle(item.id), onClick: (e) => e.stopPropagation(), style: { marginTop: 3 } }), _jsxs("div", { children: [_jsx("div", { style: { fontWeight: 500, fontSize: 14 }, children: item.name }), _jsx("div", { style: { fontSize: 12, color: '#666' }, children: item.description }), _jsxs("div", { style: { fontSize: 12, color: '#888' }, children: [fmt(item.current_price), " \u2192 ", _jsxs("span", { style: { color: '#4caf50', fontWeight: 600 }, children: [fmt(item.optimized_price), " \u20BD"] }), " (\u044D\u043A\u043E\u043D\u043E\u043C\u0438\u044F: ", fmt(item.savings), " \u20BD)"] })] })] }, item.id)))] }), !loading && !error && items.length > 0 && (_jsxs("div", { style: { padding: '12px 20px', borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsxs("span", { style: { fontSize: 13 }, children: ["\u0412\u044B\u0431\u0440\u0430\u043D\u043E: ", selected.size, " | \u042D\u043A\u043E\u043D\u043E\u043C\u0438\u044F: ", _jsxs("strong", { style: { color: '#4caf50' }, children: [fmt(selectedSavings), " \u20BD"] })] }), _jsx("button", { onClick: execute, disabled: executing || selected.size === 0, style: { padding: '8px 18px', background: executing ? '#bdbdbd' : '#4caf50', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }, children: executing ? 'Выполняется...' : 'Оптимизировать' })] }))] }) }));
}
function fmt(v) { return v.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
