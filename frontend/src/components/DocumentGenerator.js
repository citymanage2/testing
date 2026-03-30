import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import client from '../api/client';
import { C, btnPrimary, btnGhost, INPUT, LBL, CARD } from '../ui';
const DOC_KIND_LABELS = { estimate_xlsx: 'Смета Excel', ks2: 'КС-2', ks3: 'КС-3' };
const TAB_LABELS = { estimate: '⬇ Смета', ks2: 'КС-2', ks3: 'КС-3' };
export default function DocumentGenerator({ taskId }) {
    const [tab, setTab] = useState('estimate');
    const [contractors, setContractors] = useState([]);
    const [acceptances, setAcceptances] = useState([]);
    const [history, setHistory] = useState([]);
    const [generating, setGenerating] = useState(false);
    const [contractorId, setContractorId] = useState('');
    const [periodStart, setPeriodStart] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
    const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().slice(0, 10));
    const [actNumber, setActNumber] = useState('1');
    const [estimateTitle, setEstimateTitle] = useState('');
    const [ks2Amount, setKs2Amount] = useState('');
    const [acceptanceId, setAcceptanceId] = useState('');
    useEffect(() => {
        client.get('/contractors').then(r => setContractors(r.data)).catch(() => { });
        client.get(`/projects/estimates/${taskId}/acceptances`).then(r => setAcceptances(r.data)).catch(() => { });
        loadHistory();
    }, [taskId]);
    async function loadHistory() {
        try {
            setHistory((await client.get(`/projects/estimates/${taskId}/documents`)).data);
        }
        catch { }
    }
    async function generate() {
        setGenerating(true);
        try {
            let url = '';
            let body = {};
            if (tab === 'estimate') {
                url = `/projects/estimates/${taskId}/documents/estimate-xlsx`;
                body = { title: estimateTitle || undefined, contractor_id: contractorId || undefined };
            }
            else if (tab === 'ks2') {
                url = `/projects/estimates/${taskId}/documents/ks2`;
                body = acceptanceId
                    ? { acceptance_id: acceptanceId, period_start: periodStart, period_end: periodEnd }
                    : { contractor_id: contractorId || undefined, period_start: periodStart, period_end: periodEnd, act_number: actNumber };
            }
            else {
                url = `/projects/estimates/${taskId}/documents/ks3`;
                body = { contractor_id: contractorId || undefined, period_start: periodStart, period_end: periodEnd, act_number: actNumber, ks2_amount: ks2Amount ? parseFloat(ks2Amount) : undefined };
            }
            const resp = await client.post(url, body, { responseType: 'blob' });
            const blobUrl = URL.createObjectURL(resp.data);
            const cd = resp.headers['content-disposition'] || '';
            const match = cd.match(/filename="([^"]+)"/);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = match ? match[1] : 'document.xlsx';
            a.click();
            URL.revokeObjectURL(blobUrl);
            loadHistory();
        }
        catch (err) {
            alert(err?.response?.data?.detail || 'Ошибка генерации документа');
        }
        finally {
            setGenerating(false);
        }
    }
    async function reDownload(doc) {
        const resp = await client.get(`/projects/estimates/${taskId}/documents/${doc.id}/download`, { responseType: 'blob' });
        const url = URL.createObjectURL(resp.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.file_name;
        a.click();
        URL.revokeObjectURL(url);
    }
    const clientContractors = contractors.filter(c => c.kind === 'client');
    return (_jsxs("div", { style: { ...CARD, overflow: 'hidden', marginTop: 16 }, children: [_jsx("div", { style: { display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt }, children: ['estimate', 'ks2', 'ks3'].map(t => (_jsx("button", { onClick: () => setTab(t), style: { padding: '9px 20px', border: 'none', borderBottom: tab === t ? `2px solid ${C.primary}` : '2px solid transparent', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: tab === t ? 600 : 400, color: tab === t ? C.primary : C.textSec }, children: TAB_LABELS[t] }, t))) }), _jsxs("div", { style: { padding: '16px 20px' }, children: [tab === 'estimate' && (_jsxs("div", { style: { display: 'grid', gap: 10, maxWidth: 400 }, children: [_jsxs("label", { style: LBL, children: ["\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430 (\u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E)", _jsx("input", { value: estimateTitle, onChange: e => setEstimateTitle(e.target.value), placeholder: "\u0421\u043C\u0435\u0442\u0430 \u043D\u0430 \u043E\u0442\u0434\u0435\u043B\u043E\u0447\u043D\u044B\u0435 \u0440\u0430\u0431\u043E\u0442\u044B", style: { ...INPUT, marginTop: 4 } })] }), _jsxs("label", { style: LBL, children: ["\u0417\u0430\u043A\u0430\u0437\u0447\u0438\u043A (\u0434\u043B\u044F \u0448\u0430\u043F\u043A\u0438)", _jsxs("select", { value: contractorId, onChange: e => setContractorId(e.target.value), style: { ...INPUT, marginTop: 4 }, children: [_jsx("option", { value: "", children: "\u2014 \u043D\u0435 \u0443\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u2014" }), clientContractors.map(c => _jsx("option", { value: c.id, children: c.name }, c.id))] })] })] })), tab === 'ks2' && (_jsxs("div", { style: { display: 'grid', gap: 10, maxWidth: 420 }, children: [acceptances.length > 0 && (_jsxs("label", { style: LBL, children: ["\u0421\u0444\u043E\u0440\u043C\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043D\u0430 \u043E\u0441\u043D\u043E\u0432\u0435 \u0430\u043A\u0442\u0430 \u043F\u0440\u0438\u0451\u043C\u043A\u0438", _jsxs("select", { value: acceptanceId, onChange: e => setAcceptanceId(e.target.value), style: { ...INPUT, marginTop: 4 }, children: [_jsx("option", { value: "", children: "\u2014 \u0432\u0441\u0435 \u043F\u043E\u0437\u0438\u0446\u0438\u0438 \u0441\u043C\u0435\u0442\u044B \u2014" }), acceptances.map(a => (_jsxs("option", { value: a.id, children: ["\u0410\u043A\u0442 \u2116", a.act_number, " ", a.contractor_name ? `• ${a.contractor_name}` : '', " ", a.period_start ? `• ${a.period_start}–${a.period_end}` : ''] }, a.id)))] })] })), !acceptanceId && (_jsxs("label", { style: LBL, children: ["\u0417\u0430\u043A\u0430\u0437\u0447\u0438\u043A *", _jsxs("select", { value: contractorId, onChange: e => setContractorId(e.target.value), style: { ...INPUT, marginTop: 4 }, children: [_jsx("option", { value: "", children: "\u2014 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0437\u0430\u043A\u0430\u0437\u0447\u0438\u043A\u0430 \u2014" }), clientContractors.map(c => _jsx("option", { value: c.id, children: c.name }, c.id))] })] })), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }, children: [_jsxs("label", { style: LBL, children: ["\u041D\u0430\u0447\u0430\u043B\u043E \u043F\u0435\u0440\u0438\u043E\u0434\u0430", _jsx("input", { type: "date", value: periodStart, onChange: e => setPeriodStart(e.target.value), style: { ...INPUT, marginTop: 4 } })] }), _jsxs("label", { style: LBL, children: ["\u041A\u043E\u043D\u0435\u0446 \u043F\u0435\u0440\u0438\u043E\u0434\u0430", _jsx("input", { type: "date", value: periodEnd, onChange: e => setPeriodEnd(e.target.value), style: { ...INPUT, marginTop: 4 } })] })] }), !acceptanceId && _jsxs("label", { style: LBL, children: ["\u041D\u043E\u043C\u0435\u0440 \u0430\u043A\u0442\u0430", _jsx("input", { value: actNumber, onChange: e => setActNumber(e.target.value), style: { ...INPUT, marginTop: 4 } })] })] })), tab === 'ks3' && (_jsxs("div", { style: { display: 'grid', gap: 10, maxWidth: 420 }, children: [_jsxs("label", { style: LBL, children: ["\u0417\u0430\u043A\u0430\u0437\u0447\u0438\u043A *", _jsxs("select", { value: contractorId, onChange: e => setContractorId(e.target.value), style: { ...INPUT, marginTop: 4 }, children: [_jsx("option", { value: "", children: "\u2014 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0437\u0430\u043A\u0430\u0437\u0447\u0438\u043A\u0430 \u2014" }), clientContractors.map(c => _jsx("option", { value: c.id, children: c.name }, c.id))] })] }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }, children: [_jsxs("label", { style: LBL, children: ["\u041D\u0430\u0447\u0430\u043B\u043E \u043F\u0435\u0440\u0438\u043E\u0434\u0430", _jsx("input", { type: "date", value: periodStart, onChange: e => setPeriodStart(e.target.value), style: { ...INPUT, marginTop: 4 } })] }), _jsxs("label", { style: LBL, children: ["\u041A\u043E\u043D\u0435\u0446 \u043F\u0435\u0440\u0438\u043E\u0434\u0430", _jsx("input", { type: "date", value: periodEnd, onChange: e => setPeriodEnd(e.target.value), style: { ...INPUT, marginTop: 4 } })] })] }), _jsxs("label", { style: LBL, children: ["\u041D\u043E\u043C\u0435\u0440 \u0430\u043A\u0442\u0430", _jsx("input", { value: actNumber, onChange: e => setActNumber(e.target.value), style: { ...INPUT, marginTop: 4 } })] }), _jsxs("label", { style: LBL, children: ["\u0421\u0443\u043C\u043C\u0430 \u041A\u0421-2 (\u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E)", _jsx("input", { type: "number", value: ks2Amount, onChange: e => setKs2Amount(e.target.value), placeholder: "\u0410\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u0438\u0437 \u0441\u043C\u0435\u0442\u044B", style: { ...INPUT, marginTop: 4 } })] })] })), _jsx("button", { onClick: generate, disabled: generating, style: { ...btnPrimary(), marginTop: 14 }, children: generating ? '⏳ Формирование...' : '⬇ Сформировать и скачать' })] }), history.length > 0 && (_jsxs("div", { style: { borderTop: `1px solid ${C.border}`, padding: '12px 20px' }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 600, color: C.textSec, marginBottom: 8 }, children: "\u0418\u0441\u0442\u043E\u0440\u0438\u044F \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u043E\u0432" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 4 }, children: history.slice(0, 10).map(doc => (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', borderBottom: `1px solid ${C.border}` }, children: [_jsx("span", { style: { padding: '1px 7px', background: C.primaryBg, borderRadius: 10, fontSize: 11, color: C.primary }, children: DOC_KIND_LABELS[doc.doc_kind] || doc.doc_kind }), _jsx("span", { style: { fontSize: 12, flex: 1, color: C.text }, children: doc.file_name }), _jsx("span", { style: { fontSize: 11, color: C.textMuted }, children: new Date(doc.created_at).toLocaleDateString('ru-RU') }), _jsx("button", { onClick: () => reDownload(doc), style: btnGhost('sm'), children: "\u2B07" })] }, doc.id))) })] }))] }));
}
