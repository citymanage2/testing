import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../api/client';
import StatusBadge from '../components/StatusBadge';
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
export default function TaskStatus() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [task, setTask] = useState(null);
    const [results, setResults] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [sending, setSending] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [copied, setCopied] = useState(false);
    const intervalRef = useRef(null);
    useEffect(() => {
        if (!id)
            return;
        const poll = async () => {
            try {
                const { data } = await client.get(`/tasks/${id}/status`);
                setTask(data);
                if (['completed', 'failed', 'cancelled'].includes(data.status)) {
                    if (intervalRef.current)
                        clearInterval(intervalRef.current);
                    if (data.status === 'completed') {
                        const { data: r } = await client.get(`/tasks/${id}/results`);
                        setResults(r);
                    }
                }
            }
            catch { /* ignore */ }
        };
        poll();
        intervalRef.current = setInterval(poll, 3000);
        return () => { if (intervalRef.current)
            clearInterval(intervalRef.current); };
    }, [id]);
    async function sendMessage() {
        if (!id || !chatInput.trim())
            return;
        setSending(true);
        try {
            await client.post(`/tasks/${id}/message`, { content: chatInput });
            setChatInput('');
        }
        catch { /* ignore */ }
        finally {
            setSending(false);
        }
    }
    function buildLog() {
        if (!task)
            return '';
        const lines = [`Задача: ${task.id}`, `Тип: ${task.task_type}`, `Статус: ${task.status}`, `Создана: ${new Date(task.created_at).toLocaleString('ru-RU')}`];
        if (task.error_message)
            lines.push(`Ошибка: ${task.error_message}`);
        const msgs = task.messages ?? [];
        if (msgs.length) {
            lines.push('', '--- Сообщения ---');
            msgs.forEach((m) => lines.push(`[${m.role === 'user' ? 'Вы' : 'AI'}] ${m.content}`));
        }
        return lines.join('\n');
    }
    function downloadLog() {
        const blob = new Blob([buildLog()], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `task-${id}-log.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }
    async function copyLog() {
        await navigator.clipboard.writeText(buildLog());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
    if (!task)
        return _jsx("div", { style: { padding: 24 }, children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430..." });
    const isActive = ['pending', 'processing'].includes(task.status);
    return (_jsxs("div", { style: { maxWidth: 800, margin: '0 auto', padding: 24 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }, children: [_jsxs("h2", { style: { margin: 0 }, children: ["\u0417\u0430\u0434\u0430\u0447\u0430 ", task.id.slice(0, 8), "\u2026"] }), _jsx(StatusBadge, { status: task.status })] }), _jsxs("p", { style: { margin: '0 0 4px', color: '#555' }, children: [_jsx("strong", { children: "\u0422\u0438\u043F:" }), " ", task.task_type] }), _jsxs("p", { style: { margin: '0 0 16px', color: '#555' }, children: [_jsx("strong", { children: "\u0421\u043E\u0437\u0434\u0430\u043D\u0430:" }), " ", new Date(task.created_at).toLocaleString('ru-RU')] }), task.error_message && _jsxs("p", { style: { color: '#f44336' }, children: [_jsx("strong", { children: "\u041E\u0448\u0438\u0431\u043A\u0430:" }), " ", task.error_message] }), _jsxs("div", { style: { display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }, children: [task.status === 'completed' && task.estimate_status !== null && (_jsx("button", { onClick: () => navigate(`/task/${id}/estimate`), style: btn('#4caf50'), children: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0441\u043C\u0435\u0442\u0443" })), isActive && (_jsx("button", { onClick: async () => { setCancelling(true); try {
                            await client.post(`/tasks/${id}/cancel`);
                        }
                        catch { /**/ }
                        finally {
                            setCancelling(false);
                        } }, disabled: cancelling, style: btn('#f44336'), children: cancelling ? 'Отмена...' : 'Отменить' }))] }), results.length > 0 && (_jsxs("div", { style: { marginBottom: 24 }, children: [_jsx("h3", { style: { marginTop: 0 }, children: "\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B" }), results.map((f) => (_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: 4, background: '#fafafa', marginBottom: 6 }, children: [_jsx("span", { children: f.file_name }), _jsx("a", { href: `${API_BASE}/results/${f.id}/download`, target: "_blank", rel: "noreferrer", style: { padding: '4px 12px', background: '#1565c0', color: '#fff', borderRadius: 4, textDecoration: 'none', fontSize: 13 }, children: "\u0421\u043A\u0430\u0447\u0430\u0442\u044C" })] }, f.id)))] })), _jsxs("div", { children: [_jsx("h3", { style: { marginTop: 0 }, children: "\u0427\u0430\u0442" }), _jsx("div", { style: { border: '1px solid #e0e0e0', borderRadius: 4, minHeight: 140, maxHeight: 300, overflowY: 'auto', padding: 12, background: '#fafafa', marginBottom: 8 }, children: (task.messages ?? []).length === 0 ? _jsx("p", { style: { color: '#aaa', margin: 0 }, children: "\u041D\u0435\u0442 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439" })
                            : (task.messages ?? []).map((m, i) => (_jsxs("div", { style: { marginBottom: 8 }, children: [_jsxs("span", { style: { fontWeight: 600, color: m.role === 'user' ? '#1565c0' : '#555', marginRight: 8 }, children: [m.role === 'user' ? 'Вы' : 'AI', ":"] }), _jsx("span", { children: m.content })] }, i))) }), _jsxs("div", { style: { display: 'flex', gap: 8 }, children: [_jsx("input", { value: chatInput, onChange: (e) => setChatInput(e.target.value), onKeyDown: (e) => e.key === 'Enter' && sendMessage(), placeholder: "\u0423\u0442\u043E\u0447\u043D\u0438\u0442\u0435 \u0441\u043C\u0435\u0442\u0443...", disabled: sending, style: { flex: 1, padding: '8px 12px', fontSize: 14, borderRadius: 4, border: '1px solid #ccc' } }), _jsx("button", { onClick: sendMessage, disabled: sending || !chatInput.trim(), style: btn('#1565c0'), children: sending ? '...' : 'Отправить' })] })] }), _jsxs("div", { style: { marginTop: 24, paddingTop: 16, borderTop: '1px solid #e0e0e0', display: 'flex', gap: 8, alignItems: 'center' }, children: [_jsx("span", { style: { fontSize: 13, color: '#888' }, children: "\u041B\u043E\u0433\u0438:" }), _jsx("button", { onClick: downloadLog, style: btn('#546e7a'), children: "\u0421\u043A\u0430\u0447\u0430\u0442\u044C .txt" }), _jsx("button", { onClick: copyLog, style: btn(copied ? '#4caf50' : '#78909c'), children: copied ? 'Скопировано!' : 'Копировать' })] })] }));
}
function btn(bg) {
    return { padding: '7px 14px', background: bg, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 500 };
}
