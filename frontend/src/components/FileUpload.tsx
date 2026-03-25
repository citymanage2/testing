import { useRef, DragEvent, ChangeEvent } from 'react';

interface Props {
  files: File[];
  onChange: (files: File[]) => void;
  maxFiles?: number;
  maxSizeMb?: number;
}

export default function FileUpload({ files, onChange, maxFiles = 5, maxSizeMb = 50 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function validateAndAdd(incoming: File[]) {
    const errors: string[] = [];
    const valid: File[] = [];

    for (const file of incoming) {
      if (files.length + valid.length >= maxFiles) {
        errors.push(`Максимум ${maxFiles} файлов`);
        break;
      }
      if (file.size > maxSizeMb * 1024 * 1024) {
        errors.push(`Файл "${file.name}" превышает ${maxSizeMb} МБ`);
        continue;
      }
      valid.push(file);
    }

    if (errors.length > 0) {
      alert(errors.join('\n'));
    }

    if (valid.length > 0) {
      onChange([...files, ...valid]);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    validateAndAdd(Array.from(e.dataTransfer.files));
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      validateAndAdd(Array.from(e.target.files));
      e.target.value = '';
    }
  }

  function removeFile(index: number) {
    onChange(files.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => inputRef.current?.click()}
        style={{
          border: '2px dashed #ccc',
          borderRadius: 8,
          padding: 24,
          textAlign: 'center',
          cursor: 'pointer',
          background: '#fafafa',
          color: '#666',
          marginBottom: 8,
        }}
      >
        <p style={{ margin: 0 }}>Перетащите файлы сюда или нажмите для выбора</p>
        <p style={{ margin: '4px 0 0', fontSize: 12 }}>
          Максимум {maxFiles} файлов, каждый до {maxSizeMb} МБ
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      {files.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {files.map((file, i) => (
            <li
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 8px',
                border: '1px solid #e0e0e0',
                borderRadius: 4,
                marginBottom: 4,
                background: '#fff',
              }}
            >
              <span style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file.name} ({(file.size / (1024 * 1024)).toFixed(1)} МБ)
              </span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                style={{
                  marginLeft: 8,
                  border: 'none',
                  background: 'none',
                  color: '#f44336',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: 16,
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
