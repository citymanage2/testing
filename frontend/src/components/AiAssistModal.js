import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import client from '../api/client';
import { C, btnPrimary, btnGhost, INPUT, OVERLAY, MODAL } from '../ui';
// ─── Suggestion chips ─────────────────────────────────────────────────────────
const CHIPS = [
    'Найти позиции с нулевыми ценами',
    'Проверить наличие разделов',
    'Найти дублирующиеся позиции',
    'Проанализировать структуру сметы',
    'Предложить разбивку по видам работ',
];
// ─── Component ────────────────────────────────────────────────────────────────
export default function AiAssistModal({ taskId, onClose }) {
    const [prompt, setPrompt] = useState('');
    const [response, setResponse] = useState('');
    const [loading, setLoading] = useState(false);
    const [usedAi, setUsedAi] = useState(false);
    // ── Submit ──────────────────────────────────────────────────────────────────
    async function handleSubmit() {
        if (!prompt.trim() || loading)
            return;
        setLoading(true);
        setResponse('');
        try {
            const { data } = await client.post(`/projects/estimates/${taskId}/ai-assist`, { prompt: prompt.trim() });
            setResponse(data.response ?? '');
            setUsedAi(data.used_ai ?? false);
        }
        catch {
            setResponse('Произошла ошибка при обращении к серверу.');
            setUsedAi(false);
        }
        finally {
            setLoading(false);
        }
    }
    // ── Key handler ─────────────────────────────────────────────────────────────
    function handleKeyDown(e) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSubmit();
        }
    }
    // ─── Render ──────────────────────────────────────────────────────────────────
    return (_jsx("div", { style: OVERLAY, onClick: (e) => { if (e.target === e.currentTarget)
            onClose(); }, children: _jsxs("div", { style: {
                ...MODAL,
                maxWidth: 600,
                maxHeight: '80vh',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
            }, children: [_jsxs("div", { style: {
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 2,
                    }, children: [_jsx("h2", { style: { margin: 0, fontSize: 16, fontWeight: 700, color: C.text }, children: "\uD83E\uDD16 \u0418\u0418-\u043F\u043E\u043C\u043E\u0449\u043D\u0438\u043A \u043F\u043E \u0441\u043C\u0435\u0442\u0435" }), _jsx("button", { style: {
                                ...btnGhost('sm'),
                                fontSize: 18,
                                lineHeight: 1,
                                padding: '2px 8px',
                                color: C.textMuted,
                            }, onClick: onClose, title: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: "\u2715" })] }), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 6 }, children: CHIPS.map((chip) => (_jsx("button", { style: {
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '5px 12px',
                            borderRadius: 99,
                            fontSize: 12,
                            fontWeight: 500,
                            cursor: 'pointer',
                            background: prompt === chip ? C.primaryBg : C.surfaceAlt,
                            color: prompt === chip ? C.primary : C.textSec,
                            border: `1px solid ${prompt === chip ? C.primary : C.border}`,
                            transition: 'all .15s',
                        }, onClick: () => setPrompt(chip), children: chip }, chip))) }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 4 }, children: [_jsx("label", { htmlFor: "ai-prompt", style: { fontSize: 13, fontWeight: 500, color: C.text }, children: "\u0417\u0430\u043F\u0440\u043E\u0441" }), _jsx("textarea", { id: "ai-prompt", rows: 6, style: {
                                ...INPUT,
                                resize: 'vertical',
                                fontFamily: 'inherit',
                                lineHeight: 1.5,
                            }, placeholder: "\u041E\u043F\u0438\u0448\u0438\u0442\u0435 \u0447\u0442\u043E \u043D\u0443\u0436\u043D\u043E \u0441\u0434\u0435\u043B\u0430\u0442\u044C \u0441\u043E \u0441\u043C\u0435\u0442\u043E\u0439...", value: prompt, onChange: (e) => setPrompt(e.target.value), onKeyDown: handleKeyDown, disabled: loading }), _jsx("span", { style: { fontSize: 11, color: C.textMuted }, children: "Ctrl+Enter \u0434\u043B\u044F \u043E\u0442\u043F\u0440\u0430\u0432\u043A\u0438" })] }), _jsx("div", { children: _jsx("button", { style: {
                            ...btnPrimary('md'),
                            opacity: loading || !prompt.trim() ? 0.6 : 1,
                            cursor: loading || !prompt.trim() ? 'not-allowed' : 'pointer',
                        }, disabled: loading || !prompt.trim(), onClick: handleSubmit, children: loading ? (_jsxs("span", { style: { display: 'inline-flex', alignItems: 'center', gap: 6 }, children: [_jsx(LoadingDots, {}), " \u0410\u043D\u0430\u043B\u0438\u0437\u0438\u0440\u0443\u044E..."] })) : ('🔍 Анализировать') }) }), response && (_jsxs("div", { style: {
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                    }, children: [_jsx("div", { children: usedAi ? (_jsx("span", { style: {
                                    display: 'inline-block',
                                    padding: '2px 10px',
                                    borderRadius: 99,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    background: C.primaryBg,
                                    color: C.primary,
                                    border: `1px solid ${C.primary}`,
                                }, children: "\u2728 \u041E\u0442\u0432\u0435\u0442 \u0418\u0418" })) : (_jsx("span", { style: {
                                    display: 'inline-block',
                                    padding: '2px 10px',
                                    borderRadius: 99,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    background: C.surfaceAlt,
                                    color: C.textSec,
                                    border: `1px solid ${C.border}`,
                                }, children: "\u2699\uFE0F \u0410\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0430\u043D\u0430\u043B\u0438\u0437" })) }), _jsx("div", { style: {
                                whiteSpace: 'pre-wrap',
                                background: C.surfaceAlt,
                                border: `1px solid ${C.border}`,
                                borderRadius: 6,
                                padding: '12px 14px',
                                fontSize: 13,
                                color: C.text,
                                lineHeight: 1.6,
                                overflowX: 'auto',
                            }, children: response }), !usedAi && (_jsxs("p", { style: {
                                margin: 0,
                                fontSize: 11,
                                color: C.textMuted,
                                lineHeight: 1.5,
                            }, children: ["\u0414\u043B\u044F \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u043D\u043E\u0433\u043E \u0430\u043D\u0430\u043B\u0438\u0437\u0430 \u0441 \u0418\u0418 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u0435 \u043F\u0435\u0440\u0435\u043C\u0435\u043D\u043D\u0443\u044E", ' ', _jsx("code", { style: {
                                        fontFamily: 'monospace',
                                        background: C.surfaceAlt,
                                        padding: '1px 5px',
                                        borderRadius: 3,
                                        border: `1px solid ${C.border}`,
                                    }, children: "ANTHROPIC_API_KEY" })] }))] }))] }) }));
}
// ─── Loading dots animation ───────────────────────────────────────────────────
function LoadingDots() {
    return (_jsxs("span", { style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
        }, children: [[0, 1, 2].map((i) => (_jsx("span", { style: {
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: '#fff',
                    display: 'inline-block',
                    animation: `aiDotBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                } }, i))), _jsx("style", { children: `
        @keyframes aiDotBounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%            { transform: scale(1);   opacity: 1;   }
        }
      ` })] }));
}
