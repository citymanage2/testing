import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useRef } from 'react';
export default function FileUpload({ files, onChange, maxFiles = 5, maxSizeMb = 50 }) {
    const inputRef = useRef(null);
    function handleDrop(e) {
        e.preventDefault();
        addFiles(Array.from(e.dataTransfer.files));
    }
    function handleChange(e) {
        addFiles(Array.from(e.target.files || []));
        e.target.value = '';
    }
    function addFiles(incoming) {
        const errors = [];
        const valid = incoming.filter((f) => {
            if (f.size > maxSizeMb * 1024 * 1024) {
                errors.push(`${f.name}: превышает ${maxSizeMb}МБ`);
                return false;
            }
            return true;
        });
        const next = [...files, ...valid].slice(0, maxFiles);
        if (errors.length)
            alert(errors.join('\n'));
        onChange(next);
    }
    return (_jsxs("div", { children: [_jsxs("div", { onDragOver: (e) => e.preventDefault(), onDrop: handleDrop, onClick: () => inputRef.current?.click(), style: { border: '2px dashed #90caf9', borderRadius: 6, padding: '20px', textAlign: 'center', cursor: 'pointer', background: '#f5f9ff', color: '#555', fontSize: 14 }, children: ["\u041F\u0435\u0440\u0435\u0442\u0430\u0449\u0438\u0442\u0435 \u0444\u0430\u0439\u043B\u044B \u0438\u043B\u0438 \u043A\u043B\u0438\u043A\u043D\u0438\u0442\u0435 \u0434\u043B\u044F \u0432\u044B\u0431\u043E\u0440\u0430 (\u043C\u0430\u043A\u0441. ", maxFiles, " \u0444\u0430\u0439\u043B\u043E\u0432, ", maxSizeMb, "\u041C\u0411)"] }), _jsx("input", { ref: inputRef, type: "file", multiple: true, style: { display: 'none' }, onChange: handleChange }), files.length > 0 && (_jsx("ul", { style: { margin: '8px 0 0', padding: 0, listStyle: 'none' }, children: files.map((f, i) => (_jsxs("li", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', background: '#f0f4ff', borderRadius: 4, marginBottom: 4, fontSize: 13 }, children: [_jsxs("span", { children: [f.name, " (", (f.size / 1024).toFixed(0), " KB)"] }), _jsx("button", { onClick: () => onChange(files.filter((_, j) => j !== i)), style: { border: 'none', background: 'none', cursor: 'pointer', color: '#f44336', fontSize: 16 }, children: "\u00D7" })] }, `${f.name}-${i}`))) }))] }));
}
