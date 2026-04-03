import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import client from '../api/client';
function fmt(v) {
    return v.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export default function Ks2Preview() {
    const { taskId, accId } = useParams();
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [downloading, setDownloading] = useState(false);
    useEffect(() => {
        if (!taskId || !accId)
            return;
        client
            .get(`/projects/estimates/${taskId}/acceptances/${accId}/ks2-data`)
            .then(({ data: d }) => setData(d))
            .catch((e) => {
            const detail = e?.response?.data?.detail;
            setError(detail ? String(detail).slice(0, 500) : 'Ошибка загрузки данных КС-2');
        });
    }, [taskId, accId]);
    async function downloadExcel() {
        if (!taskId || !accId)
            return;
        setDownloading(true);
        try {
            const resp = await client.get(`/projects/estimates/${taskId}/acceptances/${accId}/export-ks2`, { responseType: 'blob' });
            const url = URL.createObjectURL(resp.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ks2_act_${data?.act_number ?? '1'}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        }
        catch (e) {
            const blob = e?.response?.data;
            if (blob instanceof Blob) {
                const txt = await blob.text().catch(() => '');
                try {
                    const j = JSON.parse(txt);
                    alert('Ошибка КС-2: ' + String(j.detail || txt).slice(0, 400));
                }
                catch {
                    alert('Ошибка генерации КС-2: ' + txt.slice(0, 400));
                }
            }
            else {
                alert('Ошибка генерации КС-2');
            }
        }
        finally {
            setDownloading(false);
        }
    }
    const cellStyle = {
        border: '1px solid #ccc',
        padding: '5px 8px',
        fontSize: 12,
        fontFamily: 'Arial, sans-serif',
    };
    const headerCell = {
        ...cellStyle,
        fontWeight: 700,
        background: '#f0f0f0',
        textAlign: 'center',
    };
    return (_jsxs("div", { style: { fontFamily: 'Arial, sans-serif', padding: 24, maxWidth: 1100, margin: '0 auto' }, children: [_jsx("style", { children: `
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
        }
      ` }), _jsxs("div", { className: "no-print", style: { display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }, children: [_jsx("button", { onClick: () => window.print(), style: {
                            padding: '8px 18px', background: '#1a73e8', color: '#fff',
                            border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600,
                        }, children: "\u041F\u0435\u0447\u0430\u0442\u0430\u0442\u044C" }), _jsx("button", { onClick: downloadExcel, disabled: downloading || !data, style: {
                            padding: '8px 18px', background: downloading ? '#aaa' : '#0f9d58', color: '#fff',
                            border: 'none', borderRadius: 6, cursor: downloading ? 'not-allowed' : 'pointer',
                            fontSize: 14, fontWeight: 600,
                        }, children: downloading ? 'Загрузка...' : 'Выгрузить Excel' }), _jsx("button", { onClick: () => window.close(), style: {
                            padding: '8px 14px', background: 'transparent', color: '#666',
                            border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer', fontSize: 13,
                        }, children: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C" })] }), error && (_jsx("div", { style: { background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, padding: 16, color: '#b91c1c', whiteSpace: 'pre-wrap', fontSize: 13 }, children: error })), !data && !error && (_jsx("p", { style: { color: '#666', fontSize: 14 }, children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0434\u0430\u043D\u043D\u044B\u0445..." })), data && (_jsxs("div", { children: [_jsxs("div", { style: { textAlign: 'center', marginBottom: 12 }, children: [_jsx("div", { style: { fontSize: 16, fontWeight: 700, marginBottom: 4 }, children: "\u0410\u041A\u0422 \u043E \u043F\u0440\u0438\u0451\u043C\u043A\u0435 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u043D\u044B\u0445 \u0440\u0430\u0431\u043E\u0442 (\u0444\u043E\u0440\u043C\u0430 \u041A\u0421-2)" }), _jsxs("div", { style: { fontSize: 13, color: '#444' }, children: ["\u041F\u043E\u0434\u0440\u044F\u0434\u0447\u0438\u043A: ", _jsx("b", { children: data.contractor_name }), "\u00A0\u00A0 \u0410\u043A\u0442 \u2116: ", _jsx("b", { children: data.act_number }), "\u00A0\u00A0 \u041F\u0435\u0440\u0438\u043E\u0434: ", _jsx("b", { children: data.period })] })] }), _jsxs("table", { style: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }, children: [_jsxs("colgroup", { children: [_jsx("col", { style: { width: 36 } }), _jsx("col", {}), _jsx("col", { style: { width: 52 } }), _jsx("col", { style: { width: 88 } }), _jsx("col", { style: { width: 88 } }), _jsx("col", { style: { width: 88 } }), _jsx("col", { style: { width: 100 } }), _jsx("col", { style: { width: 100 } }), _jsx("col", { style: { width: 100 } })] }), _jsx("thead", { children: _jsx("tr", { children: ['№', 'Наименование работ', 'Ед.изм.', 'Кол-во по дог.', 'Выполнено',
                                        'Цена за ед.', 'Ст-ть работ', 'Ст-ть матер.', 'Итого'].map((h) => (_jsx("th", { style: headerCell, children: h }, h))) }) }), _jsxs("tbody", { children: [data.items.map((item) => (_jsxs("tr", { children: [_jsx("td", { style: { ...cellStyle, textAlign: 'center' }, children: item.idx }), _jsx("td", { style: cellStyle, children: item.name }), _jsx("td", { style: { ...cellStyle, textAlign: 'center' }, children: item.unit }), _jsx("td", { style: { ...cellStyle, textAlign: 'right' }, children: item.qty_contract }), _jsx("td", { style: { ...cellStyle, textAlign: 'right' }, children: item.qty_accepted }), _jsx("td", { style: { ...cellStyle, textAlign: 'right' }, children: fmt(item.unit_price) }), _jsx("td", { style: { ...cellStyle, textAlign: 'right' }, children: fmt(item.work_val) }), _jsx("td", { style: { ...cellStyle, textAlign: 'right' }, children: fmt(item.mat_val) }), _jsx("td", { style: { ...cellStyle, textAlign: 'right' }, children: fmt(item.total_val) })] }, item.idx))), _jsxs("tr", { children: [_jsx("td", { colSpan: 6, style: { ...cellStyle, fontWeight: 700, textAlign: 'right', background: '#f8f8f8' }, children: "\u0418\u0422\u041E\u0413\u041E:" }), _jsx("td", { style: { ...cellStyle, fontWeight: 700, textAlign: 'right', background: '#f8f8f8' }, children: fmt(data.total_work) }), _jsx("td", { style: { ...cellStyle, fontWeight: 700, textAlign: 'right', background: '#f8f8f8' }, children: fmt(data.total_mat) }), _jsx("td", { style: { ...cellStyle, fontWeight: 700, textAlign: 'right', background: '#f8f8f8' }, children: fmt(data.grand_total) })] })] })] }), _jsx("div", { style: { marginTop: 24, fontSize: 13, color: '#555' }, children: _jsxs("div", { children: ["\u0418\u0442\u043E\u0433\u043E \u0441\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u043D\u044B\u0445 \u0440\u0430\u0431\u043E\u0442: ", _jsxs("b", { children: [fmt(data.grand_total), " \u0440\u0443\u0431."] })] }) })] }))] }));
}
