import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import client from '../api/client';
export default function VersionHistoryDrawer({ taskId, onClose, onRestored }) {
    const [versions, setVersions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [restoring, setRestoring] = useState(null);
    useEffect(() => {
        client.get(`/projects/estimates/${taskId}/versions`)
            .then(({ data }) => setVersions(data))
            .catch(() => setVersions([]))
            .finally(() => setLoading(false));
    }, [taskId]);
    async function restore(vid, num) {
        if (!confirm(`Восстановить версию ${num}?`))
            return;
        setRestoring(vid);
        try {
            await client.post(`/projects/estimates/${taskId}/versions/${vid}/restore`);
            onRestored();
            onClose();
        }
        catch {
            alert('Ошибка восстановления');
        }
        finally {
            setRestoring(null);
        }
    }
    return (_jsxs("div", { style: { position: 'fixed', top: 0, right: 0, bottom: 0, width: 400, background: '#fff', boxShadow: '-4px 0 16px rgba(0,0,0,0.15)', zIndex: 1000, display: 'flex', flexDirection: 'column' }, children: [_jsxs("div", { style: { padding: '14px 20px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsx("h3", { style: { margin: 0 }, children: "\u0418\u0441\u0442\u043E\u0440\u0438\u044F \u0432\u0435\u0440\u0441\u0438\u0439" }), _jsx("button", { onClick: onClose, style: closeBtn, children: "\u00D7" })] }), _jsx("div", { style: { flex: 1, overflowY: 'auto', padding: 16 }, children: loading ? _jsx("p", { style: { color: '#aaa' }, children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430..." })
                    : versions.length === 0 ? _jsx("p", { style: { color: '#aaa' }, children: "\u041D\u0435\u0442 \u0432\u0435\u0440\u0441\u0438\u0439" })
                        : versions.map((v) => (_jsxs("div", { style: { border: '1px solid #e0e0e0', borderRadius: 6, padding: 12, marginBottom: 10 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 }, children: [_jsxs("strong", { children: ["\u0412\u0435\u0440\u0441\u0438\u044F ", v.version_number] }), _jsx("span", { style: { fontSize: 12, color: '#888' }, children: new Date(v.created_at).toLocaleString('ru-RU') })] }), _jsxs("p", { style: { margin: '0 0 6px', fontSize: 13, color: '#666' }, children: [v.change_type, " \u2014 ", v.change_description] }), _jsx("button", { onClick: () => restore(v.id, v.version_number), disabled: restoring === v.id, style: { padding: '4px 12px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }, children: restoring === v.id ? 'Восстановление...' : 'Восстановить' })] }, v.id))) })] }));
}
const closeBtn = { border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: '#555' };
