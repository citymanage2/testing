import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import client from '../api/client';
const STATUS_LABELS = { active: 'В работе', paused: 'Приостановлен', completed: 'Завершён', cancelled: 'Отменён' };
const STATUS_COLORS = { active: '#2e7d32', paused: '#e65100', completed: '#1565c0', cancelled: '#757575' };
export default function ProjectDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [card, setCard] = useState(null);
    const [gallery, setGallery] = useState([]);
    const [payments, setPayments] = useState([]);
    const [finSummary, setFinSummary] = useState(null);
    const [contractors, setContractors] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [tab, setTab] = useState('info');
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({});
    const [saving, setSaving] = useState(false);
    const [lightbox, setLightbox] = useState(null);
    const [payForm, setPayForm] = useState({ direction: 'income', amount: '', paid_at: new Date().toISOString().slice(0, 10), description: '', contractor_id: '' });
    const [showPayForm, setShowPayForm] = useState(false);
    const galleryInputRef = useRef(null);
    async function loadAll() {
        if (!id)
            return;
        try {
            const [cardR, galleryR, paymentsR, finR, contractorsR, detailR] = await Promise.all([
                client.get(`/projects/${id}/card`),
                client.get(`/projects/${id}/gallery`),
                client.get(`/projects/${id}/payments`),
                client.get(`/projects/${id}/financial-summary`),
                client.get('/contractors'),
                client.get(`/projects/${id}`),
            ]);
            setCard(cardR.data);
            setForm(cardR.data);
            setGallery(galleryR.data);
            setPayments(paymentsR.data);
            setFinSummary(finR.data);
            setContractors(contractorsR.data);
            setTasks(detailR.data.tasks || []);
        }
        catch {
            navigate('/task/create');
        }
    }
    useEffect(() => { loadAll(); }, [id]);
    async function saveCard() {
        setSaving(true);
        try {
            const payload = { ...form };
            await client.patch(`/projects/${id}/card`, payload);
            setEditing(false);
            loadAll();
        }
        finally {
            setSaving(false);
        }
    }
    async function uploadImages(e) {
        const files = Array.from(e.target.files || []);
        for (const file of files) {
            const fd = new FormData();
            fd.append('file', file);
            try {
                await client.post(`/projects/${id}/gallery`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            }
            catch (err) {
                alert(err?.response?.data?.detail || 'Ошибка загрузки');
            }
        }
        loadAll();
        if (galleryInputRef.current)
            galleryInputRef.current.value = '';
    }
    async function deleteImage(imgId) {
        if (!confirm('Удалить фото?'))
            return;
        await client.delete(`/projects/${id}/gallery/${imgId}`);
        setGallery(g => g.filter(x => x.id !== imgId));
    }
    async function addPayment() {
        await client.post(`/projects/${id}/payments`, {
            direction: payForm.direction,
            amount: parseFloat(payForm.amount),
            paid_at: payForm.paid_at,
            description: payForm.description || undefined,
            contractor_id: payForm.contractor_id || undefined,
        });
        setShowPayForm(false);
        setPayForm({ direction: 'income', amount: '', paid_at: new Date().toISOString().slice(0, 10), description: '', contractor_id: '' });
        loadAll();
    }
    async function deletePayment(pid) {
        if (!confirm('Удалить платёж?'))
            return;
        await client.delete(`/projects/${id}/payments/${pid}`);
        loadAll();
    }
    if (!card)
        return _jsx("div", { style: { padding: 24 }, children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430..." });
    const clientContractors = contractors.filter(c => c.kind === 'client');
    return (_jsxs("div", { style: { padding: 24, maxWidth: 1200 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }, children: [_jsxs("div", { style: { flex: 1 }, children: [editing ? (_jsx("input", { value: form.name || '', onChange: e => setForm(f => ({ ...f, name: e.target.value })), style: { fontSize: 22, fontWeight: 600, border: '1px solid #1976d2', borderRadius: 4, padding: '4px 8px', width: '100%' } })) : (_jsxs("h2", { style: { margin: 0, display: 'inline-flex', alignItems: 'center', gap: 8 }, children: [card.name, _jsx("span", { style: { fontSize: 13, padding: '2px 10px', borderRadius: 12, background: STATUS_COLORS[card.status || 'active'], color: '#fff' }, children: STATUS_LABELS[card.status || 'active'] })] })), card.address && !editing && _jsxs("div", { style: { fontSize: 13, color: '#666', marginTop: 4 }, children: ["\uD83D\uDCCD ", card.address] }), card.client_name && !editing && _jsxs("div", { style: { fontSize: 13, color: '#666' }, children: ["\uD83D\uDC64 ", card.client_name] })] }), _jsx("div", { style: { display: 'flex', gap: 6 }, children: editing ? (_jsxs(_Fragment, { children: [_jsx("button", { onClick: saveCard, disabled: saving, style: btn('#1565c0'), children: saving ? 'Сохранение...' : 'Сохранить' }), _jsx("button", { onClick: () => { setEditing(false); setForm(card); }, style: btn('#757575'), children: "\u041E\u0442\u043C\u0435\u043D\u0430" })] })) : (_jsx("button", { onClick: () => setEditing(true), style: btn('#546e7a'), children: "\u270E \u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C" })) })] }), editing && (_jsxs("div", { style: { background: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: 6, padding: 16, marginBottom: 16 }, children: [_jsxs("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }, children: [_jsxs("label", { style: lbl, children: ["\u0410\u0434\u0440\u0435\u0441", _jsx("input", { value: form.address || '', onChange: e => setForm(f => ({ ...f, address: e.target.value })), style: inp })] }), _jsxs("label", { style: lbl, children: ["\u0417\u0430\u043A\u0430\u0437\u0447\u0438\u043A", _jsxs("select", { value: form.client_id || '', onChange: e => setForm(f => ({ ...f, client_id: e.target.value || undefined })), style: inp, children: [_jsx("option", { value: "", children: "\u2014 \u043D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D \u2014" }), clientContractors.map(c => _jsx("option", { value: c.id, children: c.name }, c.id))] })] }), _jsxs("label", { style: lbl, children: ["\u0414\u0430\u0442\u0430 \u043D\u0430\u0447\u0430\u043B\u0430", _jsx("input", { type: "date", value: form.start_date || '', onChange: e => setForm(f => ({ ...f, start_date: e.target.value || undefined })), style: inp })] }), _jsxs("label", { style: lbl, children: ["\u0414\u0430\u0442\u0430 \u043E\u043A\u043E\u043D\u0447\u0430\u043D\u0438\u044F", _jsx("input", { type: "date", value: form.end_date || '', onChange: e => setForm(f => ({ ...f, end_date: e.target.value || undefined })), style: inp })] }), _jsxs("label", { style: lbl, children: ["\u0421\u0442\u0430\u0442\u0443\u0441", _jsx("select", { value: form.status || 'active', onChange: e => setForm(f => ({ ...f, status: e.target.value })), style: inp, children: Object.entries(STATUS_LABELS).map(([v, l]) => _jsx("option", { value: v, children: l }, v)) })] }), _jsxs("label", { style: lbl, children: ["\u041F\u043B\u0430\u043D\u043E\u0432\u044B\u0439 \u0431\u044E\u0434\u0436\u0435\u0442 \u20BD", _jsx("input", { type: "number", value: form.budget_planned || '', onChange: e => setForm(f => ({ ...f, budget_planned: parseFloat(e.target.value) || undefined })), style: inp })] })] }), _jsxs("label", { style: { ...lbl, marginTop: 10 }, children: ["\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435", _jsx("textarea", { value: form.description || '', onChange: e => setForm(f => ({ ...f, description: e.target.value })), rows: 2, style: { ...inp, resize: 'vertical' } })] }), _jsxs("label", { style: { ...lbl, marginTop: 6 }, children: ["\u041F\u0440\u0438\u043C\u0435\u0447\u0430\u043D\u0438\u044F", _jsx("textarea", { value: form.notes || '', onChange: e => setForm(f => ({ ...f, notes: e.target.value })), rows: 2, style: { ...inp, resize: 'vertical' } })] })] })), _jsx("div", { style: { display: 'flex', borderBottom: '2px solid #e0e0e0', marginBottom: 20 }, children: [['info', 'Информация'], ['gallery', `Фото (${card.gallery_count})`], ['finance', 'Финансы'], ['estimates', `Сметы (${tasks.length})`]].map(([t, l]) => (_jsx("button", { onClick: () => setTab(t), style: { padding: '8px 20px', border: 'none', borderBottom: tab === t ? '2px solid #1565c0' : '2px solid transparent', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: tab === t ? 600 : 400, color: tab === t ? '#1565c0' : '#555', marginBottom: -2 }, children: l }, t))) }), tab === 'info' && (_jsxs("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }, children: [[
                        ['Статус', STATUS_LABELS[card.status || 'active']],
                        ['Адрес', card.address || '—'],
                        ['Заказчик', card.client_name || '—'],
                        ['Начало', card.start_date || '—'],
                        ['Окончание', card.end_date || '—'],
                        ['Плановый бюджет', card.budget_planned ? fmt(card.budget_planned) + ' ₽' : '—'],
                    ].map(([label, value]) => (_jsxs("div", { style: { background: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: 6, padding: '10px 14px' }, children: [_jsx("div", { style: { fontSize: 11, color: '#888', marginBottom: 2 }, children: label }), _jsx("div", { style: { fontSize: 14, fontWeight: 500 }, children: value })] }, label))), card.notes && (_jsxs("div", { style: { gridColumn: '1 / -1', background: '#fffde7', border: '1px solid #fff176', borderRadius: 6, padding: '10px 14px' }, children: [_jsx("div", { style: { fontSize: 11, color: '#888', marginBottom: 2 }, children: "\u041F\u0440\u0438\u043C\u0435\u0447\u0430\u043D\u0438\u044F" }), _jsx("div", { style: { fontSize: 13, whiteSpace: 'pre-wrap' }, children: card.notes })] }))] })), tab === 'gallery' && (_jsxs("div", { children: [_jsxs("div", { style: { display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }, children: [_jsx("button", { onClick: () => galleryInputRef.current?.click(), style: btn('#1565c0'), children: "+ \u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0444\u043E\u0442\u043E" }), _jsx("span", { style: { fontSize: 12, color: '#888' }, children: "PNG/JPEG/WebP, \u043C\u0430\u043A\u0441. 5MB, \u0434\u043E 20 \u0444\u043E\u0442\u043E" }), _jsx("input", { ref: galleryInputRef, type: "file", accept: "image/*", multiple: true, style: { display: 'none' }, onChange: uploadImages })] }), gallery.length === 0
                        ? _jsx("div", { style: { padding: 32, textAlign: 'center', color: '#aaa' }, children: "\u041D\u0435\u0442 \u0444\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u0439" })
                        : (_jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }, children: gallery.map(img => (_jsxs("div", { style: { position: 'relative', border: '1px solid #e0e0e0', borderRadius: 6, overflow: 'hidden' }, children: [_jsx("img", { src: `/api/projects/${id}/gallery/${img.id}`, alt: img.caption || img.file_name, style: { width: '100%', height: 140, objectFit: 'cover', cursor: 'pointer', display: 'block' }, onClick: () => setLightbox(img.id) }), img.caption && _jsx("div", { style: { padding: '4px 8px', fontSize: 11, color: '#555', background: '#fafafa' }, children: img.caption }), _jsx("button", { onClick: () => deleteImage(img.id), style: { position: 'absolute', top: 4, right: 4, padding: '2px 6px', background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }, children: "\u2715" })] }, img.id))) })), lightbox !== null && (_jsx("div", { style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }, onClick: () => setLightbox(null), children: _jsx("img", { src: `/api/projects/${id}/gallery/${lightbox}`, alt: "", style: { maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 4 } }) }))] })), tab === 'finance' && finSummary && (_jsxs("div", { children: [_jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }, children: [
                            ['Смета (с НДС)', finSummary.estimate_total, '#1565c0'],
                            ['Плановый бюджет', finSummary.budget_planned ?? null, '#546e7a'],
                            ['Получено доходов', finSummary.income_received, '#2e7d32'],
                            ['Оплачено расходов', finSummary.expenses_paid, '#c62828'],
                            ['Баланс', finSummary.balance, finSummary.balance >= 0 ? '#2e7d32' : '#c62828'],
                            ['Остаток бюджета', finSummary.budget_remaining ?? null, finSummary.budget_remaining !== null && finSummary.budget_remaining !== undefined && finSummary.budget_remaining >= 0 ? '#2e7d32' : '#c62828'],
                        ].map(([label, value, color]) => value !== null && (_jsxs("div", { style: { background: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: 6, padding: '10px 14px' }, children: [_jsx("div", { style: { fontSize: 11, color: '#888' }, children: label }), _jsxs("div", { style: { fontSize: 16, fontWeight: 700, color }, children: [fmt(value), " \u20BD"] })] }, label))) }), _jsxs("div", { style: { display: 'flex', gap: 8, marginBottom: 12 }, children: [_jsx("h3", { style: { margin: 0 }, children: "\u041F\u043B\u0430\u0442\u0435\u0436\u0438" }), _jsx("button", { onClick: () => setShowPayForm(v => !v), style: btn('#1565c0'), children: "+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C" })] }), showPayForm && (_jsxs("div", { style: { background: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: 6, padding: 14, marginBottom: 14 }, children: [_jsxs("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }, children: [_jsxs("label", { style: lbl, children: ["\u0422\u0438\u043F", _jsxs("select", { value: payForm.direction, onChange: e => setPayForm(f => ({ ...f, direction: e.target.value })), style: inp, children: [_jsx("option", { value: "income", children: "\u0414\u043E\u0445\u043E\u0434" }), _jsx("option", { value: "expense", children: "\u0420\u0430\u0441\u0445\u043E\u0434" })] })] }), _jsxs("label", { style: lbl, children: ["\u0421\u0443\u043C\u043C\u0430 \u20BD *", _jsx("input", { type: "number", value: payForm.amount, onChange: e => setPayForm(f => ({ ...f, amount: e.target.value })), style: inp })] }), _jsxs("label", { style: lbl, children: ["\u0414\u0430\u0442\u0430", _jsx("input", { type: "date", value: payForm.paid_at, onChange: e => setPayForm(f => ({ ...f, paid_at: e.target.value })), style: inp })] }), _jsxs("label", { style: lbl, children: ["\u041A\u043E\u043D\u0442\u0440\u0430\u0433\u0435\u043D\u0442", _jsxs("select", { value: payForm.contractor_id, onChange: e => setPayForm(f => ({ ...f, contractor_id: e.target.value })), style: inp, children: [_jsx("option", { value: "", children: "\u2014 \u043D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D \u2014" }), contractors.map(c => _jsx("option", { value: c.id, children: c.name }, c.id))] })] }), _jsxs("label", { style: { ...lbl, gridColumn: '1 / -1' }, children: ["\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435", _jsx("input", { value: payForm.description, onChange: e => setPayForm(f => ({ ...f, description: e.target.value })), style: inp })] })] }), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 10 }, children: [_jsx("button", { onClick: addPayment, disabled: !payForm.amount, style: btn('#2e7d32'), children: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C" }), _jsx("button", { onClick: () => setShowPayForm(false), style: btn('#757575'), children: "\u041E\u0442\u043C\u0435\u043D\u0430" })] })] })), payments.length === 0
                        ? _jsx("div", { style: { padding: 24, textAlign: 'center', color: '#aaa' }, children: "\u041D\u0435\u0442 \u043F\u043B\u0430\u0442\u0435\u0436\u0435\u0439" })
                        : (_jsxs("table", { style: { width: '100%', borderCollapse: 'collapse', fontSize: 13 }, children: [_jsx("thead", { children: _jsx("tr", { style: { background: '#f5f5f5' }, children: ['Дата', 'Тип', 'Сумма', 'Контрагент', 'Описание', ''].map(h => (_jsx("th", { style: { padding: '7px 10px', border: '1px solid #e0e0e0', textAlign: 'left', fontWeight: 600 }, children: h }, h))) }) }), _jsx("tbody", { children: payments.map(p => (_jsxs("tr", { children: [_jsx("td", { style: td, children: p.paid_at }), _jsx("td", { style: td, children: _jsx("span", { style: { padding: '2px 8px', borderRadius: 10, fontSize: 11, background: p.direction === 'income' ? '#e8f5e9' : '#ffebee', color: p.direction === 'income' ? '#2e7d32' : '#c62828' }, children: p.direction === 'income' ? '↑ Доход' : '↓ Расход' }) }), _jsxs("td", { style: { ...td, fontWeight: 600, color: p.direction === 'income' ? '#2e7d32' : '#c62828' }, children: [fmt(p.amount), " \u20BD"] }), _jsx("td", { style: td, children: p.contractor_name || '—' }), _jsx("td", { style: td, children: p.description || '—' }), _jsx("td", { style: td, children: _jsx("button", { onClick: () => deletePayment(p.id), style: { padding: '2px 6px', fontSize: 11, border: '1px solid #ef9a9a', borderRadius: 4, cursor: 'pointer', background: '#ffebee', color: '#c62828' }, children: "\u2715" }) })] }, p.id))) })] }))] })), tab === 'estimates' && (_jsx("div", { children: tasks.length === 0
                    ? _jsx("div", { style: { padding: 32, textAlign: 'center', color: '#aaa' }, children: "\u041D\u0435\u0442 \u0441\u043C\u0435\u0442 \u0432 \u043F\u0440\u043E\u0435\u043A\u0442\u0435" })
                    : tasks.map(t => (_jsxs(Link, { to: `/task/${t.id}/estimate`, style: { display: 'block', padding: '10px 14px', border: '1px solid #e0e0e0', borderRadius: 6, marginBottom: 8, textDecoration: 'none', color: 'inherit', background: '#fafafa' }, children: [_jsx("div", { style: { fontWeight: 500 }, children: t.name || `Смета ${t.id.slice(0, 8)}` }), _jsxs("div", { style: { fontSize: 12, color: '#888', marginTop: 2 }, children: ["\u0421\u0442\u0430\u0442\u0443\u0441: ", t.estimate_status || 'не указан', " \u00B7 ", new Date(t.created_at).toLocaleDateString('ru-RU')] })] }, t.id))) }))] }));
}
function fmt(v) { return v.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
const td = { padding: '6px 10px', border: '1px solid #e0e0e0', verticalAlign: 'middle' };
const lbl = { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 13 };
const inp = { padding: '6px 10px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13 };
function btn(bg) { return { padding: '7px 16px', background: bg, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }; }
