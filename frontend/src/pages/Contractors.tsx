import { useEffect, useState } from 'react';
import client from '../api/client';

interface Contractor {
  id: string; kind: string; name: string; inn?: string; kpp?: string;
  address?: string; contact?: string; notes?: string; created_at: string;
}

const KIND_LABELS: Record<string, string> = { client: 'Заказчик', supplier: 'Поставщик', subcontractor: 'Субподрядчик' };
const KINDS = ['client', 'supplier', 'subcontractor'];

const empty = { kind: 'client', name: '', inn: '', kpp: '', address: '', contact: '', notes: '' };

export default function Contractors() {
  const [list, setList] = useState<Contractor[]>([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...empty });
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const r = await client.get<Contractor[]>('/contractors');
    setList(r.data);
  }

  useEffect(() => { load(); }, []);

  function openAdd() { setForm({ ...empty }); setEditId(null); setShowForm(true); }
  function openEdit(c: Contractor) {
    setForm({ kind: c.kind, name: c.name, inn: c.inn || '', kpp: c.kpp || '', address: c.address || '', contact: c.contact || '', notes: c.notes || '' });
    setEditId(c.id);
    setShowForm(true);
  }

  async function save() {
    setSaving(true);
    try {
      if (editId) await client.put(`/contractors/${editId}`, form);
      else await client.post('/contractors', form);
      setShowForm(false);
      load();
    } finally { setSaving(false); }
  }

  async function del(id: string) {
    if (!confirm('Удалить контрагента?')) return;
    await client.delete(`/contractors/${id}`);
    load();
  }

  const visible = list.filter(c =>
    (filter === 'all' || c.kind === filter) &&
    (!search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.inn || '').includes(search))
  );

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Контрагенты</h2>
        <button onClick={openAdd} style={btn('#1565c0')} data-tooltip="Добавить нового контрагента: заказчика, поставщика или субподрядчика">+ Добавить</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {[['all', 'Все', 'Показать всех контрагентов'], ['client', 'Заказчик', 'Показать только заказчиков'], ['supplier', 'Поставщик', 'Показать только поставщиков'], ['subcontractor', 'Субподрядчик', 'Показать только субподрядчиков']].map(([k, label, tip]) => (
          <button key={k} onClick={() => setFilter(k)}
            style={{ padding: '4px 14px', borderRadius: 4, border: '1px solid #ccc', background: filter === k ? '#1565c0' : '#fff', color: filter === k ? '#fff' : '#333', cursor: 'pointer', fontSize: 13 }}
            data-tooltip={tip}>
            {label}
          </button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по названию или ИНН..."
          style={{ padding: '4px 10px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13, minWidth: 220 }} />
      </div>

      {visible.length === 0
        ? <div style={{ padding: 32, textAlign: 'center', color: '#aaa' }}>Нет контрагентов</div>
        : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  {['Тип', 'Наименование', 'ИНН', 'КПП', 'Контакт', 'Адрес', ''].map(h => (
                    <th key={h} style={{ padding: '8px 10px', border: '1px solid #e0e0e0', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map(c => (
                  <tr key={c.id}>
                    <td style={td}><span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: kindColor(c.kind), color: '#fff' }}>{KIND_LABELS[c.kind]}</span></td>
                    <td style={{ ...td, fontWeight: 500 }}>{c.name}</td>
                    <td style={td}>{c.inn || '—'}</td>
                    <td style={td}>{c.kpp || '—'}</td>
                    <td style={td}>{c.contact || '—'}</td>
                    <td style={{ ...td, maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.address || '—'}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => openEdit(c)} style={{ padding: '2px 8px', fontSize: 11, border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', background: '#fff' }} data-tooltip="Редактировать данные контрагента: ИНН, КПП, контакты, адрес">✎</button>
                        <button onClick={() => del(c.id)} style={{ padding: '2px 6px', fontSize: 11, border: '1px solid #ef9a9a', borderRadius: 4, cursor: 'pointer', background: '#ffebee', color: '#c62828' }} data-tooltip="Удалить контрагента из системы">✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: '90%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 16px' }}>{editId ? 'Редактировать' : 'Добавить'} контрагента</h3>
            <div style={{ display: 'grid', gap: 10 }}>
              <label style={lbl}>Тип
                <select value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value }))} style={inp}>
                  {KINDS.map(k => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
                </select>
              </label>
              <label style={lbl}>Наименование *<input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inp} /></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={lbl}>ИНН<input value={form.inn} onChange={e => setForm(f => ({ ...f, inn: e.target.value }))} style={inp} /></label>
                <label style={lbl}>КПП<input value={form.kpp} onChange={e => setForm(f => ({ ...f, kpp: e.target.value }))} style={inp} /></label>
              </div>
              <label style={lbl}>Контакт (тел/email)<input value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} style={inp} /></label>
              <label style={lbl}>Адрес<input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} style={inp} /></label>
              <label style={lbl}>Примечание<textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ ...inp, resize: 'vertical' }} /></label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={save} disabled={saving || !form.name.trim()} style={btn('#1565c0')} data-tooltip="Сохранить данные контрагента">{saving ? 'Сохранение...' : 'Сохранить'}</button>
              <button onClick={() => setShowForm(false)} style={btn('#757575')} data-tooltip="Закрыть форму без сохранения">Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function kindColor(k: string) { return k === 'client' ? '#1565c0' : k === 'supplier' ? '#2e7d32' : '#6a1b9a'; }
const td: React.CSSProperties = { padding: '6px 10px', border: '1px solid #e0e0e0', verticalAlign: 'middle' };
const lbl: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 13 };
const inp: React.CSSProperties = { padding: '6px 10px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13, width: '100%', boxSizing: 'border-box' };
function btn(bg: string): React.CSSProperties { return { padding: '7px 16px', background: bg, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }; }
