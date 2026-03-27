import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import client from '../api/client';
export default function AnaloguePanel({ taskId, itemId, isAnalogue, onClose, onApplied }) {
    const [analogues, setAnalogues] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [applying, setApplying] = useState(null);
    const [reverting, setReverting] = useState(false);
    const base = `/projects/estimates/${taskId}/items/${itemId}`;
    useEffect(() => {
        client.post(`${base}/find-analogues`)
            .then(({ data }) => setAnalogues(data))
            .catch(() => setError('Ошибка поиска аналогов'))
            .finally(() => setLoading(false));
    }, [taskId, itemId]);
    async function apply(id) {
        setApplying(id);
        try {
            await client.post(`${base}/apply-analogue`, { analogue_id: id });
            onApplied();
        }
        catch {
            alert('Ошибка применения');
        }
        finally {
            setApplying(null);
        }
    }
    async function revert() {
        setReverting(true);
        try {
            await client.post(`${base}/revert-analogue`);
            onApplied();
        }
        catch {
            alert('Ошибка отмены');
        }
        finally {
            setReverting(false);
        }
    }
    return (_jsxs("div", { style: { position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, background: '#fff', boxShadow: '-4px 0 16px rgba(0,0,0,0.15)', zIndex: 1200, display: 'flex', flexDirection: 'column' }, children: [_jsxs("div", { style: { padding: '14px 20px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsx("h3", { style: { margin: 0 }, children: "\u0410\u043D\u0430\u043B\u043E\u0433\u0438" }), _jsx("button", { onClick: onClose, style: { border: 'none', background: 'none', fontSize: 22, cursor: 'pointer' }, children: "\u00D7" })] }), _jsxs("div", { style: { flex: 1, overflowY: 'auto', padding: 16 }, children: [isAnalogue && (_jsxs("div", { style: { padding: '10px 14px', background: '#fff3e0', border: '1px solid #ffcc02', borderRadius: 6, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsx("span", { style: { fontSize: 14, color: '#e65100' }, children: "\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442\u0441\u044F \u0430\u043D\u0430\u043B\u043E\u0433" }), _jsx("button", { onClick: revert, disabled: reverting, style: { padding: '5px 12px', background: '#ff9800', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }, children: reverting ? 'Отмена...' : 'Отменить' })] })), loading && _jsx("p", { style: { color: '#aaa' }, children: "\u041F\u043E\u0438\u0441\u043A..." }), error && _jsx("p", { style: { color: '#f44336' }, children: error }), !loading && !error && analogues.length === 0 && _jsx("p", { style: { color: '#aaa' }, children: "\u0410\u043D\u0430\u043B\u043E\u0433\u0438 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B" }), analogues.map((a) => (_jsxs("div", { style: { border: '1px solid #e0e0e0', borderRadius: 6, padding: '12px 14px', marginBottom: 10 }, children: [_jsx("div", { style: { fontWeight: 600, fontSize: 14, marginBottom: 4 }, children: a.name }), _jsxs("div", { style: { fontSize: 13, color: '#555', marginBottom: 6 }, children: [a.price.toLocaleString('ru-RU'), " \u20BD / ", a.unit, " \u2014 ", a.supplier, _jsxs("span", { style: { marginLeft: 8, color: a.economy_pct > 0 ? '#4caf50' : '#f44336', fontWeight: 600 }, children: [a.economy_pct.toFixed(1), "%"] })] }), _jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center' }, children: [a.source_url && _jsx("a", { href: a.source_url, target: "_blank", rel: "noreferrer", style: { fontSize: 12, color: '#1565c0' }, children: "\u0418\u0441\u0442\u043E\u0447\u043D\u0438\u043A \u2197" }), _jsx("button", { onClick: () => apply(a.id), disabled: applying === a.id, style: { marginLeft: 'auto', padding: '5px 14px', background: applying === a.id ? '#bdbdbd' : '#1565c0', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }, children: applying === a.id ? '...' : 'Применить' })] })] }, a.id)))] })] }));
}
