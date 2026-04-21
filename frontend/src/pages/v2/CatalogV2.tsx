import { useEffect, useState } from 'react';
import { catalogV2, priceSources, type CatalogItemV2, type PriceSource } from '../../api/v2';
import { C, T, CARD, TH, TD, INPUT, LBL, OVERLAY, MODAL, btnPrimary, btnOutline, btnDanger } from '../../ui';

const fmt = (n: number) => n.toLocaleString('ru-RU', { maximumFractionDigits: 2 });

export default function CatalogV2() {
  const [items, setItems] = useState<CatalogItemV2[]>([]);
  const [sources, setSources] = useState<PriceSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterSection, setFilterSection] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<CatalogItemV2 | null>(null);
  const [form, setForm] = useState({ name: '', unit: 'шт', work_price: '', material_price: '', section: '', source_id: '' });
  const [saving, setSaving] = useState(false);

  // Price sources tab
  const [showSources, setShowSources] = useState(false);
  const [srcForm, setSrcForm] = useState({ name: '', kind: 'manual', url: '' });
  const [addingSrc, setAddingSrc] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [its, srcs] = await Promise.all([
        catalogV2.list({ search: search || undefined, source_id: filterSource || undefined, section: filterSection || undefined }),
        priceSources.list(),
      ]);
      setItems(its);
      setSources(srcs);
    } catch {
      setError('Ошибка загрузки каталога');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [search, filterSource, filterSection]);

  function openCreate() {
    setForm({ name: '', unit: 'шт', work_price: '', material_price: '', section: '', source_id: '' });
    setEditItem(null);
    setShowCreate(true);
  }

  function openEdit(item: CatalogItemV2) {
    setForm({ name: item.name, unit: item.unit, work_price: String(item.work_price), material_price: String(item.material_price), section: item.section ?? '', source_id: item.source_id ?? '' });
    setEditItem(item);
    setShowCreate(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        unit: form.unit,
        work_price: parseFloat(form.work_price) || 0,
        material_price: parseFloat(form.material_price) || 0,
        section: form.section || undefined,
        source_id: form.source_id || undefined,
      };
      if (editItem) {
        await catalogV2.update(editItem.id, payload);
      } else {
        await catalogV2.create(payload);
      }
      setShowCreate(false);
      await load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить позицию каталога?')) return;
    try {
      await catalogV2.remove(id);
      await load();
    } catch {
      setError('Ошибка удаления');
    }
  }

  async function handleAddSource() {
    if (!srcForm.name.trim()) return;
    setAddingSrc(true);
    try {
      await priceSources.create({ name: srcForm.name, kind: srcForm.kind, url: srcForm.url || undefined });
      setSrcForm({ name: '', kind: 'manual', url: '' });
      const srcs = await priceSources.list();
      setSources(srcs);
    } catch {
      setError('Ошибка добавления источника');
    } finally {
      setAddingSrc(false);
    }
  }

  async function handleDeleteSource(id: string) {
    if (!confirm('Удалить источник цен?')) return;
    try {
      await priceSources.remove(id);
      const srcs = await priceSources.list();
      setSources(srcs);
    } catch {
      setError('Ошибка удаления источника');
    }
  }

  const sections = Array.from(new Set(items.map(i => i.section).filter(Boolean))) as string[];

  return (
    <div style={{ padding: '0 20px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={T.h1}>Каталог расценок v2</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btnOutline('md')} onClick={() => setShowSources(v => !v)}>
            {showSources ? 'Скрыть источники' : 'Источники цен'}
          </button>
          <button style={btnPrimary('md')} onClick={openCreate}>+ Добавить позицию</button>
        </div>
      </div>

      {/* Price sources panel */}
      {showSources && (
        <div style={{ ...CARD, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Источники цен</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <input style={{ ...INPUT, width: 200 }} placeholder="Название" value={srcForm.name} onChange={e => setSrcForm(f => ({ ...f, name: e.target.value }))} />
            <select style={{ ...INPUT, width: 140 }} value={srcForm.kind} onChange={e => setSrcForm(f => ({ ...f, kind: e.target.value }))}>
              <option value="manual">Ручной</option>
              <option value="fsnb">ФСНБ</option>
              <option value="supplier">Поставщик</option>
              <option value="market">Рынок</option>
            </select>
            <input style={{ ...INPUT, width: 240 }} placeholder="URL (необязательно)" value={srcForm.url} onChange={e => setSrcForm(f => ({ ...f, url: e.target.value }))} />
            <button style={btnPrimary('md')} disabled={addingSrc} onClick={handleAddSource}>
              {addingSrc ? 'Добавляю...' : '+ Добавить'}
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={TH}>Название</th><th style={TH}>Тип</th><th style={TH}>URL</th><th style={{ ...TH, width: 60 }}></th></tr></thead>
            <tbody>
              {sources.length === 0 && <tr><td colSpan={4} style={{ ...TD, color: C.textMuted, textAlign: 'center', padding: 24 }}>Нет источников</td></tr>}
              {sources.map(s => (
                <tr key={s.id}>
                  <td style={TD}>{s.name}</td>
                  <td style={TD}>{s.kind}</td>
                  <td style={{ ...TD, color: C.textSec, fontSize: 12 }}>{s.url ?? '—'}</td>
                  <td style={TD}><button style={btnDanger('sm')} onClick={() => handleDeleteSource(s.id)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Filters */}
      <div style={{ ...CARD, marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={{ ...INPUT, width: 240 }} placeholder="Поиск по названию..." value={search} onChange={e => setSearch(e.target.value)} />
        <select style={{ ...INPUT, width: 200 }} value={filterSection} onChange={e => setFilterSection(e.target.value)}>
          <option value="">Все разделы</option>
          {sections.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select style={{ ...INPUT, width: 200 }} value={filterSource} onChange={e => setFilterSource(e.target.value)}>
          <option value="">Все источники</option>
          {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {error && <span style={{ color: C.danger, fontSize: 13 }}>{error}</span>}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ color: C.textSec, padding: 24 }}>Загрузка...</div>
      ) : (
        <div style={CARD}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH}>Наименование</th>
                <th style={TH}>Раздел</th>
                <th style={TH}>Ед.</th>
                <th style={{ ...TH, textAlign: 'right' }}>Работы (₽)</th>
                <th style={{ ...TH, textAlign: 'right' }}>Материалы (₽)</th>
                <th style={{ ...TH, textAlign: 'right' }}>Итого (₽)</th>
                <th style={TH}>Источник</th>
                <th style={{ ...TH, width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={8} style={{ ...TD, color: C.textMuted, textAlign: 'center', padding: 32 }}>Нет позиций</td></tr>}
              {items.map(item => (
                <tr key={item.id} onMouseEnter={e => (e.currentTarget.style.background = C.surfaceHover)} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <td style={TD}>{item.name}</td>
                  <td style={{ ...TD, color: C.textSec }}>{item.section ?? '—'}</td>
                  <td style={TD}>{item.unit}</td>
                  <td style={{ ...TD, textAlign: 'right' }}>{fmt(item.work_price)}</td>
                  <td style={{ ...TD, textAlign: 'right' }}>{fmt(item.material_price)}</td>
                  <td style={{ ...TD, textAlign: 'right', fontWeight: 600 }}>{fmt(item.work_price + item.material_price)}</td>
                  <td style={{ ...TD, color: C.textSec }}>
                    {sources.find(s => s.id === item.source_id)?.name ?? '—'}
                  </td>
                  <td style={TD}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button style={btnOutline('sm')} onClick={() => openEdit(item)}>✏</button>
                      <button style={btnDanger('sm')} onClick={() => handleDelete(item.id)}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit modal */}
      {showCreate && (
        <div style={OVERLAY} onClick={() => setShowCreate(false)}>
          <div style={MODAL} onClick={e => e.stopPropagation()}>
            <h2 style={{ ...T.h2, marginBottom: 20 }}>{editItem ? 'Редактировать позицию' : 'Новая позиция каталога'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={LBL}>Наименование<input style={INPUT} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></label>
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ ...LBL, flex: 1 }}>Ед. изм.<input style={INPUT} value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} /></label>
                <label style={{ ...LBL, flex: 1 }}>Раздел<input style={INPUT} value={form.section} onChange={e => setForm(f => ({ ...f, section: e.target.value }))} placeholder="Необязательно" /></label>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ ...LBL, flex: 1 }}>Работы (₽)<input style={INPUT} type="number" value={form.work_price} onChange={e => setForm(f => ({ ...f, work_price: e.target.value }))} /></label>
                <label style={{ ...LBL, flex: 1 }}>Материалы (₽)<input style={INPUT} type="number" value={form.material_price} onChange={e => setForm(f => ({ ...f, material_price: e.target.value }))} /></label>
              </div>
              <label style={LBL}>
                Источник цен
                <select style={INPUT} value={form.source_id} onChange={e => setForm(f => ({ ...f, source_id: e.target.value }))}>
                  <option value="">— без источника —</option>
                  {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={btnOutline('md')} onClick={() => setShowCreate(false)}>Отмена</button>
              <button style={btnPrimary('md')} disabled={saving} onClick={handleSave}>{saving ? 'Сохраняю...' : 'Сохранить'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
