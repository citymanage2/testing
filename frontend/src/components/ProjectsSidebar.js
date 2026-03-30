import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { C } from '../ui';
function fmt(v) { return v.toLocaleString('ru-RU', { maximumFractionDigits: 0 }); }
const TYPE_LABELS = {
    SMETA_FROM_PROJECT: 'Смета из проекта', SMETA_FROM_TZ: 'Смета из ТЗ', SMETA_FROM_LIST: 'Смета из перечня',
    SMETA_FROM_TZ_PROJECT: 'Смета ТЗ+проект', SMETA_FROM_EDC_PROJECT: 'Смета EDC', SMETA_FROM_GRAND_PROJECT: 'Grand-смета',
    LIST_FROM_TZ: 'Перечень из ТЗ', LIST_FROM_PROJECT: 'Перечень из проекта', LIST_FROM_TZ_PROJECT: 'Перечень ТЗ+проект',
    RESEARCH_PROJECT: 'Исследование', SCAN_TO_EXCEL: 'Скан→Excel', COMPARE_PROJECT_SMETA: 'Сравнение', IMPORT_EXCEL: 'Импорт Excel',
};
const STATUS_COLOR = { completed: C.success, failed: C.danger, processing: C.warning };
export default function ProjectsSidebar() {
    const [projects, setProjects] = useState([]);
    const [expanded, setExpanded] = useState(null);
    const [detail, setDetail] = useState(null);
    const [totals, setTotals] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [dragOver, setDragOver] = useState(null);
    const [noProjectTasks, setNoProjectTasks] = useState([]);
    const [showNoProject, setShowNoProject] = useState(true);
    const importRef = useRef(null);
    const [importProjectId, setImportProjectId] = useState(null);
    const navigate = useNavigate();
    async function load() {
        try {
            setProjects((await client.get('/projects')).data);
        }
        catch {
            setProjects([]);
        }
        try {
            setNoProjectTasks((await client.get('/tasks?no_project=true')).data);
        }
        catch {
            setNoProjectTasks([]);
        }
    }
    useEffect(() => { load(); }, []);
    async function handleDrop(projectId, e) {
        e.preventDefault();
        setDragOver(null);
        const taskId = e.dataTransfer.getData('text/plain');
        if (!taskId)
            return;
        try {
            await client.post(`/projects/${projectId}/estimates/${taskId}`);
            setNoProjectTasks(prev => prev.filter(t => t.id !== taskId));
            if (expanded === projectId)
                refreshDetail(projectId);
        }
        catch { }
    }
    async function refreshDetail(id) {
        setLoadingDetail(true);
        try {
            const [d, t] = await Promise.all([
                client.get(`/projects/${id}`),
                client.get(`/projects/${id}/totals`),
            ]);
            setDetail(d.data);
            setTotals(t.data);
        }
        catch {
            setDetail(null);
            setTotals(null);
        }
        finally {
            setLoadingDetail(false);
        }
    }
    async function toggleProject(id) {
        if (expanded === id) {
            setExpanded(null);
            setDetail(null);
            setTotals(null);
            return;
        }
        setExpanded(id);
        await refreshDetail(id);
    }
    async function handleImport(e) {
        const file = e.target.files?.[0];
        if (!file || !importProjectId)
            return;
        const fd = new FormData();
        fd.append('file', file);
        try {
            const { data } = await client.post(`/projects/${importProjectId}/import-estimate`, fd);
            navigate(`/task/${data.task_id}/estimate`);
            refreshDetail(importProjectId);
        }
        catch {
            alert('Ошибка импорта');
        }
        finally {
            if (importRef.current)
                importRef.current.value = '';
            setImportProjectId(null);
        }
    }
    async function addProject() {
        const n = prompt('Название проекта:');
        if (n?.trim()) {
            await client.post('/projects', { name: n.trim() });
            load();
        }
    }
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', height: '100%' }, children: [_jsx("div", { style: { padding: '12px 12px 8px', borderBottom: `1px solid ${C.border}` }, children: _jsxs("button", { onClick: addProject, style: {
                        width: '100%', padding: '7px 12px', background: C.primary, color: '#fff',
                        border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    }, children: [_jsx("span", { style: { fontSize: 16, lineHeight: 1 }, children: "+" }), " \u041D\u043E\u0432\u044B\u0439 \u043F\u0440\u043E\u0435\u043A\u0442"] }) }), _jsxs("div", { style: { flex: 1, overflowY: 'auto', padding: '8px' }, children: [_jsx(SideSection, { label: "\u0411\u0435\u0437 \u043F\u0440\u043E\u0435\u043A\u0442\u0430", count: noProjectTasks.length, open: showNoProject, onToggle: () => setShowNoProject(v => !v), accent: true, children: noProjectTasks.length === 0
                            ? _jsx(EmptyMsg, { children: "\u041D\u0435\u0442 \u0437\u0430\u0434\u0430\u0447" })
                            : noProjectTasks.map(t => (_jsx(TaskRow, { task: t, onNavigate: () => navigate(t.status === 'completed' ? `/task/${t.id}/estimate` : `/task/${t.id}/status`), draggable: true }, t.id))) }), projects.length === 0
                        ? _jsx(EmptyMsg, { children: "\u041D\u0435\u0442 \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u0432" })
                        : projects.map(p => (_jsxs("div", { style: { marginBottom: 2 }, children: [_jsxs("div", { onClick: () => toggleProject(p.id), onDragOver: e => { e.preventDefault(); setDragOver(p.id); }, onDragLeave: () => setDragOver(null), onDrop: e => handleDrop(p.id, e), style: {
                                        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px',
                                        borderRadius: 6, cursor: 'pointer', userSelect: 'none',
                                        background: dragOver === p.id ? C.primaryBg : expanded === p.id ? C.primaryBg : 'transparent',
                                        border: `1px solid ${dragOver === p.id || expanded === p.id ? C.primary + '33' : 'transparent'}`,
                                    }, children: [_jsx("span", { style: { fontSize: 10, color: expanded === p.id ? C.primary : C.textMuted, width: 10, textAlign: 'center', flexShrink: 0 }, children: expanded === p.id ? '▼' : '▶' }), _jsx("span", { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontSize: 13, fontWeight: 500, color: expanded === p.id ? C.primary : C.text }, children: p.name }), _jsx("span", { onClick: e => { e.stopPropagation(); navigate(`/projects/${p.id}`); }, title: "\u041A\u0430\u0440\u0442\u043E\u0447\u043A\u0430 \u043F\u0440\u043E\u0435\u043A\u0442\u0430", style: { fontSize: 14, color: C.textMuted, cursor: 'pointer', padding: '0 2px', flexShrink: 0, opacity: .7 }, children: "\u229E" })] }), expanded === p.id && (_jsx("div", { style: { paddingLeft: 14, paddingBottom: 4 }, children: loadingDetail
                                        ? _jsx(EmptyMsg, { children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430..." })
                                        : (_jsxs(_Fragment, { children: [totals && totals.tasks_count > 0 && (_jsxs("div", { style: { margin: '6px 0', padding: '8px 10px', background: C.primaryBg, borderRadius: 6, fontSize: 11, border: `1px solid ${C.primary}22` }, children: [_jsxs("div", { style: { fontWeight: 600, color: C.primary, marginBottom: 4 }, children: ["\u0418\u0442\u043E\u0433\u043E (", totals.tasks_count, " ", totals.tasks_count === 1 ? 'смета' : 'сметы', ")"] }), _jsxs("div", { style: { color: C.textSec }, children: ["\u0420\u0430\u0431\u043E\u0442\u044B: ", _jsxs("b", { children: [fmt(totals.total_work), " \u20BD"] })] }), _jsxs("div", { style: { color: C.textSec }, children: ["\u041C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u044B: ", _jsxs("b", { children: [fmt(totals.total_mat), " \u20BD"] })] }), _jsxs("div", { style: { color: C.text, fontWeight: 700, marginTop: 3 }, children: ["\u0421 \u041D\u0414\u0421: ", fmt(totals.total + totals.total_vat), " \u20BD"] })] })), _jsx("button", { onClick: () => { setImportProjectId(p.id); importRef.current?.click(); }, style: { display: 'flex', alignItems: 'center', gap: 5, width: '100%', padding: '5px 8px', margin: '4px 0', background: 'transparent', border: `1px dashed ${C.border}`, borderRadius: 5, cursor: 'pointer', fontSize: 12, color: C.textSec }, children: "\u2B06 \u0418\u043C\u043F\u043E\u0440\u0442 Excel" }), !detail || detail.tasks.length === 0
                                                    ? _jsx(EmptyMsg, { children: "\u041D\u0435\u0442 \u0441\u043C\u0435\u0442" })
                                                    : detail.tasks.map(t => (_jsx(TaskRow, { task: t, onNavigate: () => navigate(t.status === 'completed' ? `/task/${t.id}/estimate` : `/task/${t.id}/status`), onDelete: async () => { if (confirm('Удалить смету?')) {
                                                            await client.delete(`/tasks/${t.id}`);
                                                            refreshDetail(p.id);
                                                        } } }, t.id)))] })) }))] }, p.id)))] }), _jsx("input", { ref: importRef, type: "file", accept: ".xlsx", style: { display: 'none' }, onChange: handleImport })] }));
}
function SideSection({ label, count, open, onToggle, accent, children }) {
    return (_jsxs("div", { style: { marginBottom: 8 }, children: [_jsxs("div", { onClick: onToggle, style: {
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
                    borderRadius: 6, cursor: 'pointer', userSelect: 'none',
                    background: accent ? C.warningBg : C.surfaceAlt,
                    border: `1px solid ${accent ? C.warning + '40' : C.border}`,
                }, children: [_jsx("span", { style: { fontSize: 10, color: accent ? C.warning : C.textMuted }, children: open ? '▼' : '▶' }), _jsx("span", { style: { flex: 1, fontSize: 13, fontWeight: 600, color: accent ? C.warning : C.text }, children: label }), count > 0 && _jsx("span", { style: { fontSize: 11, padding: '1px 7px', borderRadius: 99, background: accent ? C.warning + '20' : C.border, color: accent ? C.warning : C.textSec, fontWeight: 600 }, children: count })] }), open && _jsx("div", { style: { paddingTop: 2 }, children: children })] }));
}
function TaskRow({ task: t, onNavigate, onDelete, draggable }) {
    return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 5, cursor: 'pointer', marginBottom: 1 }, draggable: draggable, onDragStart: draggable ? e => e.dataTransfer.setData('text/plain', t.id) : undefined, children: [draggable && _jsx("span", { style: { color: C.textMuted, fontSize: 10, cursor: 'grab' }, children: "\u283F" }), _jsxs("span", { onClick: onNavigate, style: { flex: 1, fontSize: 12, color: C.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: t.name || TYPE_LABELS[t.task_type], children: [t.name || TYPE_LABELS[t.task_type] || t.task_type, t.doc_type && _jsxs("span", { style: { marginLeft: 4, fontSize: 10, color: C.textMuted }, children: ["[", t.doc_type, "]"] })] }), _jsx("span", { style: { fontSize: 8, color: STATUS_COLOR[t.status] || C.textMuted, flexShrink: 0 }, children: "\u25CF" }), onDelete && (_jsx("button", { onClick: e => { e.stopPropagation(); onDelete(); }, style: { padding: '1px 5px', fontSize: 10, background: 'transparent', color: C.textMuted, border: 'none', borderRadius: 3, cursor: 'pointer', flexShrink: 0, opacity: 0 }, className: "del-btn", children: "\u2715" }))] }));
}
function EmptyMsg({ children }) {
    return _jsx("p", { style: { color: C.textMuted, fontSize: 12, margin: '4px 10px', fontStyle: 'italic' }, children: children });
}
