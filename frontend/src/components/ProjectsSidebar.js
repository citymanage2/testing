import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
function fmt(v) { return v.toLocaleString('ru-RU', { maximumFractionDigits: 0 }); }
const TYPE_LABELS = {
    SMETA_FROM_PROJECT: 'Смета из проекта', SMETA_FROM_TZ: 'Смета из ТЗ', SMETA_FROM_LIST: 'Смета из перечня',
    SMETA_FROM_TZ_PROJECT: 'Смета ТЗ+проект', SMETA_FROM_EDC_PROJECT: 'Смета EDC', SMETA_FROM_GRAND_PROJECT: 'Grand-смета',
    LIST_FROM_TZ: 'Перечень из ТЗ', LIST_FROM_PROJECT: 'Перечень из проекта', LIST_FROM_TZ_PROJECT: 'Перечень ТЗ+проект',
    RESEARCH_PROJECT: 'Исследование', SCAN_TO_EXCEL: 'Скан→Excel', COMPARE_PROJECT_SMETA: 'Сравнение', IMPORT_EXCEL: 'Импорт Excel',
};
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
        catch { /* ignore */ }
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
    return (_jsxs("div", { style: { padding: '12px 8px' }, children: [_jsx("button", { onClick: async () => { const n = prompt('Название проекта:'); if (n?.trim()) {
                    await client.post('/projects', { name: n.trim() });
                    load();
                } }, style: newProjectBtn, children: "+ \u041D\u043E\u0432\u044B\u0439 \u043F\u0440\u043E\u0435\u043A\u0442" }), _jsxs("div", { style: { marginBottom: 8 }, children: [_jsxs("div", { onClick: () => setShowNoProject(v => !v), style: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 4, cursor: 'pointer', background: '#fff3e0', fontSize: 13, fontWeight: 600 }, children: [_jsx("span", { style: { fontSize: 10, color: '#e65100' }, children: showNoProject ? '▼' : '▶' }), _jsx("span", { style: { flex: 1, color: '#e65100' }, children: "\u0411\u0435\u0437 \u043F\u0440\u043E\u0435\u043A\u0442\u0430" }), _jsx("span", { style: { fontSize: 11, color: '#e65100', background: '#ffe0b2', borderRadius: 10, padding: '1px 7px' }, children: noProjectTasks.length })] }), showNoProject && (_jsx("div", { style: { paddingLeft: 12 }, children: noProjectTasks.length === 0
                            ? _jsx("p", { style: { color: '#aaa', fontSize: 12, margin: '4px 8px' }, children: "\u041F\u0443\u0441\u0442\u043E" })
                            : noProjectTasks.map(t => (_jsxs("div", { draggable: true, onDragStart: e => e.dataTransfer.setData('text/plain', t.id), onClick: () => navigate(t.status === 'completed' ? `/task/${t.id}/estimate` : `/task/${t.id}/status`), style: { padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12, color: '#1565c0', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }, title: "\u041F\u0435\u0440\u0435\u0442\u0430\u0449\u0438\u0442\u0435 \u0432 \u043F\u0440\u043E\u0435\u043A\u0442", children: [_jsx("span", { style: { color: '#bbb', fontSize: 10 }, children: "\u283F" }), _jsx("span", { style: { flex: 1 }, children: t.name || TYPE_LABELS[t.task_type] || t.task_type }), _jsx("span", { style: { fontSize: 10, color: t.status === 'completed' ? '#4caf50' : t.status === 'failed' ? '#f44336' : '#ff9800' }, children: "\u25CF" })] }, t.id))) }))] }), projects.length === 0 && _jsx("p", { style: { color: '#aaa', fontSize: 13, textAlign: 'center' }, children: "\u041D\u0435\u0442 \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u0432" }), projects.map(p => (_jsxs("div", { style: { marginBottom: 4 }, children: [_jsxs("div", { onClick: () => toggleProject(p.id), onDragOver: e => { e.preventDefault(); setDragOver(p.id); }, onDragLeave: () => setDragOver(null), onDrop: e => handleDrop(p.id, e), style: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 4, cursor: 'pointer', background: dragOver === p.id ? '#bbdefb' : expanded === p.id ? '#e3f2fd' : 'transparent', fontSize: 13, fontWeight: 500 }, children: [_jsx("span", { style: { fontSize: 10, color: '#999' }, children: expanded === p.id ? '▼' : '▶' }), _jsx("span", { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }, children: p.name })] }), expanded === p.id && (_jsx("div", { style: { paddingLeft: 12 }, children: loadingDetail ? _jsx("p", { style: { color: '#aaa', fontSize: 12, margin: '4px 8px' }, children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430..." }) : (_jsxs(_Fragment, { children: [totals && totals.tasks_count > 0 && (_jsxs("div", { style: { margin: '6px 8px', padding: '8px', background: '#f0f4ff', borderRadius: 4, fontSize: 11 }, children: [_jsxs("div", { style: { fontWeight: 600, marginBottom: 4 }, children: ["\u0418\u0442\u043E\u0433\u043E \u043F\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0443 (", totals.tasks_count, " \u0441\u043C\u0435\u0442", totals.tasks_count > 1 ? 'ы' : 'а', "):"] }), _jsxs("div", { children: ["\u0420\u0430\u0431\u043E\u0442\u044B: ", fmt(totals.total_work), " \u20BD"] }), _jsxs("div", { children: ["\u041C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u044B: ", fmt(totals.total_mat), " \u20BD"] }), _jsxs("div", { children: ["\u041D\u0414\u0421: ", fmt(totals.total_vat), " \u20BD"] }), _jsxs("div", { style: { fontWeight: 700, marginTop: 2 }, children: ["\u0418\u0422\u041E\u0413\u041E: ", fmt(totals.total + totals.total_vat), " \u20BD"] })] })), _jsx("button", { onClick: () => { setImportProjectId(p.id); importRef.current?.click(); }, style: { width: '100%', padding: '4px 8px', margin: '4px 0', background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 4, cursor: 'pointer', fontSize: 12, color: '#2e7d32' }, children: "\u2B06 \u0418\u043C\u043F\u043E\u0440\u0442 Excel" }), !detail || detail.tasks.length === 0
                                    ? _jsx("p", { style: { color: '#aaa', fontSize: 12, margin: '4px 8px' }, children: "\u041D\u0435\u0442 \u0441\u043C\u0435\u0442" })
                                    : detail.tasks.map(t => (_jsxs("div", { style: { padding: '3px 8px', borderRadius: 4, fontSize: 12, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }, children: [_jsxs("span", { onClick: () => navigate(t.status === 'completed' ? `/task/${t.id}/estimate` : `/task/${t.id}/status`), style: { flex: 1, cursor: 'pointer', color: '#1565c0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: [t.name || TYPE_LABELS[t.task_type] || t.task_type, t.doc_type && _jsxs("span", { style: { marginLeft: 4, fontSize: 10, color: '#888' }, children: ["[", t.doc_type, "]"] })] }), _jsx("span", { style: { fontSize: 10, color: t.status === 'completed' ? '#4caf50' : t.status === 'failed' ? '#f44336' : '#ff9800' }, children: "\u25CF" }), _jsx("button", { onClick: async (e) => { e.stopPropagation(); if (confirm('Удалить смету?')) {
                                                    await client.delete(`/tasks/${t.id}`);
                                                    refreshDetail(p.id);
                                                } }, style: { padding: '1px 5px', fontSize: 10, background: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a', borderRadius: 3, cursor: 'pointer' }, children: "\u2715" })] }, t.id)))] })) }))] }, p.id))), _jsx("input", { ref: importRef, type: "file", accept: ".xlsx", style: { display: 'none' }, onChange: handleImport })] }));
}
const newProjectBtn = { width: '100%', padding: '7px 12px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, marginBottom: 12 };
