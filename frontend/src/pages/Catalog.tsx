import { useEffect, useState } from 'react';
import client from '../api/client';

interface Entry {
  id: string; item_type: string; name: string; unit?: string;
  work_price: number; mat_price: number; tags?: string[]; created_at: string;
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

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Корпоративный каталог расценок</h2>
        <button onClick={openAdd} style={btn('#1565c0')}>+ Добавить</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {[['all', 'Все'], ['work', 'Работы'], ['material', 'Материалы']].map(([v, l]) => (
          <button key={v} onClick={() => setTypeFilter(v)}
            style={{ padding: '4px 14px', borderRadius: 4, border: '1px solid #ccc', background: typeFilter === v ? '#1565c0' : '#fff', color: typeFilter === v ? '#fff' : '#333', cursor: 'pointer', fontSize: 13 }}>
            {l}
          </button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по названию..."
          style={{ padding: '4px 10px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13, minWidth: 240 }} />
        <span style={{ fontSize: 12, color: '#888', marginLeft: 4 }}>{list.length} записей</span>
      </div>

      {list.length === 0
        ? <div style={{ padding: 32, textAlign: 'center', color: '#aaa' }}>Каталог пуст. Добавьте записи вручную или сохраняйте строки из смет.</div>
        : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  {['Тип', 'Наименование', 'Ед.', 'Цена работ', 'Цена мат.', 'Теги', ''].map(h => (
                    <th key={h} style={{ padding: '8px 10px', border: '1px solid #e0e0e0', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map(e => (
                  <tr key={e.id}>
                    <td style={td}><span style={{ padding: '2px 7px', borderRadius: 10, fontSize: 11, background: e.item_type === 'work' ? '#1565c0' : '#2e7d32', color: '#fff' }}>{e.item_type === 'work' ? 'Работа' : 'Материал'}</span></td>
                    <td style={{ ...td, fontWeight: 500, maxWidth: 320 }}>{e.name}</td>
                    <td style={td}>{e.unit || '—'}</td>
                    <td style={td}>{e.work_price > 0 ? fmt(e.work_price) : '—'}</td>
                    <td style={td}>{e.mat_price > 0 ? fmt(e.mat_price) : '—'}</td>
                    <td style={td}>{(e.tags || []).map(t => <span key={t} style={{ marginRight: 4, padding: '1px 5px', background: '#e3f2fd', borderRadius: 10, fontSize: 11 }}>{t}</span>)}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => openEdit(e)} style={{ padding: '2px 8px', fontSize: 11, border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', background: '#fff' }}>✎</button>
                        <button onClick={() => del(e.id)} style={{ padding: '2px 6px', fontSize: 11, border: '1px solid #ef9a9a', borderRadius: 4, cursor: 'pointer', background: '#ffebee', color: '#c62828' }}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: '90%', maxWidth: 480 }}>
            <h3 style={{ margin: '0 0 16px' }}>{editId ? 'Редактировать' : 'Добавить'} расценку</h3>
            <div style={{ display: 'grid', gap: 10 }}>
              <label style={lbl}>Тип
                <select value={form.item_type} onChange={e => setForm(f => ({ ...f, item_type: e.target.value }))} style={inp}>
                  <option value="work">Работа</option>
                  <option value="material">Материал</option>
                </select>
              </label>
              <label style={lbl}>Наименование *<input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inp} /></label>
              <label style={lbl}>Единица измерения<input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} style={inp} /></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={lbl}>Цена работ ₽<input type="number" value={form.work_price} onChange={e => setForm(f => ({ ...f, work_price: e.target.value }))} style={inp} /></label>
                <label style={lbl}>Цена мат. ₽<input type="number" value={form.mat_price} onChange={e => setForm(f => ({ ...f, mat_price: e.target.value }))} style={inp} /></label>
              </div>
              <label style={lbl}>Теги (через запятую)<input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} style={inp} placeholder="укладка, плитка, санузел" /></label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={save} disabled={saving || !form.name.trim()} style={btn('#1565c0')}>{saving ? 'Сохранение...' : 'Сохранить'}</button>
              <button onClick={() => setShowForm(false)} style={btn('#757575')}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function fmt(v: number) { return v.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
const td: React.CSSProperties = { padding: '6px 10px', border: '1px solid #e0e0e0', verticalAlign: 'middle' };
const lbl: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 13 };
const inp: React.CSSProperties = { padding: '6px 10px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13, width: '100%', boxSizing: 'border-box' };
function btn(bg: string): React.CSSProperties { return { padding: '7px 16px', background: bg, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }; }
