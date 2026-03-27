import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import FileUpload from '../components/FileUpload';
const TASK_TYPES = [
    { value: 'LIST_FROM_TZ', label: 'Перечень из ТЗ' },
    { value: 'LIST_FROM_TZ_PROJECT', label: 'Перечень из ТЗ + проект' },
    { value: 'LIST_FROM_PROJECT', label: 'Перечень из проекта' },
    { value: 'RESEARCH_PROJECT', label: 'Исследование проекта' },
    { value: 'SMETA_FROM_LIST', label: 'Смета из перечня' },
    { value: 'SMETA_FROM_TZ', label: 'Смета из ТЗ' },
    { value: 'SMETA_FROM_TZ_PROJECT', label: 'Смета из ТЗ + проект' },
    { value: 'SMETA_FROM_PROJECT', label: 'Смета из проекта' },
    { value: 'SMETA_FROM_EDC_PROJECT', label: 'Смета из EDC + проект' },
    { value: 'SMETA_FROM_GRAND_PROJECT', label: 'Смета из Grand CAD + проект' },
    { value: 'SCAN_TO_EXCEL', label: 'Скан → Excel' },
    { value: 'COMPARE_PROJECT_SMETA', label: 'Сравнение проекта со сметой' },
];
export default function TaskCreate() {
    const [taskType, setTaskType] = useState(TASK_TYPES[0].value);
    const [prompt, setPrompt] = useState('');
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const fd = new FormData();
            fd.append('task_type', taskType);
            if (prompt.trim())
                fd.append('prompt', prompt);
            files.forEach((f) => fd.append('files', f));
            const { data } = await client.post('/tasks', fd);
            navigate(`/task/${data.task_id}/status`);
        }
        catch {
            setError('Ошибка при создании задачи');
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsxs("div", { style: { maxWidth: 640, margin: '0 auto', padding: 24 }, children: [_jsx("h2", { style: { marginTop: 0 }, children: "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0437\u0430\u0434\u0430\u0447\u0443" }), _jsxs("form", { onSubmit: handleSubmit, style: { display: 'flex', flexDirection: 'column', gap: 16 }, children: [_jsxs("div", { children: [_jsx("label", { style: labelStyle, children: "\u0422\u0438\u043F \u0437\u0430\u0434\u0430\u0447\u0438" }), _jsx("select", { value: taskType, onChange: (e) => setTaskType(e.target.value), disabled: loading, style: { width: '100%', padding: '8px 12px', fontSize: 14, borderRadius: 4, border: '1px solid #ccc' }, children: TASK_TYPES.map((t) => _jsx("option", { value: t.value, children: t.label }, t.value)) })] }), _jsxs("div", { children: [_jsx("label", { style: labelStyle, children: "\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u0438\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u0438" }), _jsx("textarea", { value: prompt, onChange: (e) => setPrompt(e.target.value), disabled: loading, rows: 3, placeholder: "\u0420\u0435\u0433\u0438\u043E\u043D, \u043E\u0441\u043E\u0431\u044B\u0435 \u0443\u0441\u043B\u043E\u0432\u0438\u044F, \u0443\u0442\u043E\u0447\u043D\u0435\u043D\u0438\u044F...", style: { width: '100%', padding: '8px 12px', fontSize: 14, borderRadius: 4, border: '1px solid #ccc', resize: 'vertical', boxSizing: 'border-box' } })] }), _jsxs("div", { children: [_jsx("label", { style: labelStyle, children: "\u0424\u0430\u0439\u043B\u044B" }), _jsx(FileUpload, { files: files, onChange: setFiles })] }), error && _jsx("p", { style: { color: '#f44336', margin: 0 }, children: error }), _jsx("button", { type: "submit", disabled: loading, style: { padding: '10px', fontSize: 15, borderRadius: 4, border: 'none', background: loading ? '#bdbdbd' : '#1565c0', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600 }, children: loading ? 'Создание...' : 'Создать задачу' })] })] }));
}
const labelStyle = { display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 };
