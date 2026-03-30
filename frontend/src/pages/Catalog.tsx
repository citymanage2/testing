import { useEffect, useState, useRef } from 'react';
import client from '../api/client';
import { C, btnPrimary, btnOutline, btnDanger, btnGhost, INPUT, LBL, CARD, TH, TD, OVERLAY, MODAL } from '../ui';

interface Entry {
  id: string; item_type: string; name: string; unit?: string;
  work_price: number; mat_price: number; tags?: string[];
  created_at: string; updated_at: string;
}

const empty = { item_type: 'work', name: '', unit: '', work_price: '0', mat_price: '0', tags: '' };

export default function Catalog() {
  const [list, setList] = useState<Entry[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...empty });
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; updated: number; errors: string[] } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  async function load(q?: string) {
    const params: Record<string, string> = {};
    if (q) params.q = q;
    if (typeFilter !== 'all') params.item_type = typeFilter;
    params.limit = '200';
    const r = await client.get<Entry[]>('/catalog', { params });
    setList(r.data);
  }

  useEffect(() => { load(search || undefined); }, [search, typeFilter]);

  function openAdd() { setForm({ ...empty }); setEditId(null); setShowForm(true); }
  function openEdit(e: Entry) {
    setForm({ item_type: e.item_type, name: e.name, unit: e.unit || '', work_price: String(e.work_price), mat_price: String(e.mat_price), tags: (e.tags || []).join(', ') });
    setEditId(e.id);
    setShowForm(true);
  }

  async function save() {
    setSaving(true);
    const body = { item_type: form.item_type, name: form.name, unit: form.unit || undefined, work_price: parseFloat(form.work_price) || 0, mat_price: parseFloat(form.mat_price) || 0, tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [] };
    try {
      if (editId) await client.put(`/catalog/${editId}`, body);
      else await client.post('/catalog', body);
      setShowForm(false);
      load(search || undefined);
    } finally { setSaving(false); }
  }

  async function del(id: string) {
    if (!confirm('Удалить запись из каталога?')) return;
    await client.delete(`/catalog/${id}`);
    load(search || undefined);
  }

  async function downloadTemplate() {
    const resp = await client.get('/catalog/template', { responseType: 'blob' });
    const url = URL.createObjectURL(resp.data);
    const a = document.createElement('a'); a.href = url; a.download = 'catalog_template.xlsx'; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await client.post<{ imported: number; updated: number; errors: string[] }>('/catalog/import-excel', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setImportResult(r.data);
      load(search || undefined);
    } catch {
      setImportResult({ imported: 0, updated: 0, errors: ['Ошибка загрузки файла'] });
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = '';
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ ...CARD, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.text, flex: 1 }}>Корпоративный каталог расценок</h2>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={downloadTemplate} style={btnGhost('sm')} title="Скачать шаблон Excel">⬇ Шаблон</button>
            <label style={{ ...btnOutline('sm'), cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
              {importing ? '⏳ Импорт...' : '📥 Импорт Excel'}
              <input ref={importRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleImport} disabled={importing} />
            </label>
            <button onClick={openAdd} style={btnPrimary('sm')}>+ Добавить</button>
          </div>
        </div>

        {importResult && (
          <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, background: importResult.errors.length > 0 ? C.warningBg : C.successBg, border: `1px solid ${importResult.errors.length > 0 ? C.warning : C.success}40`, fontSize: 13 }}>
            ✅ Импортировано: {importResult.imported}, обновлено: {importResult.updated}
            {importResult.errors.length > 0 && <div style={{ color: C.warning, marginTop: 4 }}>Ошибки: {importResult.errors.join('; ')}</div>}
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 2, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: 3 }}>
          {[['all', 'Все'], ['work', 'Работы'], ['material', 'Материалы']].map(([v, l]) => (
            <button key={v} onClick={() => setTypeFilter(v)}
              style={{ padding: '4px 12px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: typeFilter === v ? 600 : 400, background: typeFilter === v ? C.surface : 'transparent', color: typeFilter === v ? C.primary : C.textSec, boxShadow: typeFilter === v ? '0 1px 3px rgba(0,0,0,.1)' : 'none' }}>
              {l}
            </button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Поиск по названию..."
          style={{ ...INPUT, width: 260 }} />
        <span style={{ fontSize: 12, color: C.textMuted }}>{list.length} записей</span>
      </div>

      {/* Table */}
      {list.length === 0
        ? <div style={{ ...CARD, padding: 40, textAlign: 'center', color: C.textMuted }}>Каталог пуст. Добавьте записи вручную, скачайте шаблон и импортируйте из Excel, или сохраняйте строки из смет.</div>
        : (
          <div style={{ overflowX: 'auto', borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Тип', 'Наименование', 'Ед.', 'Цена работ', 'Цена мат.', 'Теги', 'Обновлено', ''].map(h => (
                    <th key={h} style={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map(e => (
                  <tr key={e.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={TD}>
                      <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: e.item_type === 'work' ? C.primaryBg : C.successBg, color: e.item_type === 'work' ? C.primary : C.success, fontWeight: 600 }}>
                        {e.item_type === 'work' ? 'Работа' : 'Материал'}
                      </span>
                    </td>
                    <td style={{ ...TD, fontWeight: 500, maxWidth: 340 }}>{e.name}</td>
                    <td style={TD}>{e.unit || '—'}</td>
                    <td style={TD}>{e.work_price > 0 ? fmt(e.work_price) : '—'}</td>
                    <td style={TD}>{e.mat_price > 0 ? fmt(e.mat_price) : '—'}</td>
                    <td style={TD}>{(e.tags || []).map(t => <span key={t} style={{ marginRight: 4, padding: '1px 6px', background: C.primaryBg, color: C.primary, borderRadius: 10, fontSize: 11 }}>{t}</span>)}</td>
                    <td style={{ ...TD, fontSize: 11, color: C.textMuted, whiteSpace: 'nowrap' }}>{new Date(e.updated_at || e.created_at).toLocaleDateString('ru-RU')}</td>
                    <td style={TD}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => openEdit(e)} style={btnGhost('sm')}>✎</button>
                        <button onClick={() => del(e.id)} style={{ ...btnDanger('sm'), padding: '2px 6px' }}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {/* Add/Edit modal */}
      {showForm && (
        <div style={OVERLAY}>
          <div style={{ ...MODAL, maxWidth: 480 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>{editId ? 'Редактировать' : 'Добавить'} расценку</h3>
            <div style={{ display: 'grid', gap: 10 }}>
              <label style={LBL}>Тип
                <select value={form.item_type} onChange={e => setForm(f => ({ ...f, item_type: e.target.value }))} style={{ ...INPUT, marginTop: 4 }}>
                  <option value="work">Работа</option>
                  <option value="material">Материал</option>
                </select>
              </label>
              <label style={LBL}>Наименование *
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ ...INPUT, marginTop: 4 }} />
              </label>
              <label style={LBL}>Единица измерения
                <input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} style={{ ...INPUT, marginTop: 4 }} />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={LBL}>Цена работ ₽<input type="number" value={form.work_price} onChange={e => setForm(f => ({ ...f, work_price: e.target.value }))} style={{ ...INPUT, marginTop: 4 }} /></label>
                <label style={LBL}>Цена мат. ₽<input type="number" value={form.mat_price} onChange={e => setForm(f => ({ ...f, mat_price: e.target.value }))} style={{ ...INPUT, marginTop: 4 }} /></label>
              </div>
              <label style={LBL}>Теги (через запятую)
                <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} style={{ ...INPUT, marginTop: 4 }} placeholder="укладка, плитка, санузел" />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={save} disabled={saving || !form.name.trim()} style={btnPrimary()}>{saving ? 'Сохранение...' : 'Сохранить'}</button>
              <button onClick={() => setShowForm(false)} style={btnOutline()}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function fmt(v: number) { return v.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
