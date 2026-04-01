import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import client from '../api/client';
import { C, btnPrimary, btnOutline, btnDanger, INPUT, LBL, CARD, TH, TD, OVERLAY, MODAL } from '../ui';
const STATUS_LABELS = {
    pending: 'Ожидается',
    received: 'Получено',
    accepted: 'Принято',
    rejected: 'Отклонено',
};
const emptyForm = () => ({
    item_name: '',
    unit: '',
    quantity: '1',
    unit_price: '0',
    supplier_id: '',
    notes: '',
});
function fmt(n) {
    return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export default function KpRequests({ projectId }) {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modal, setModal] = useState(null);
    const [form, setForm] = useState(emptyForm());
    const [saving, setSaving] = useState(false);
    const load = async () => {
        setLoading(true);
        try {
            const r = await client.get(`/projects/${projectId}/kp-requests`);
            setRequests(r.data);
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
    const openEdit = (req) => {
        setForm({
            item_name: req.item_name,
            unit: req.unit || '',
            quantity: String(req.quantity),
            unit_price: String(req.unit_price),
            supplier_id: req.supplier_id || '',
            notes: req.notes || '',
        });
        setModal(req);
    };
    const computedTotal = () => {
        const qty = parseFloat(form.quantity) || 0;
        const price = parseFloat(form.unit_price) || 0;
        return qty * price;
    };
    const save = async () => {
        setSaving(true);
        try {
            const payload = {
                item_name: form.item_name,
                unit: form.unit || undefined,
                quantity: parseFloat(form.quantity) || 0,
                unit_price: parseFloat(form.unit_price) || 0,
                total: computedTotal(),
                supplier_id: form.supplier_id || undefined,
                notes: form.notes || undefined,
            };
            if (modal === 'new') {
                await client.post(`/projects/${projectId}/kp-requests`, payload);
            }
            else if (modal) {
                await client.patch(`/projects/${projectId}/kp-requests/${modal.id}`, payload);
            }
            setModal(null);
            load();
        }
        finally {
            setSaving(false);
        }
    };
    const deleteRequest = async (id) => {
        if (!confirm('Удалить запрос КП?'))
            return;
        await client.delete(`/projects/${projectId}/kp-requests/${id}`);
        load();
    };
    const changeStatus = async (id, newStatus) => {
        await client.patch(`/projects/${projectId}/kp-requests/${id}`, { status: newStatus });
        load();
    };
    const fld = (field, val) => setForm(f => ({ ...f, [field]: val }));
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 12 }, children: [_jsx("div", { style: { display: 'flex', justifyContent: 'flex-end' }, children: _jsx("button", { style: btnPrimary('sm'), onClick: openNew, children: "+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u041A\u041F" }) }), loading ? (_jsx("div", { style: { padding: 24, textAlign: 'center', color: C.textMuted }, children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430..." })) : requests.length === 0 ? (_jsx("div", { style: { ...CARD, padding: 40, textAlign: 'center', color: C.textMuted }, children: "\u041D\u0435\u0442 \u0437\u0430\u043F\u0440\u043E\u0441\u043E\u0432 \u041A\u041F" })) : (_jsx("div", { style: { borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }, children: _jsxs("table", { style: { width: '100%', borderCollapse: 'collapse', fontSize: 13 }, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: TH, children: "\u041F\u043E\u0437\u0438\u0446\u0438\u044F" }), _jsx("th", { style: TH, children: "\u0415\u0434.\u0438\u0437\u043C" }), _jsx("th", { style: TH, children: "\u041A\u043E\u043B-\u0432\u043E" }), _jsx("th", { style: TH, children: "\u041F\u043E\u0441\u0442\u0430\u0432\u0449\u0438\u043A" }), _jsx("th", { style: TH, children: "\u0426\u0435\u043D\u0430 \u0437\u0430 \u0435\u0434." }), _jsx("th", { style: TH, children: "\u0421\u0443\u043C\u043C\u0430" }), _jsx("th", { style: TH, children: "\u0421\u0442\u0430\u0442\u0443\u0441" }), _jsx("th", { style: TH, children: "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044F" })] }) }), _jsx("tbody", { children: requests.map(req => (_jsxs("tr", { children: [_jsxs("td", { style: TD, children: [_jsx("div", { style: { fontWeight: 500 }, children: req.item_name }), req.notes && (_jsx("div", { style: { fontSize: 11, color: C.textSec, marginTop: 2 }, children: req.notes }))] }), _jsx("td", { style: TD, children: req.unit || '—' }), _jsx("td", { style: TD, children: req.quantity }), _jsx("td", { style: TD, children: req.supplier_name || req.supplier_id || '—' }), _jsxs("td", { style: TD, children: [fmt(req.unit_price), " \u20BD"] }), _jsxs("td", { style: { ...TD, fontWeight: 600 }, children: [fmt(req.total), " \u20BD"] }), _jsx("td", { style: TD, children: _jsx("select", { value: req.status, onChange: e => changeStatus(req.id, e.target.value), style: { ...INPUT, fontSize: 12, padding: '2px 6px', width: 'auto' }, children: Object.entries(STATUS_LABELS).map(([val, lbl]) => (_jsx("option", { value: val, children: lbl }, val))) }) }), _jsx("td", { style: TD, children: _jsxs("div", { style: { display: 'flex', gap: 4 }, children: [_jsx("button", { style: btnOutline('sm'), onClick: () => openEdit(req), children: "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C" }), _jsx("button", { style: btnDanger('sm'), onClick: () => deleteRequest(req.id), children: "\u2715" })] }) })] }, req.id))) })] }) })), modal !== null && (_jsx("div", { style: OVERLAY, onClick: e => { if (e.target === e.currentTarget)
                    setModal(null); }, children: _jsxs("div", { style: { ...MODAL, maxWidth: 480 }, children: [_jsx("h3", { style: { margin: '0 0 16px', fontSize: 16, fontWeight: 600 }, children: modal === 'new' ? 'Добавить запрос КП' : 'Редактировать запрос КП' }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 12 }, children: [_jsxs("label", { style: LBL, children: ["\u041D\u0430\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u0435 \u043F\u043E\u0437\u0438\u0446\u0438\u0438 *", _jsx("input", { style: INPUT, value: form.item_name, onChange: e => fld('item_name', e.target.value), placeholder: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u0430 \u0438\u043B\u0438 \u043F\u043E\u0437\u0438\u0446\u0438\u0438" })] }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }, children: [_jsxs("label", { style: LBL, children: ["\u0415\u0434\u0438\u043D\u0438\u0446\u0430 \u0438\u0437\u043C\u0435\u0440\u0435\u043D\u0438\u044F", _jsx("input", { style: INPUT, value: form.unit, onChange: e => fld('unit', e.target.value), placeholder: "\u0448\u0442, \u043C\u00B2, \u043A\u0433..." })] }), _jsxs("label", { style: LBL, children: ["\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E", _jsx("input", { style: INPUT, type: "number", min: "0", value: form.quantity, onChange: e => fld('quantity', e.target.value) })] })] }), _jsxs("label", { style: LBL, children: ["\u0426\u0435\u043D\u0430 \u0437\u0430 \u0435\u0434\u0438\u043D\u0438\u0446\u0443 \u20BD", _jsx("input", { style: INPUT, type: "number", min: "0", value: form.unit_price, onChange: e => fld('unit_price', e.target.value) })] }), _jsxs("div", { style: { padding: '8px 12px', background: C.primaryBg, borderRadius: 6, fontSize: 13 }, children: [_jsx("span", { style: { color: C.textSec }, children: "\u0418\u0442\u043E\u0433\u043E: " }), _jsxs("strong", { style: { color: C.primary }, children: [fmt(computedTotal()), " \u20BD"] })] }), _jsxs("label", { style: LBL, children: ["\u041F\u043E\u0441\u0442\u0430\u0432\u0449\u0438\u043A (ID \u0438\u043B\u0438 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435)", _jsx("input", { style: INPUT, value: form.supplier_id, onChange: e => fld('supplier_id', e.target.value), placeholder: "ID \u0438\u043B\u0438 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043F\u043E\u0441\u0442\u0430\u0432\u0449\u0438\u043A\u0430" })] }), _jsxs("label", { style: LBL, children: ["\u041F\u0440\u0438\u043C\u0435\u0447\u0430\u043D\u0438\u044F", _jsx("textarea", { style: { ...INPUT, marginTop: 4, resize: 'vertical' }, rows: 2, value: form.notes, onChange: e => fld('notes', e.target.value) })] })] }), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }, children: [_jsx("button", { style: btnOutline(), onClick: () => setModal(null), children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { style: btnPrimary(), onClick: save, disabled: saving || !form.item_name.trim(), children: saving ? 'Сохранение...' : 'Сохранить' })] })] }) }))] }));
}
