import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import client from '../api/client';
import { C, btnPrimary, btnOutline, btnDanger, btnGhost, badge, INPUT, LBL, CARD, TH, TD, OVERLAY, MODAL } from '../ui';
const STATUS_LABELS = {
    open: 'Открыта',
    in_progress: 'В работе',
    resolved: 'Решена',
};
function statusBadge(s) {
    if (s === 'open')
        return _jsx("span", { style: badge('#d97706', '#fffbeb'), children: STATUS_LABELS[s] });
    if (s === 'in_progress')
        return _jsx("span", { style: badge(C.primary, C.primaryBg), children: STATUS_LABELS[s] });
    if (s === 'resolved')
        return _jsx("span", { style: badge(C.success, C.successBg), children: STATUS_LABELS[s] });
    return _jsx("span", { style: badge(C.textMuted, '#f1f5f9'), children: s });
}
const STATUS_NEXT = {
    open: 'in_progress',
    in_progress: 'resolved',
};
const emptyForm = () => ({
    title: '',
    description: '',
    claimed_at: '',
    deadline: '',
    assigned_to: '',
});
export default function WarrantyClaims({ projectId }) {
    const [claims, setClaims] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modal, setModal] = useState(null);
    const [form, setForm] = useState(emptyForm());
    const [saving, setSaving] = useState(false);
    const load = async () => {
        setLoading(true);
        try {
            const r = await client.get(`/projects/${projectId}/warranty-claims`);
            setClaims(r.data);
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => { load(); }, [projectId]);
    const openNew = () => {
        setForm(emptyForm());
        setModal('new');
    };
    const openEdit = (c) => {
        setForm({
            title: c.title,
            description: c.description || '',
            claimed_at: c.claimed_at || '',
            deadline: c.deadline || '',
            assigned_to: c.assigned_to || '',
        });
        setModal(c);
    };
    const save = async () => {
        setSaving(true);
        try {
            const payload = {
                title: form.title,
                description: form.description || undefined,
                claimed_at: form.claimed_at || undefined,
                deadline: form.deadline || undefined,
                assigned_to: form.assigned_to || undefined,
            };
            if (modal === 'new') {
                await client.post(`/projects/${projectId}/warranty-claims`, payload);
            }
            else if (modal) {
                await client.patch(`/projects/${projectId}/warranty-claims/${modal.id}`, payload);
            }
            setModal(null);
            load();
        }
        finally {
            setSaving(false);
        }
    };
    const deleteClaim = async (id) => {
        if (!confirm('Удалить претензию?'))
            return;
        await client.delete(`/projects/${projectId}/warranty-claims/${id}`);
        load();
    };
    const changeStatus = async (id, newStatus) => {
        await client.patch(`/projects/${projectId}/warranty-claims/${id}`, { status: newStatus });
        load();
    };
    const fld = (field, val) => setForm(f => ({ ...f, [field]: val }));
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 12 }, children: [_jsx("div", { style: { display: 'flex', justifyContent: 'flex-end' }, children: _jsx("button", { style: btnPrimary('sm'), onClick: openNew, children: "+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043F\u0440\u0435\u0442\u0435\u043D\u0437\u0438\u044E" }) }), loading ? (_jsx("div", { style: { padding: 24, textAlign: 'center', color: C.textMuted }, children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430..." })) : claims.length === 0 ? (_jsx("div", { style: { ...CARD, padding: 40, textAlign: 'center', color: C.textMuted }, children: "\u041D\u0435\u0442 \u0433\u0430\u0440\u0430\u043D\u0442\u0438\u0439\u043D\u044B\u0445 \u043F\u0440\u0435\u0442\u0435\u043D\u0437\u0438\u0439" })) : (_jsx("div", { style: { borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }, children: _jsxs("table", { style: { width: '100%', borderCollapse: 'collapse', fontSize: 13 }, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: TH, children: "\u0417\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A" }), _jsx("th", { style: TH, children: "\u0421\u0442\u0430\u0442\u0443\u0441" }), _jsx("th", { style: TH, children: "\u0421\u0440\u043E\u043A \u0443\u0441\u0442\u0440\u0430\u043D\u0435\u043D\u0438\u044F" }), _jsx("th", { style: TH, children: "\u041E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0439" }), _jsx("th", { style: TH, children: "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044F" })] }) }), _jsx("tbody", { children: claims.map(c => (_jsxs("tr", { style: c.is_overdue ? { borderLeft: `3px solid ${C.danger}` } : undefined, children: [_jsxs("td", { style: TD, children: [_jsx("div", { style: { fontWeight: 500 }, children: c.title }), c.description && (_jsx("div", { style: { fontSize: 11, color: C.textSec, marginTop: 2 }, children: c.description }))] }), _jsx("td", { style: TD, children: statusBadge(c.status) }), _jsx("td", { style: { ...TD, color: c.is_overdue ? C.danger : 'inherit' }, children: c.deadline || '—' }), _jsx("td", { style: TD, children: c.assigned_to || '—' }), _jsx("td", { style: TD, children: _jsxs("div", { style: { display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }, children: [STATUS_NEXT[c.status] && (_jsxs("button", { style: btnGhost('sm'), onClick: () => changeStatus(c.id, STATUS_NEXT[c.status]), children: ["\u2192 ", STATUS_LABELS[STATUS_NEXT[c.status]]] })), _jsx("button", { style: btnOutline('sm'), onClick: () => openEdit(c), children: "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C" }), _jsx("button", { style: btnDanger('sm'), onClick: () => deleteClaim(c.id), children: "\u2715" })] }) })] }, c.id))) })] }) })), modal !== null && (_jsx("div", { style: OVERLAY, onClick: e => { if (e.target === e.currentTarget)
                    setModal(null); }, children: _jsxs("div", { style: { ...MODAL, maxWidth: 480 }, children: [_jsx("h3", { style: { margin: '0 0 16px', fontSize: 16, fontWeight: 600 }, children: modal === 'new' ? 'Добавить претензию' : 'Редактировать претензию' }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 12 }, children: [_jsxs("label", { style: LBL, children: ["\u0417\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A *", _jsx("input", { style: INPUT, value: form.title, onChange: e => fld('title', e.target.value), placeholder: "\u041A\u0440\u0430\u0442\u043A\u043E\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u044B" })] }), _jsxs("label", { style: LBL, children: ["\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435", _jsx("textarea", { style: { ...INPUT, marginTop: 4, resize: 'vertical' }, rows: 3, value: form.description, onChange: e => fld('description', e.target.value) })] }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }, children: [_jsxs("label", { style: LBL, children: ["\u0414\u0430\u0442\u0430 \u043F\u0440\u0435\u0442\u0435\u043D\u0437\u0438\u0438", _jsx("input", { style: INPUT, type: "date", value: form.claimed_at, onChange: e => fld('claimed_at', e.target.value) })] }), _jsxs("label", { style: LBL, children: ["\u0421\u0440\u043E\u043A \u0443\u0441\u0442\u0440\u0430\u043D\u0435\u043D\u0438\u044F", _jsx("input", { style: INPUT, type: "date", value: form.deadline, onChange: e => fld('deadline', e.target.value) })] })] }), _jsxs("label", { style: LBL, children: ["\u041E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0439", _jsx("input", { style: INPUT, value: form.assigned_to, onChange: e => fld('assigned_to', e.target.value), placeholder: "\u0424\u0418\u041E \u0438\u043B\u0438 \u0434\u043E\u043B\u0436\u043D\u043E\u0441\u0442\u044C" })] })] }), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }, children: [_jsx("button", { style: btnOutline(), onClick: () => setModal(null), children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { style: btnPrimary(), onClick: save, disabled: saving || !form.title.trim(), children: saving ? 'Сохранение...' : 'Сохранить' })] })] }) }))] }));
}
