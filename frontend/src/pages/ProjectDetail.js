import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import client from '../api/client';
import ProjectDocuments from '../components/ProjectDocuments';
import SubcontractorContracts from '../components/SubcontractorContracts';
import WorkSchedule from '../components/WorkSchedule';
import ClientActsManager from '../components/ClientActsManager';
import PurchaseRequests from '../components/PurchaseRequests';
import WarrantyClaims from '../components/WarrantyClaims';
import KpRequests from '../components/KpRequests';
import { C, btnPrimary, btnOutline, btnDanger, btnGhost, badge, INPUT, LBL, CARD, TH, TD, OVERLAY, MODAL } from '../ui';
const STAGE_ORDER = ['LEAD', 'ESTIMATION', 'OPTIMIZATION', 'APPROVAL', 'EXECUTION', 'HANDOVER', 'WARRANTY', 'CLOSED'];
const STAGE_LABELS = {
    LEAD: 'Лид/Продажа', ESTIMATION: 'Осмечивание', OPTIMIZATION: 'Оптимизация',
    APPROVAL: 'Согласование КП', EXECUTION: 'Реализация', HANDOVER: 'Сдача объекта',
    WARRANTY: 'Гарантийный период', CLOSED: 'Закрыт',
};
const STAGE_COLORS = {
    LEAD: C.textMuted, ESTIMATION: C.warning, OPTIMIZATION: '#7c3aed',
    APPROVAL: C.primary, EXECUTION: '#0891b2', HANDOVER: '#16a34a',
    WARRANTY: '#b45309', CLOSED: C.textMuted,
};
const CONSTRUCTION_TYPES = ['Новое строительство', 'Реконструкция', 'Ремонт', 'Прочее'];
export default function ProjectDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [card, setCard] = useState(null);
    const [stageInfo, setStageInfo] = useState(null);
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
    const [showStageModal, setShowStageModal] = useState(false);
    const [stageReason, setStageReason] = useState('');
    const [pendingStage, setPendingStage] = useState('');
    const [suggestions, setSuggestions] = useState([]);
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
            // Load stage info
            try {
                const stageR = await client.get(`/projects/${id}/stage`);
                setStageInfo(stageR.data);
            }
            catch { }
            // Load stage suggestions
            client.get(`/projects/${id}/stage-suggestions`).then(r => setSuggestions(r.data.suggestions)).catch(() => { });
        }
        catch {
            navigate('/task/create');
        }
    }
    useEffect(() => { loadAll(); }, [id]);
    async function saveCard() {
        setSaving(true);
        try {
            await client.patch(`/projects/${id}/card`, form);
            // Also update lifecycle details if changed
            await client.patch(`/projects/${id}/details`, {
                construction_type: form.construction_type,
                contract_number: form.contract_number,
                contract_date: form.contract_date,
            }).catch(() => { });
            setEditing(false);
            loadAll();
        }
        finally {
            setSaving(false);
        }
    }
    async function doStageTransition() {
        if (!pendingStage)
            return;
        try {
            await client.post(`/projects/${id}/stage`, { stage: pendingStage, reason: stageReason || undefined });
            setShowStageModal(false);
            setStageReason('');
            setPendingStage('');
            loadAll();
        }
        catch (e) {
            alert(e?.response?.data?.detail || 'Ошибка перехода стадии');
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
    async function addPayment() {
        await client.post(`/projects/${id}/payments`, { direction: payForm.direction, amount: parseFloat(payForm.amount), paid_at: payForm.paid_at, description: payForm.description || undefined, contractor_id: payForm.contractor_id || undefined });
        setShowPayForm(false);
        setPayForm({ direction: 'income', amount: '', paid_at: new Date().toISOString().slice(0, 10), description: '', contractor_id: '' });
        loadAll();
    }
    if (!card)
        return _jsx("div", { style: { padding: 24, color: C.textSec }, children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430..." });
    const clientContractors = contractors.filter(c => c.kind === 'client');
    const stageBg = STAGE_COLORS[stageInfo?.stage || card.stage || 'LEAD'];
    const currentStage = stageInfo?.stage || card.stage || '';
    const TABS = [
        ['info', '📋 Информация'], ['docs', '📁 Документы'], ['contracts', '📄 Договоры'],
        ['schedule', '📅 ГПР'], ['acts', '✅ Акты КС-2'], ['purchases', '🛒 Закупки'],
        ['gallery', `🖼 Фото (${card.gallery_count})`], ['finance', '💰 Финансы'],
        ['estimates', `📐 Сметы (${tasks.length})`],
        ['kp', '📊 Оптимизация КП'],
        ...((currentStage === 'WARRANTY' || currentStage === 'CLOSED') ? [['warranty', '🛡 Гарантия']] : []),
    ];
    return (_jsxs("div", { style: { padding: '20px 24px', maxWidth: 1400, margin: '0 auto' }, children: [_jsxs("div", { style: { ...CARD, padding: '16px 20px', marginBottom: 16 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }, children: [_jsxs("div", { style: { flex: 1 }, children: [editing ? (_jsx("input", { value: form.name || '', onChange: e => setForm(f => ({ ...f, name: e.target.value })), style: { ...INPUT, fontSize: 20, fontWeight: 600 } })) : (_jsxs("h2", { style: { margin: 0, fontSize: 20, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }, children: [card.name, stageInfo && _jsx("span", { style: { fontSize: 12, padding: '3px 10px', borderRadius: 12, background: stageBg + '22', color: stageBg, border: `1px solid ${stageBg}44`, fontWeight: 600 }, children: stageInfo.stage_label })] })), _jsxs("div", { style: { display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap', fontSize: 13, color: C.textSec }, children: [card.address && _jsxs("span", { children: ["\uD83D\uDCCD ", card.address] }), card.client_name && _jsxs("span", { children: ["\uD83D\uDC64 ", card.client_name] }), card.contract_number && _jsxs("span", { children: ["\uD83D\uDCCB \u0414\u043E\u0433\u043E\u0432\u043E\u0440 \u2116", card.contract_number] }), card.start_date && _jsxs("span", { children: ["\uD83D\uDDD3 ", card.start_date, card.end_date ? ` — ${card.end_date}` : ''] })] })] }), _jsx("div", { style: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }, children: editing ? (_jsxs(_Fragment, { children: [_jsx("button", { onClick: saveCard, disabled: saving, style: btnPrimary('sm'), children: saving ? 'Сохранение...' : 'Сохранить' }), _jsx("button", { onClick: () => { setEditing(false); setForm(card); }, style: btnOutline('sm'), children: "\u041E\u0442\u043C\u0435\u043D\u0430" })] })) : (_jsx("button", { onClick: () => setEditing(true), style: btnGhost('sm'), children: "\u270E \u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C" })) })] }), editing && (_jsxs("div", { style: { marginTop: 14, padding: '14px 0', borderTop: `1px solid ${C.border}` }, children: [_jsxs("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }, children: [_jsxs("label", { style: LBL, children: ["\u0410\u0434\u0440\u0435\u0441", _jsx("input", { value: form.address || '', onChange: e => setForm(f => ({ ...f, address: e.target.value })), style: { ...INPUT, marginTop: 4 } })] }), _jsxs("label", { style: LBL, children: ["\u0417\u0430\u043A\u0430\u0437\u0447\u0438\u043A", _jsxs("select", { value: form.client_id || '', onChange: e => setForm(f => ({ ...f, client_id: e.target.value || undefined })), style: { ...INPUT, marginTop: 4 }, children: [_jsx("option", { value: "", children: "\u2014 \u043D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D \u2014" }), clientContractors.map(c => _jsx("option", { value: c.id, children: c.name }, c.id))] })] }), _jsxs("label", { style: LBL, children: ["\u0422\u0438\u043F \u0441\u0442\u0440\u043E\u0438\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u0430", _jsxs("select", { value: form.construction_type || '', onChange: e => setForm(f => ({ ...f, construction_type: e.target.value || undefined })), style: { ...INPUT, marginTop: 4 }, children: [_jsx("option", { value: "", children: "\u2014 \u043D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D \u2014" }), CONSTRUCTION_TYPES.map(t => _jsx("option", { value: t, children: t }, t))] })] }), _jsxs("label", { style: LBL, children: ["\u041D\u043E\u043C\u0435\u0440 \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0430", _jsx("input", { value: form.contract_number || '', onChange: e => setForm(f => ({ ...f, contract_number: e.target.value || undefined })), style: { ...INPUT, marginTop: 4 } })] }), _jsxs("label", { style: LBL, children: ["\u0414\u0430\u0442\u0430 \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0430", _jsx("input", { type: "date", value: form.contract_date || '', onChange: e => setForm(f => ({ ...f, contract_date: e.target.value || undefined })), style: { ...INPUT, marginTop: 4 } })] }), _jsxs("label", { style: LBL, children: ["\u0414\u0430\u0442\u0430 \u043D\u0430\u0447\u0430\u043B\u0430", _jsx("input", { type: "date", value: form.start_date || '', onChange: e => setForm(f => ({ ...f, start_date: e.target.value || undefined })), style: { ...INPUT, marginTop: 4 } })] }), _jsxs("label", { style: LBL, children: ["\u0414\u0430\u0442\u0430 \u043E\u043A\u043E\u043D\u0447\u0430\u043D\u0438\u044F", _jsx("input", { type: "date", value: form.end_date || '', onChange: e => setForm(f => ({ ...f, end_date: e.target.value || undefined })), style: { ...INPUT, marginTop: 4 } })] }), _jsxs("label", { style: LBL, children: ["\u041F\u043B\u0430\u043D\u043E\u0432\u044B\u0439 \u0431\u044E\u0434\u0436\u0435\u0442 \u20BD", _jsx("input", { type: "number", value: form.budget_planned || '', onChange: e => setForm(f => ({ ...f, budget_planned: parseFloat(e.target.value) || undefined })), style: { ...INPUT, marginTop: 4 } })] })] }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }, children: [_jsxs("label", { style: LBL, children: ["\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435", _jsx("textarea", { value: form.description || '', onChange: e => setForm(f => ({ ...f, description: e.target.value })), rows: 2, style: { ...INPUT, marginTop: 4, resize: 'vertical' } })] }), _jsxs("label", { style: LBL, children: ["\u041F\u0440\u0438\u043C\u0435\u0447\u0430\u043D\u0438\u044F", _jsx("textarea", { value: form.notes || '', onChange: e => setForm(f => ({ ...f, notes: e.target.value })), rows: 2, style: { ...INPUT, marginTop: 4, resize: 'vertical' } })] })] })] }))] }), _jsx("div", { style: { display: 'flex', gap: 2, flexWrap: 'wrap', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: 4, marginBottom: 16 }, children: TABS.map(([t, l]) => (_jsx("button", { onClick: () => setTab(t), style: { padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t ? 600 : 400, background: tab === t ? C.surface : 'transparent', color: tab === t ? C.primary : C.textSec, boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,.1)' : 'none', whiteSpace: 'nowrap' }, children: l }, t))) }), tab === 'info' && (_jsxs("div", { children: [_jsxs("div", { style: { ...CARD, padding: 16, marginBottom: 16 }, children: [_jsx("div", { style: { fontSize: 13, fontWeight: 600, marginBottom: 12, color: C.text }, children: "\u0421\u0442\u0430\u0434\u0438\u0438 \u043F\u0440\u043E\u0435\u043A\u0442\u0430" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 0 }, children: STAGE_ORDER.map((stage, idx) => {
                                    const currentIdx = STAGE_ORDER.indexOf(stageInfo?.stage || 'LEAD');
                                    const isCompleted = idx < currentIdx;
                                    const isCurrent = idx === currentIdx;
                                    const isFuture = idx > currentIdx;
                                    const suggestion = suggestions.find(s => s.stage === stage);
                                    const isAllowed = stageInfo?.allowed_next_stages?.some(s => s.stage === stage);
                                    return (_jsxs("div", { style: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '8px 0', borderBottom: idx < STAGE_ORDER.length - 1 ? `1px solid ${C.border}` : 'none' }, children: [_jsx("div", { style: {
                                                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: 13, fontWeight: 700,
                                                    background: isCompleted ? C.success : isCurrent ? C.primary : C.surfaceAlt,
                                                    color: isCompleted || isCurrent ? '#fff' : C.textMuted,
                                                    border: `2px solid ${isCompleted ? C.success : isCurrent ? C.primary : C.border}`,
                                                }, children: isCompleted ? '✓' : idx + 1 }), _jsxs("div", { style: { flex: 1 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("span", { style: { fontSize: 13, fontWeight: isCurrent ? 700 : 500, color: isFuture && !isAllowed ? C.textMuted : C.text }, children: STAGE_LABELS[stage] }), isCurrent && _jsx("span", { style: badge(C.primary, C.primaryBg), children: "\u0422\u0435\u043A\u0443\u0449\u0430\u044F" }), isAllowed && !isCurrent && (_jsx("span", { style: badge(suggestion?.ready ? C.success : C.warning, suggestion?.ready ? C.successBg : C.warningBg), children: suggestion?.ready ? '✅ Готово' : '⚠️ Условия' }))] }), isAllowed && !isCurrent && (_jsx("button", { style: { ...btnOutline('sm'), marginTop: 4 }, title: suggestion?.condition_hint, onClick: () => { setPendingStage(stage); setShowStageModal(true); }, children: "\u041F\u0435\u0440\u0435\u0439\u0442\u0438 \u2192" })), isAllowed && suggestion && !suggestion.ready && (_jsx("div", { style: { fontSize: 11, color: C.warning, marginTop: 2 }, children: suggestion.condition_hint }))] })] }, stage));
                                }) })] }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }, children: [[
                                ['Стадия проекта', stageInfo?.stage_label || '—'],
                                ['Тип строительства', card.construction_type || '—'],
                                ['Адрес', card.address || '—'],
                                ['Заказчик', card.client_name || '—'],
                                ['Договор №', card.contract_number || '—'],
                                ['Дата договора', card.contract_date || '—'],
                                ['Начало', card.start_date || '—'],
                                ['Окончание', card.end_date || '—'],
                                ['Плановый бюджет', card.budget_planned ? fmt(card.budget_planned) + ' ₽' : '—'],
                            ].map(([label, value]) => (_jsxs("div", { style: { ...CARD, padding: '10px 14px' }, children: [_jsx("div", { style: { fontSize: 11, color: C.textMuted, marginBottom: 3 }, children: label }), _jsx("div", { style: { fontSize: 14, fontWeight: 500, color: C.text }, children: value })] }, label))), card.notes && (_jsxs("div", { style: { ...CARD, gridColumn: '1 / -1', padding: '10px 14px', background: C.warningBg, border: `1px solid ${C.warning}22` }, children: [_jsx("div", { style: { fontSize: 11, color: C.textMuted, marginBottom: 3 }, children: "\u041F\u0440\u0438\u043C\u0435\u0447\u0430\u043D\u0438\u044F" }), _jsx("div", { style: { fontSize: 13, whiteSpace: 'pre-wrap', color: C.text }, children: card.notes })] }))] })] })), tab === 'docs' && id && _jsx(ProjectDocuments, { projectId: id }), tab === 'contracts' && id && _jsx(SubcontractorContracts, { projectId: id }), tab === 'schedule' && id && _jsx(WorkSchedule, { projectId: id }), tab === 'acts' && id && _jsx(ClientActsManager, { projectId: id }), tab === 'purchases' && id && _jsx(PurchaseRequests, { projectId: id }), tab === 'warranty' && _jsx(WarrantyClaims, { projectId: id }), tab === 'kp' && _jsx(KpRequests, { projectId: id }), tab === 'gallery' && (_jsxs("div", { children: [_jsxs("div", { style: { display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }, children: [_jsx("button", { onClick: () => galleryInputRef.current?.click(), style: btnPrimary('sm'), children: "+ \u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0444\u043E\u0442\u043E" }), _jsx("span", { style: { fontSize: 12, color: C.textMuted }, children: "PNG/JPEG/WebP, \u043C\u0430\u043A\u0441. 5MB" }), _jsx("input", { ref: galleryInputRef, type: "file", accept: "image/*", multiple: true, style: { display: 'none' }, onChange: uploadImages })] }), gallery.length === 0
                        ? _jsx("div", { style: { ...CARD, padding: 40, textAlign: 'center', color: C.textMuted }, children: "\u041D\u0435\u0442 \u0444\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u0439" })
                        : (_jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }, children: gallery.map(img => (_jsxs("div", { style: { position: 'relative', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }, children: [_jsx("img", { src: `/api/projects/${id}/gallery/${img.id}`, alt: img.caption || img.file_name, style: { width: '100%', height: 140, objectFit: 'cover', cursor: 'pointer', display: 'block' }, onClick: () => setLightbox(img.id) }), img.caption && _jsx("div", { style: { padding: '4px 8px', fontSize: 11, color: C.textSec }, children: img.caption }), _jsx("button", { onClick: () => { if (confirm('Удалить фото?'))
                                            client.delete(`/projects/${id}/gallery/${img.id}`).then(loadAll); }, style: { position: 'absolute', top: 4, right: 4, padding: '2px 6px', background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }, children: "\u2715" })] }, img.id))) })), lightbox !== null && (_jsx("div", { style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }, onClick: () => setLightbox(null), children: _jsx("img", { src: `/api/projects/${id}/gallery/${lightbox}`, alt: "", style: { maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 } }) }))] })), tab === 'finance' && finSummary && (_jsxs("div", { children: [_jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }, children: [
                            ['Смета (с НДС)', finSummary.estimate_total, C.primary],
                            ['Плановый бюджет', finSummary.budget_planned ?? null, C.textSec],
                            ['Получено доходов', finSummary.income_received, C.success],
                            ['Оплачено расходов', finSummary.expenses_paid, C.danger],
                            ['Баланс', finSummary.balance, finSummary.balance >= 0 ? C.success : C.danger],
                            ['Остаток бюджета', finSummary.budget_remaining ?? null, (finSummary.budget_remaining ?? 0) >= 0 ? C.success : C.danger],
                        ].map(([label, value, color]) => value !== null && (_jsxs("div", { style: { ...CARD, padding: '10px 14px' }, children: [_jsx("div", { style: { fontSize: 11, color: C.textMuted }, children: label }), _jsxs("div", { style: { fontSize: 16, fontWeight: 700, color, marginTop: 4 }, children: [fmt(value), " \u20BD"] })] }, label))) }), _jsxs("div", { style: { display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }, children: [_jsx("h3", { style: { margin: 0, fontSize: 15, color: C.text }, children: "\u041F\u043B\u0430\u0442\u0435\u0436\u0438" }), _jsx("button", { onClick: () => setShowPayForm(v => !v), style: btnPrimary('sm'), children: "+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C" })] }), showPayForm && (_jsxs("div", { style: { ...CARD, padding: 14, marginBottom: 14 }, children: [_jsxs("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }, children: [_jsxs("label", { style: LBL, children: ["\u0422\u0438\u043F", _jsxs("select", { value: payForm.direction, onChange: e => setPayForm(f => ({ ...f, direction: e.target.value })), style: { ...INPUT, marginTop: 4 }, children: [_jsx("option", { value: "income", children: "\u0414\u043E\u0445\u043E\u0434" }), _jsx("option", { value: "expense", children: "\u0420\u0430\u0441\u0445\u043E\u0434" })] })] }), _jsxs("label", { style: LBL, children: ["\u0421\u0443\u043C\u043C\u0430 \u20BD", _jsx("input", { type: "number", value: payForm.amount, onChange: e => setPayForm(f => ({ ...f, amount: e.target.value })), style: { ...INPUT, marginTop: 4 } })] }), _jsxs("label", { style: LBL, children: ["\u0414\u0430\u0442\u0430", _jsx("input", { type: "date", value: payForm.paid_at, onChange: e => setPayForm(f => ({ ...f, paid_at: e.target.value })), style: { ...INPUT, marginTop: 4 } })] }), _jsxs("label", { style: LBL, children: ["\u041A\u043E\u043D\u0442\u0440\u0430\u0433\u0435\u043D\u0442", _jsxs("select", { value: payForm.contractor_id, onChange: e => setPayForm(f => ({ ...f, contractor_id: e.target.value })), style: { ...INPUT, marginTop: 4 }, children: [_jsx("option", { value: "", children: "\u2014 \u043D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D \u2014" }), contractors.map(c => _jsx("option", { value: c.id, children: c.name }, c.id))] })] }), _jsxs("label", { style: { ...LBL, gridColumn: '1/-1' }, children: ["\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435", _jsx("input", { value: payForm.description, onChange: e => setPayForm(f => ({ ...f, description: e.target.value })), style: { ...INPUT, marginTop: 4 } })] })] }), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 10 }, children: [_jsx("button", { onClick: addPayment, disabled: !payForm.amount, style: btnPrimary('sm'), children: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C" }), _jsx("button", { onClick: () => setShowPayForm(false), style: btnOutline('sm'), children: "\u041E\u0442\u043C\u0435\u043D\u0430" })] })] })), payments.length === 0
                        ? _jsx("div", { style: { ...CARD, padding: 24, textAlign: 'center', color: C.textMuted }, children: "\u041D\u0435\u0442 \u043F\u043B\u0430\u0442\u0435\u0436\u0435\u0439" })
                        : (_jsx("div", { style: { borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }, children: _jsxs("table", { style: { width: '100%', borderCollapse: 'collapse', fontSize: 13 }, children: [_jsx("thead", { children: _jsx("tr", { children: ['Дата', 'Тип', 'Сумма', 'Контрагент', 'Описание', ''].map(h => _jsx("th", { style: TH, children: h }, h)) }) }), _jsx("tbody", { children: payments.map(p => (_jsxs("tr", { children: [_jsx("td", { style: TD, children: p.paid_at }), _jsx("td", { style: TD, children: _jsx("span", { style: { padding: '2px 8px', borderRadius: 10, fontSize: 11, background: p.direction === 'income' ? C.successBg : C.dangerBg, color: p.direction === 'income' ? C.success : C.danger }, children: p.direction === 'income' ? '↑ Доход' : '↓ Расход' }) }), _jsxs("td", { style: { ...TD, fontWeight: 600, color: p.direction === 'income' ? C.success : C.danger }, children: [fmt(p.amount), " \u20BD"] }), _jsx("td", { style: TD, children: p.contractor_name || '—' }), _jsx("td", { style: TD, children: p.description || '—' }), _jsx("td", { style: TD, children: _jsx("button", { onClick: () => { if (confirm('Удалить?'))
                                                            client.delete(`/projects/${id}/payments/${p.id}`).then(loadAll); }, style: { ...btnDanger('sm'), padding: '2px 6px' }, children: "\u2715" }) })] }, p.id))) })] }) }))] })), tab === 'estimates' && (_jsx("div", { children: tasks.length === 0
                    ? _jsx("div", { style: { ...CARD, padding: 40, textAlign: 'center', color: C.textMuted }, children: "\u041D\u0435\u0442 \u0441\u043C\u0435\u0442 \u0432 \u043F\u0440\u043E\u0435\u043A\u0442\u0435" })
                    : tasks.map(t => (_jsxs(Link, { to: `/task/${t.id}/estimate`, style: { display: 'block', padding: '10px 14px', border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 8, textDecoration: 'none', color: 'inherit', background: C.surfaceAlt }, children: [_jsx("div", { style: { fontWeight: 500, color: C.text }, children: t.name || `Смета ${t.id.slice(0, 8)}` }), _jsxs("div", { style: { fontSize: 12, color: C.textSec, marginTop: 2 }, children: ["\u0421\u0442\u0430\u0442\u0443\u0441: ", t.estimate_status || 'не указан', " \u00B7 ", new Date(t.created_at).toLocaleDateString('ru-RU')] })] }, t.id))) })), showStageModal && (_jsx("div", { style: OVERLAY, children: _jsxs("div", { style: { ...MODAL, maxWidth: 400 }, children: [_jsxs("h3", { style: { margin: '0 0 14px', fontSize: 16 }, children: ["\u041F\u0435\u0440\u0435\u0439\u0442\u0438 \u043D\u0430 \u0441\u0442\u0430\u0434\u0438\u044E: ", STAGE_LABELS[pendingStage] || stageInfo?.allowed_next_stages.find(s => s.stage === pendingStage)?.label] }), _jsxs("label", { style: LBL, children: ["\u041F\u0440\u0438\u0447\u0438\u043D\u0430 \u043F\u0435\u0440\u0435\u0445\u043E\u0434\u0430 (\u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E)", _jsx("textarea", { value: stageReason, onChange: e => setStageReason(e.target.value), rows: 3, style: { ...INPUT, marginTop: 4, resize: 'vertical' } })] }), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 16 }, children: [_jsx("button", { onClick: doStageTransition, style: btnPrimary(), children: "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C \u043F\u0435\u0440\u0435\u0445\u043E\u0434" }), _jsx("button", { onClick: () => setShowStageModal(false), style: btnOutline(), children: "\u041E\u0442\u043C\u0435\u043D\u0430" })] })] }) }))] }));
}
function fmt(v) { return v.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
