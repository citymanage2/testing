import { useRef } from 'react';

interface Props {
  files: File[];
  onChange: (files: File[]) => void;
  maxFiles?: number;
  maxSizeMb?: number;
}

export default function FileUpload({ files, onChange, maxFiles = 5, maxSizeMb = 50 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    addFiles(Array.from(e.dataTransfer.files));
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(e.target.files || []));
    e.target.value = '';
  }

  function addFiles(incoming: File[]) {
    const errors: string[] = [];
    const valid = incoming.filter((f) => {
      if (f.size > maxSizeMb * 1024 * 1024) { errors.push(`${f.name}: превышает ${maxSizeMb}МБ`); return false; }
      return true;
    });
    const next = [...files, ...valid].slice(0, maxFiles);
    if (errors.length) alert(errors.join('\n'));
    onChange(next);
  }

  return (
    <div>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{ border: '2px dashed #90caf9', borderRadius: 6, padding: '20px', textAlign: 'center', cursor: 'pointer', background: '#f5f9ff', color: '#555', fontSize: 14 }}
      >
        Перетащите файлы или кликните для выбора (макс. {maxFiles} файлов, {maxSizeMb}МБ)
      </div>
      <input ref={inputRef} type="file" multiple style={{ display: 'none' }} onChange={handleChange} />
      {files.length > 0 && (
        <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none' }}>
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', background: '#f0f4ff', borderRadius: 4, marginBottom: 4, fontSize: 13 }}>
              <span>{f.name} ({(f.size / 1024).toFixed(0)} KB)</span>
              <button onClick={() => onChange(files.filter((_, j) => j !== i))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#f44336', fontSize: 16 }}>×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
