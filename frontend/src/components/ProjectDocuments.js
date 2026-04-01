import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import client from '../api/client';
import { C, CARD, INPUT, LBL, MODAL, OVERLAY, TD, TH, badge, btnDanger, btnGhost, btnOutline, btnPrimary, } from '../ui';
const CATEGORIES = {
    tz: 'Техническое задание',
    design: 'Проектная документация',
    incoming_estimate: 'Входящая смета',
    tu: 'Технические условия',
    other: 'Прочее',
};
const STATUSES = {
    received: 'Получен',
    pending: 'Ожидается',
    not_required: 'Не требуется',
};
function statusBadge(s) {
    if (s === 'received')
        return _jsx("span", { style: badge(C.success, C.successBg), children: STATUSES[s] });
    if (s === 'pending')
        return _jsx("span", { style: badge(C.warning, C.warningBg), children: STATUSES[s] });
    return _jsx("span", { style: badge(C.textMuted, '#f1f5f9'), children: STATUSES['not_required'] });
}
function categoryBadge(cat) {
    return (_jsx("span", { style: badge(C.primary, C.primaryBg), children: CATEGORIES[cat] ?? cat }));
}
function fmt(d) {
    return d ? new Date(d).toLocaleDateString('ru-RU') : '—';
}
export default function ProjectDocuments({ projectId }) {
    const [docs, setDocs] = useState([]);
    const [filterCat, setFilterCat] = useState('all');
    const [loading, setLoading] = useState(false);
    // upload form
    const [showUpload, setShowUpload] = useState(false);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadCat, setUploadCat] = useState('tz');
    const [uploadComment, setUploadComment] = useState('');
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef(null);
    // edit modal
    const [editState, setEditState] = useState(null);
    const [saving, setSaving] = useState(false);
    const load = () => {
        setLoading(true);
        client.get(`/projects/${projectId}/documents`)
            .then(r => setDocs(r.data))
            .finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, [projectId]);
    const filtered = filterCat === 'all' ? docs : docs.filter(d => d.category === filterCat);
    const handleUpload = async () => {
        if (!uploadFile)
            return;
        setUploading(true);
        const fd = new FormData();
        fd.append('file', uploadFile);
        fd.append('category', uploadCat);
        fd.append('comment', uploadComment);
        try {
            await client.post(`/projects/${projectId}/documents`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setShowUpload(false);
            setUploadFile(null);
            setUploadComment('');
            load();
        }
        finally {
            setUploading(false);
        }
    };
    const handleDownload = async (doc) => {
        const r = await client.get(`/projects/${projectId}/documents/${doc.id}/download`, { responseType: 'blob' });
        const url = URL.createObjectURL(r.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.file_name;
        a.click();
        URL.revokeObjectURL(url);
    };
    const handleDelete = async (id) => {
        if (!confirm('Удалить документ?'))
            return;
        await client.delete(`/projects/${projectId}/documents/${id}`);
        load();
    };
    const handleSaveEdit = async () => {
        if (!editState)
            return;
        setSaving(true);
        try {
            await client.patch(`/projects/${projectId}/documents/${editState.docId}`, {
                status: editState.status,
                comment: editState.comment,
            });
            setEditState(null);
            load();
        }
        finally {
            setSaving(false);
        }
    };
    const segBtnStyle = (active) => ({
        ...btnOutline('sm'),
        background: active ? C.primary : C.surface,
        color: active ? '#fff' : C.text,
        border: `1px solid ${active ? C.primary : C.border}`,
    });
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 16 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }, children: [_jsxs("div", { style: { display: 'flex', gap: 2, flexWrap: 'wrap' }, children: [_jsx("button", { style: segBtnStyle(filterCat === 'all'), onClick: () => setFilterCat('all'), children: "\u0412\u0441\u0435" }), Object.entries(CATEGORIES).map(([k, v]) => (_jsx("button", { style: segBtnStyle(filterCat === k), onClick: () => setFilterCat(k), children: v }, k)))] }), _jsx("button", { style: { ...btnPrimary('sm'), marginLeft: 'auto' }, onClick: () => setShowUpload(true), children: "+ \u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C" })] }), _jsx("div", { style: { ...CARD, padding: 0, overflowX: 'auto' }, children: loading ? (_jsx("div", { style: { padding: 24, textAlign: 'center', color: C.textMuted }, children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430..." })) : filtered.length === 0 ? (_jsx("div", { style: { padding: 24, textAlign: 'center', color: C.textMuted }, children: "\u041D\u0435\u0442 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u043E\u0432" })) : (_jsxs("table", { style: { width: '100%', borderCollapse: 'collapse' }, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: TH, children: "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F" }), _jsx("th", { style: TH, children: "\u0424\u0430\u0439\u043B" }), _jsx("th", { style: TH, children: "\u0412\u0435\u0440\u0441\u0438\u044F" }), _jsx("th", { style: TH, children: "\u0421\u0442\u0430\u0442\u0443\u0441" }), _jsx("th", { style: TH, children: "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439" }), _jsx("th", { style: TH, children: "\u0414\u0430\u0442\u0430" }), _jsx("th", { style: TH })] }) }), _jsx("tbody", { children: filtered.map(doc => (_jsxs("tr", { children: [_jsx("td", { style: TD, children: categoryBadge(doc.category) }), _jsx("td", { style: { ...TD, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: doc.file_name }), _jsxs("td", { style: TD, children: ["v", doc.version ?? 1] }), _jsx("td", { style: TD, children: statusBadge(doc.status) }), _jsx("td", { style: { ...TD, maxWidth: 180, color: C.textSec, fontSize: 12 }, children: doc.comment || '—' }), _jsx("td", { style: TD, children: fmt(doc.uploaded_at) }), _jsxs("td", { style: { ...TD, whiteSpace: 'nowrap' }, children: [_jsx("button", { style: btnGhost('sm'), onClick: () => handleDownload(doc), title: "\u0421\u043A\u0430\u0447\u0430\u0442\u044C", children: "\u2B07" }), _jsx("button", { style: btnGhost('sm'), onClick: () => setEditState({ docId: doc.id, status: doc.status, comment: doc.comment ?? '' }), title: "\u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C", children: "\u270F\uFE0F" }), _jsx("button", { style: btnDanger('sm'), onClick: () => handleDelete(doc.id), title: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C", children: "\u2715" })] })] }, doc.id))) })] })) }), showUpload && (_jsx("div", { style: OVERLAY, onClick: e => { if (e.target === e.currentTarget)
                    setShowUpload(false); }, children: _jsxs("div", { style: MODAL, children: [_jsx("h3", { style: { margin: '0 0 16px', fontSize: 16, fontWeight: 600 }, children: "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442" }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 12 }, children: [_jsxs("label", { style: LBL, children: ["\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F", _jsx("select", { style: INPUT, value: uploadCat, onChange: e => setUploadCat(e.target.value), children: Object.entries(CATEGORIES).map(([k, v]) => _jsx("option", { value: k, children: v }, k)) })] }), _jsxs("label", { style: LBL, children: ["\u0424\u0430\u0439\u043B", _jsx("input", { ref: fileRef, type: "file", style: INPUT, onChange: e => setUploadFile(e.target.files?.[0] ?? null) })] }), _jsxs("label", { style: LBL, children: ["\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439", _jsx("textarea", { style: { ...INPUT, resize: 'vertical', minHeight: 60 }, value: uploadComment, onChange: e => setUploadComment(e.target.value), placeholder: "\u041D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E" })] })] }), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }, children: [_jsx("button", { style: btnOutline(), onClick: () => setShowUpload(false), children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { style: btnPrimary(), onClick: handleUpload, disabled: !uploadFile || uploading, children: uploading ? 'Загрузка...' : 'Загрузить' })] })] }) })), editState && (_jsx("div", { style: OVERLAY, onClick: e => { if (e.target === e.currentTarget)
                    setEditState(null); }, children: _jsxs("div", { style: { ...MODAL, maxWidth: 400 }, children: [_jsx("h3", { style: { margin: '0 0 16px', fontSize: 16, fontWeight: 600 }, children: "\u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442" }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 12 }, children: [_jsxs("label", { style: LBL, children: ["\u0421\u0442\u0430\u0442\u0443\u0441", _jsx("select", { style: INPUT, value: editState.status, onChange: e => setEditState(s => s && ({ ...s, status: e.target.value })), children: Object.entries(STATUSES).map(([k, v]) => _jsx("option", { value: k, children: v }, k)) })] }), _jsxs("label", { style: LBL, children: ["\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439", _jsx("textarea", { style: { ...INPUT, resize: 'vertical', minHeight: 60 }, value: editState.comment, onChange: e => setEditState(s => s && ({ ...s, comment: e.target.value })) })] })] }), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }, children: [_jsx("button", { style: btnOutline(), onClick: () => setEditState(null), children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { style: btnPrimary(), onClick: handleSaveEdit, disabled: saving, children: saving ? 'Сохранение...' : 'Сохранить' })] })] }) }))] }));
}
