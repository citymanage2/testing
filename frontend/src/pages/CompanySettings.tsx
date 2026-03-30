import { useEffect, useRef, useState } from 'react';
import client from '../api/client';

interface Settings {
  id?: string; name: string; inn: string; kpp: string; ogrn: string; address: string; has_logo?: boolean;
}

export default function CompanySettings() {
  const [form, setForm] = useState<Settings>({ name: '', inn: '', kpp: '', ogrn: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    client.get<Settings>('/company/settings')
      .then(r => {
        setForm({ name: r.data.name || '', inn: r.data.inn || '', kpp: r.data.kpp || '', ogrn: r.data.ogrn || '', address: r.data.address || '' });
        if (r.data.has_logo) setLogoPreview('/api/company/settings/logo');
      })
      .catch(() => {});
    // Also try to load logo
    client.get('/company/settings/logo', { responseType: 'blob' })
      .then(r => setLogoPreview(URL.createObjectURL(r.data)))
      .catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    try {
      await client.put('/company/settings', form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      await client.post('/company/settings/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setLogoPreview(URL.createObjectURL(file));
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Ошибка загрузки');
    } finally {
      setLogoUploading(false);
    }
  }

  function f(key: keyof Settings) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }));
  }

  return (
    <div style={{ padding: 32, maxWidth: 640 }}>
      <h2 style={{ marginTop: 0 }}>Реквизиты компании</h2>

      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', marginBottom: 24 }}>
        <div style={{ flex: 1, display: 'grid', gap: 12 }}>
          {([
            ['Наименование компании', 'name'],
            ['ИНН', 'inn'],
            ['КПП', 'kpp'],
            ['ОГРН / ОГРНИП', 'ogrn'],
          ] as [string, keyof Settings][]).map(([label, key]) => (
            <label key={key} style={lbl}>
              {label}
              <input value={form[key] as string} onChange={f(key)} style={inp} />
            </label>
          ))}
          <label style={lbl}>
            Юридический адрес
            <textarea value={form.address} onChange={f('address')} rows={2} style={{ ...inp, resize: 'vertical' }} />
          </label>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 140, height: 100, border: '2px dashed #ccc', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#fafafa' }}>
            {logoPreview
              ? <img src={logoPreview} alt="Лого" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              : <span style={{ fontSize: 12, color: '#aaa', textAlign: 'center', padding: 8 }}>Логотип<br/>не загружен</span>}
          </div>
          <button onClick={() => logoRef.current?.click()} disabled={logoUploading} style={btnStyle('#546e7a')}>
            {logoUploading ? 'Загрузка...' : 'Загрузить логотип'}
          </button>
          <span style={{ fontSize: 11, color: '#888', textAlign: 'center' }}>PNG/JPEG, макс. 512KB</span>
          <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={uploadLogo} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button onClick={save} disabled={saving} style={btnStyle('#1565c0')}>
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
        {saved && <span style={{ color: '#2e7d32', fontSize: 13 }}>✓ Сохранено</span>}
      </div>

      <div style={{ marginTop: 24, padding: 14, background: '#f9f9f9', borderRadius: 6, border: '1px solid #e0e0e0', fontSize: 12, color: '#666' }}>
        Реквизиты используются при автоматическом формировании документов: PDF-сметы, КС-2, КС-3, договоров.
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 13 };
const inp: React.CSSProperties = { padding: '6px 10px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13 };
function btnStyle(bg: string): React.CSSProperties {
  return { padding: '7px 18px', background: bg, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 };
}
