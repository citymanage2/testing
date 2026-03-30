import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import client from '../api/client';
export default function CompanySettings() {
    const [form, setForm] = useState({ name: '', inn: '', kpp: '', ogrn: '', address: '' });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [logoPreview, setLogoPreview] = useState(null);
    const [logoUploading, setLogoUploading] = useState(false);
    const logoRef = useRef(null);
    useEffect(() => {
        client.get('/company/settings')
            .then(r => {
            setForm({ name: r.data.name || '', inn: r.data.inn || '', kpp: r.data.kpp || '', ogrn: r.data.ogrn || '', address: r.data.address || '' });
            if (r.data.has_logo)
                setLogoPreview('/api/company/settings/logo');
        })
            .catch(() => { });
        // Also try to load logo
        client.get('/company/settings/logo', { responseType: 'blob' })
            .then(r => setLogoPreview(URL.createObjectURL(r.data)))
            .catch(() => { });
    }, []);
    async function save() {
        setSaving(true);
        try {
            await client.put('/company/settings', form);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        }
        finally {
            setSaving(false);
        }
    }
    async function uploadLogo(e) {
        const file = e.target.files?.[0];
        if (!file)
            return;
        setLogoUploading(true);
        const fd = new FormData();
        fd.append('file', file);
        try {
            await client.post('/company/settings/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            setLogoPreview(URL.createObjectURL(file));
        }
        catch (err) {
            alert(err?.response?.data?.detail || 'Ошибка загрузки');
        }
        finally {
            setLogoUploading(false);
        }
    }
    function f(key) {
        return (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));
    }
    return (_jsxs("div", { style: { padding: 32, maxWidth: 640 }, children: [_jsx("h2", { style: { marginTop: 0 }, children: "\u0420\u0435\u043A\u0432\u0438\u0437\u0438\u0442\u044B \u043A\u043E\u043C\u043F\u0430\u043D\u0438\u0438" }), _jsxs("div", { style: { display: 'flex', gap: 32, alignItems: 'flex-start', marginBottom: 24 }, children: [_jsxs("div", { style: { flex: 1, display: 'grid', gap: 12 }, children: [[
                                ['Наименование компании', 'name'],
                                ['ИНН', 'inn'],
                                ['КПП', 'kpp'],
                                ['ОГРН / ОГРНИП', 'ogrn'],
                            ].map(([label, key]) => (_jsxs("label", { style: lbl, children: [label, _jsx("input", { value: form[key], onChange: f(key), style: inp })] }, key))), _jsxs("label", { style: lbl, children: ["\u042E\u0440\u0438\u0434\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0430\u0434\u0440\u0435\u0441", _jsx("textarea", { value: form.address, onChange: f('address'), rows: 2, style: { ...inp, resize: 'vertical' } })] })] }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }, children: [_jsx("div", { style: { width: 140, height: 100, border: '2px dashed #ccc', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#fafafa' }, children: logoPreview
                                    ? _jsx("img", { src: logoPreview, alt: "\u041B\u043E\u0433\u043E", style: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' } })
                                    : _jsxs("span", { style: { fontSize: 12, color: '#aaa', textAlign: 'center', padding: 8 }, children: ["\u041B\u043E\u0433\u043E\u0442\u0438\u043F", _jsx("br", {}), "\u043D\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D"] }) }), _jsx("button", { onClick: () => logoRef.current?.click(), disabled: logoUploading, style: btnStyle('#546e7a'), children: logoUploading ? 'Загрузка...' : 'Загрузить логотип' }), _jsx("span", { style: { fontSize: 11, color: '#888', textAlign: 'center' }, children: "PNG/JPEG, \u043C\u0430\u043A\u0441. 512KB" }), _jsx("input", { ref: logoRef, type: "file", accept: "image/png,image/jpeg,image/webp", style: { display: 'none' }, onChange: uploadLogo })] })] }), _jsxs("div", { style: { display: 'flex', gap: 10, alignItems: 'center' }, children: [_jsx("button", { onClick: save, disabled: saving, style: btnStyle('#1565c0'), children: saving ? 'Сохранение...' : 'Сохранить' }), saved && _jsx("span", { style: { color: '#2e7d32', fontSize: 13 }, children: "\u2713 \u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E" })] }), _jsx("div", { style: { marginTop: 24, padding: 14, background: '#f9f9f9', borderRadius: 6, border: '1px solid #e0e0e0', fontSize: 12, color: '#666' }, children: "\u0420\u0435\u043A\u0432\u0438\u0437\u0438\u0442\u044B \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u044E\u0442\u0441\u044F \u043F\u0440\u0438 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u043C \u0444\u043E\u0440\u043C\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0438 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u043E\u0432: PDF-\u0441\u043C\u0435\u0442\u044B, \u041A\u0421-2, \u041A\u0421-3, \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u043E\u0432." })] }));
}
const lbl = { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 13 };
const inp = { padding: '6px 10px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13 };
function btnStyle(bg) {
    return { padding: '7px 18px', background: bg, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 };
}
