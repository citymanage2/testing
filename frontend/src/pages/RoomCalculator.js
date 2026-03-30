import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import client from '../api/client';
const defaultInput = {
    length: 5, width: 4, height: 2.7,
    door_count: 1, door_width: 0.9, door_height: 2.1,
    window_count: 1, window_width: 1.2, window_height: 1.4,
    extra_opening_area: 0,
    ceiling_type: 'flat', slope_angle: 30, cornice_width: 0,
    floor_type: 'flat', floor_screed_thickness: 0.05,
    skirting_height: 0.1, extra_wall_area: 0, tile_height: 0,
};
export default function RoomCalculator() {
    const [form, setForm] = useState({ ...defaultInput });
    const [result, setResult] = useState(null);
    const [calculating, setCalculating] = useState(false);
    const [copied, setCopied] = useState(null);
    async function calculate() {
        setCalculating(true);
        try {
            const r = await client.post('/calculator/room', form);
            setResult(r.data);
        }
        catch {
            alert('Ошибка расчёта');
        }
        finally {
            setCalculating(false);
        }
    }
    function copy(label, value) {
        navigator.clipboard.writeText(String(value));
        setCopied(label);
        setTimeout(() => setCopied(null), 1500);
    }
    function n(key, value) {
        setForm(f => ({ ...f, [key]: parseFloat(value) || 0 }));
    }
    const RESULTS = [
        ['Периметр', 'perimeter', 'м'],
        ['Площадь пола', 'floor_area', 'м²'],
        ['Площадь потолка', 'ceiling_area', 'м²'],
        ['Объём помещения', 'total_volume', 'м³'],
        ['Площадь стен (валовая)', 'wall_area_gross', 'м²'],
        ['Площадь стен (за вычетом проёмов)', 'wall_area_net', 'м²'],
        ['Площадь стен под плитку', 'wall_tile_area', 'м²'],
        ['Площадь дверных проёмов', 'door_area', 'м²'],
        ['Площадь оконных проёмов', 'window_area', 'м²'],
        ['Плинтус (длина)', 'skirting_length', 'м'],
        ['Плинтус (площадь)', 'skirting_area', 'м²'],
        ['Карниз', 'cornice_area', 'м²'],
        ['Стяжка пола (объём)', 'floor_screed_volume', 'м³'],
        ['Площадь под покраску', 'paint_area_net', 'м²'],
        ['Площадь под обои', 'wallpaper_area_net', 'м²'],
    ];
    return (_jsxs("div", { style: { padding: 24, maxWidth: 960 }, children: [_jsx("h2", { style: { marginTop: 0 }, children: "\u0421\u0442\u0440\u043E\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439 \u043A\u0430\u043B\u044C\u043A\u0443\u043B\u044F\u0442\u043E\u0440" }), _jsx("p", { style: { color: '#666', fontSize: 13, marginBottom: 20 }, children: "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0440\u0430\u0437\u043C\u0435\u0440\u044B \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F \u2014 \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u0440\u0430\u0441\u0441\u0447\u0438\u0442\u0430\u0435\u0442 15 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u043E\u0432 \u043E\u0431\u044A\u0435\u043A\u0442a." }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 20 }, children: [_jsxs("div", { style: card, children: [_jsx("div", { style: cardTitle, children: "\u0413\u0430\u0431\u0430\u0440\u0438\u0442\u044B \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F" }), _jsx(Row, { label: "\u0414\u043B\u0438\u043D\u0430 (\u043C)", value: form.length, onChange: v => n('length', v) }), _jsx(Row, { label: "\u0428\u0438\u0440\u0438\u043D\u0430 (\u043C)", value: form.width, onChange: v => n('width', v) }), _jsx(Row, { label: "\u0412\u044B\u0441\u043E\u0442\u0430 \u043F\u043E\u0442\u043E\u043B\u043A\u0430 (\u043C)", value: form.height, onChange: v => n('height', v) })] }), _jsxs("div", { style: card, children: [_jsx("div", { style: cardTitle, children: "\u0414\u0432\u0435\u0440\u043D\u044B\u0435 \u043F\u0440\u043E\u0451\u043C\u044B" }), _jsx(Row, { label: "\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u0434\u0432\u0435\u0440\u0435\u0439", value: form.door_count, onChange: v => n('door_count', v), integer: true }), _jsx(Row, { label: "\u0428\u0438\u0440\u0438\u043D\u0430 \u0434\u0432\u0435\u0440\u0438 (\u043C)", value: form.door_width, onChange: v => n('door_width', v) }), _jsx(Row, { label: "\u0412\u044B\u0441\u043E\u0442\u0430 \u0434\u0432\u0435\u0440\u0438 (\u043C)", value: form.door_height, onChange: v => n('door_height', v) })] }), _jsxs("div", { style: card, children: [_jsx("div", { style: cardTitle, children: "\u041E\u043A\u043E\u043D\u043D\u044B\u0435 \u043F\u0440\u043E\u0451\u043C\u044B" }), _jsx(Row, { label: "\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u043E\u043A\u043E\u043D", value: form.window_count, onChange: v => n('window_count', v), integer: true }), _jsx(Row, { label: "\u0428\u0438\u0440\u0438\u043D\u0430 \u043E\u043A\u043D\u0430 (\u043C)", value: form.window_width, onChange: v => n('window_width', v) }), _jsx(Row, { label: "\u0412\u044B\u0441\u043E\u0442\u0430 \u043E\u043A\u043D\u0430 (\u043C)", value: form.window_height, onChange: v => n('window_height', v) }), _jsx(Row, { label: "\u041F\u0440\u043E\u0447\u0438\u0435 \u043F\u0440\u043E\u0451\u043C\u044B (\u043C\u00B2)", value: form.extra_opening_area, onChange: v => n('extra_opening_area', v) })] }), _jsxs("div", { style: card, children: [_jsx("div", { style: cardTitle, children: "\u041F\u043E\u0442\u043E\u043B\u043E\u043A" }), _jsxs("label", { style: { fontSize: 12, display: 'block', marginBottom: 6 }, children: ["\u0422\u0438\u043F \u043F\u043E\u0442\u043E\u043B\u043A\u0430", _jsxs("select", { value: form.ceiling_type, onChange: e => setForm(f => ({ ...f, ceiling_type: e.target.value })), style: { ...sel, marginLeft: 8 }, children: [_jsx("option", { value: "flat", children: "\u041F\u043B\u043E\u0441\u043A\u0438\u0439" }), _jsx("option", { value: "slope", children: "\u0421\u043A\u0430\u0442\u043D\u044B\u0439" }), _jsx("option", { value: "cornice", children: "\u0421 \u043A\u0430\u0440\u043D\u0438\u0437\u043E\u043C" })] })] }), form.ceiling_type === 'slope' && _jsx(Row, { label: "\u0423\u0433\u043E\u043B \u043D\u0430\u043A\u043B\u043E\u043D\u0430 (\u00B0)", value: form.slope_angle, onChange: v => n('slope_angle', v) }), _jsx(Row, { label: "\u0428\u0438\u0440\u0438\u043D\u0430 \u043A\u0430\u0440\u043D\u0438\u0437\u0430 (\u043C)", value: form.cornice_width, onChange: v => n('cornice_width', v) })] }), _jsxs("div", { style: card, children: [_jsx("div", { style: cardTitle, children: "\u041F\u043E\u043B \u0438 \u043E\u0442\u0434\u0435\u043B\u043A\u0430" }), _jsx(Row, { label: "\u0412\u044B\u0441\u043E\u0442\u0430 \u043F\u043B\u0438\u043D\u0442\u0443\u0441\u0430 (\u043C)", value: form.skirting_height, onChange: v => n('skirting_height', v) }), _jsx(Row, { label: "\u0422\u043E\u043B\u0449\u0438\u043D\u0430 \u0441\u0442\u044F\u0436\u043A\u0438 (\u043C)", value: form.floor_screed_thickness, onChange: v => n('floor_screed_thickness', v) }), _jsx(Row, { label: "\u0412\u044B\u0441\u043E\u0442\u0430 \u043F\u043B\u0438\u0442\u043A\u0438 \u043E\u0442 \u043F\u043E\u043B\u0430 (\u043C)", value: form.tile_height, onChange: v => n('tile_height', v) }), _jsx(Row, { label: "\u0414\u043E\u043F. \u043F\u043B\u043E\u0449\u0430\u0434\u044C \u0441\u0442\u0435\u043D (\u043D\u0438\u0448\u0438, \u043C\u00B2)", value: form.extra_wall_area, onChange: v => n('extra_wall_area', v) })] })] }), _jsx("button", { onClick: calculate, disabled: calculating, style: { padding: '10px 28px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 600 }, children: calculating ? 'Расчёт...' : 'Рассчитать' }), result && (_jsxs("div", { style: { marginTop: 24 }, children: [_jsx("h3", { style: { marginBottom: 12 }, children: "\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B \u0440\u0430\u0441\u0447\u0451\u0442\u0430" }), _jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 8 }, children: RESULTS.map(([label, key, unit]) => (_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: 6 }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 12, color: '#666' }, children: label }), _jsxs("div", { style: { fontSize: 16, fontWeight: 600 }, children: [result[key], " ", _jsx("span", { style: { fontSize: 12, color: '#888' }, children: unit })] })] }), _jsx("button", { onClick: () => copy(label, result[key]), title: "\u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435", style: { padding: '3px 8px', border: '1px solid #ccc', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 11, color: copied === label ? '#2e7d32' : '#555' }, children: copied === label ? '✓' : '⎘' })] }, key))) })] }))] }));
}
function Row({ label, value, onChange, integer }) {
    return (_jsxs("label", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 12 }, children: [_jsx("span", { children: label }), _jsx("input", { type: "number", step: integer ? '1' : '0.01', value: value, onChange: e => onChange(e.target.value), style: { width: 80, padding: '3px 6px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13, textAlign: 'right' } })] }));
}
const card = { background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6, padding: '14px 16px' };
const cardTitle = { fontWeight: 600, fontSize: 13, marginBottom: 10, color: '#1565c0' };
const sel = { padding: '3px 6px', border: '1px solid #ccc', borderRadius: 4, fontSize: 12 };
