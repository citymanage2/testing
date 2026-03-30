import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import client from '../api/client';

interface CardData {
  id: string; name: string; description?: string; address?: string;
  client_id?: string; client_name?: string;
  start_date?: string; end_date?: string;
  status?: string; budget_planned?: number; notes?: string;
  gallery_count: number; created_at: string; updated_at: string;
}
interface GalleryMeta { id: number; file_name: string; mime_type: string; caption?: string; uploaded_at: string; }
interface Payment { id: string; direction: string; amount: number; paid_at: string; description?: string; contractor_id?: string; contractor_name?: string; created_at: string; }
interface FinSummary { budget_planned?: number; estimate_total: number; income_received: number; expenses_paid: number; balance: number; budget_remaining?: number; }
interface Contractor { id: string; kind: string; name: string; }
interface TaskInProject { id: string; task_type: string; status: string; estimate_status?: string; name?: string; created_at: string; }

const STATUS_LABELS: Record<string, string> = { active: 'В работе', paused: 'Приостановлен', completed: 'Завершён', cancelled: 'Отменён' };
const STATUS_COLORS: Record<string, string> = { active: '#2e7d32', paused: '#e65100', completed: '#1565c0', cancelled: '#757575' };

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [card, setCard] = useState<CardData | null>(null);
  const [gallery, setGallery] = useState<GalleryMeta[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [finSummary, setFinSummary] = useState<FinSummary | null>(null);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [tasks, setTasks] = useState<TaskInProject[]>([]);
  const [tab, setTab] = useState<'info' | 'gallery' | 'finance' | 'estimates'>('info');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<CardData>>({});
  const [saving, setSaving] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [payForm, setPayForm] = useState({ direction: 'income', amount: '', paid_at: new Date().toISOString().slice(0, 10), description: '', contractor_id: '' });
  const [showPayForm, setShowPayForm] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  async function loadAll() {
    if (!id) return;
    try {
      const [cardR, galleryR, paymentsR, finR, contractorsR, detailR] = await Promise.all([
        client.get<CardData>(`/projects/${id}/card`),
        client.get<GalleryMeta[]>(`/projects/${id}/gallery`),
        client.get<Payment[]>(`/projects/${id}/payments`),
        client.get<FinSummary>(`/projects/${id}/financial-summary`),
        client.get<Contractor[]>('/contractors'),
        client.get<{ tasks: TaskInProject[] }>(`/projects/${id}`),
      ]);
      setCard(cardR.data);
      setForm(cardR.data);
      setGallery(galleryR.data);
      setPayments(paymentsR.data);
      setFinSummary(finR.data);
      setContractors(contractorsR.data);
      setTasks(detailR.data.tasks || []);
    } catch { navigate('/task/create'); }
  }

  useEffect(() => { loadAll(); }, [id]);

  async function saveCard() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      await client.patch(`/projects/${id}/card`, payload);
      setEditing(false);
      loadAll();
    } finally { setSaving(false); }
  }

  async function uploadImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      const fd = new FormData(); fd.append('file', file);
      try { await client.post(`/projects/${id}/gallery`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); }
      catch (err: any) { alert(err?.response?.data?.detail || 'Ошибка загрузки'); }
    }
    loadAll();
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  }

  async function deleteImage(imgId: number) {
    if (!confirm('Удалить фото?')) return;
    await client.delete(`/projects/${id}/gallery/${imgId}`);
    setGallery(g => g.filter(x => x.id !== imgId));
  }

  async function addPayment() {
    await client.post(`/projects/${id}/payments`, {
      direction: payForm.direction,
      amount: parseFloat(payForm.amount),
      paid_at: payForm.paid_at,
      description: payForm.description || undefined,
      contractor_id: payForm.contractor_id || undefined,
    });
    setShowPayForm(false);
    setPayForm({ direction: 'income', amount: '', paid_at: new Date().toISOString().slice(0, 10), description: '', contractor_id: '' });
    loadAll();
  }

  async function deletePayment(pid: string) {
    if (!confirm('Удалить платёж?')) return;
    await client.delete(`/projects/${id}/payments/${pid}`);
    loadAll();
  }

  if (!card) return <div style={{ padding: 24 }}>Загрузка...</div>;

  const clientContractors = contractors.filter(c => c.kind === 'client');

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          {editing ? (
            <input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              style={{ fontSize: 22, fontWeight: 600, border: '1px solid #1976d2', borderRadius: 4, padding: '4px 8px', width: '100%' }} />
          ) : (
            <h2 style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {card.name}
              <span style={{ fontSize: 13, padding: '2px 10px', borderRadius: 12, background: STATUS_COLORS[card.status || 'active'], color: '#fff' }}>{STATUS_LABELS[card.status || 'active']}</span>
            </h2>
          )}
          {card.address && !editing && <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>📍 {card.address}</div>}
          {card.client_name && !editing && <div style={{ fontSize: 13, color: '#666' }}>👤 {card.client_name}</div>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {editing ? (
            <>
              <button onClick={saveCard} disabled={saving} style={btn('#1565c0')}>{saving ? 'Сохранение...' : 'Сохранить'}</button>
              <button onClick={() => { setEditing(false); setForm(card); }} style={btn('#757575')}>Отмена</button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} style={btn('#546e7a')}>✎ Редактировать</button>
          )}
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div style={{ background: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: 6, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <label style={lbl}>Адрес<input value={form.address || ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} style={inp} /></label>
            <label style={lbl}>Заказчик
              <select value={form.client_id || ''} onChange={e => setForm(f => ({ ...f, client_id: e.target.value || undefined }))} style={inp}>
                <option value="">— не указан —</option>
                {clientContractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label style={lbl}>Дата начала<input type="date" value={form.start_date || ''} onChange={e => setForm(f => ({ ...f, start_date: e.target.value || undefined }))} style={inp} /></label>
            <label style={lbl}>Дата окончания<input type="date" value={form.end_date || ''} onChange={e => setForm(f => ({ ...f, end_date: e.target.value || undefined }))} style={inp} /></label>
            <label style={lbl}>Статус
              <select value={form.status || 'active'} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inp}>
                {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label style={lbl}>Плановый бюджет ₽<input type="number" value={form.budget_planned || ''} onChange={e => setForm(f => ({ ...f, budget_planned: parseFloat(e.target.value) || undefined }))} style={inp} /></label>
          </div>
          <label style={{ ...lbl, marginTop: 10 }}>Описание<textarea value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} style={{ ...inp, resize: 'vertical' }} /></label>
          <label style={{ ...lbl, marginTop: 6 }}>Примечания<textarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ ...inp, resize: 'vertical' }} /></label>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e0e0e0', marginBottom: 20 }}>
        {([['info', 'Информация'], ['gallery', `Фото (${card.gallery_count})`], ['finance', 'Финансы'], ['estimates', `Сметы (${tasks.length})`]] as const).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '8px 20px', border: 'none', borderBottom: tab === t ? '2px solid #1565c0' : '2px solid transparent', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: tab === t ? 600 : 400, color: tab === t ? '#1565c0' : '#555', marginBottom: -2 }}>
            {l}
          </button>
        ))}
      </div>

      {/* Info tab */}
      {tab === 'info' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {[
            ['Статус', STATUS_LABELS[card.status || 'active']],
            ['Адрес', card.address || '—'],
            ['Заказчик', card.client_name || '—'],
            ['Начало', card.start_date || '—'],
            ['Окончание', card.end_date || '—'],
            ['Плановый бюджет', card.budget_planned ? fmt(card.budget_planned) + ' ₽' : '—'],
          ].map(([label, value]) => (
            <div key={label} style={{ background: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: 6, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{value}</div>
            </div>
          ))}
          {card.notes && (
            <div style={{ gridColumn: '1 / -1', background: '#fffde7', border: '1px solid #fff176', borderRadius: 6, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>Примечания</div>
              <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{card.notes}</div>
            </div>
          )}
        </div>
      )}

      {/* Gallery tab */}
      {tab === 'gallery' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
            <button onClick={() => galleryInputRef.current?.click()} style={btn('#1565c0')}>+ Загрузить фото</button>
            <span style={{ fontSize: 12, color: '#888' }}>PNG/JPEG/WebP, макс. 5MB, до 20 фото</span>
            <input ref={galleryInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={uploadImages} />
          </div>
          {gallery.length === 0
            ? <div style={{ padding: 32, textAlign: 'center', color: '#aaa' }}>Нет фотографий</div>
            : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                {gallery.map(img => (
                  <div key={img.id} style={{ position: 'relative', border: '1px solid #e0e0e0', borderRadius: 6, overflow: 'hidden' }}>
                    <img src={`/api/projects/${id}/gallery/${img.id}`} alt={img.caption || img.file_name}
                      style={{ width: '100%', height: 140, objectFit: 'cover', cursor: 'pointer', display: 'block' }}
                      onClick={() => setLightbox(img.id)} />
                    {img.caption && <div style={{ padding: '4px 8px', fontSize: 11, color: '#555', background: '#fafafa' }}>{img.caption}</div>}
                    <button onClick={() => deleteImage(img.id)} style={{ position: 'absolute', top: 4, right: 4, padding: '2px 6px', background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          {lightbox !== null && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setLightbox(null)}>
              <img src={`/api/projects/${id}/gallery/${lightbox}`} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 4 }} />
            </div>
          )}
        </div>
      )}

      {/* Finance tab */}
      {tab === 'finance' && finSummary && (
        <div>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
            {([
              ['Смета (с НДС)', finSummary.estimate_total, '#1565c0'],
              ['Плановый бюджет', finSummary.budget_planned ?? null, '#546e7a'],
              ['Получено доходов', finSummary.income_received, '#2e7d32'],
              ['Оплачено расходов', finSummary.expenses_paid, '#c62828'],
              ['Баланс', finSummary.balance, finSummary.balance >= 0 ? '#2e7d32' : '#c62828'],
              ['Остаток бюджета', finSummary.budget_remaining ?? null, finSummary.budget_remaining !== null && finSummary.budget_remaining !== undefined && finSummary.budget_remaining >= 0 ? '#2e7d32' : '#c62828'],
            ] as [string, number | null, string][]).map(([label, value, color]) => value !== null && (
              <div key={label} style={{ background: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: 6, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: '#888' }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color }}>{fmt(value)} ₽</div>
              </div>
            ))}
          </div>

          {/* Payments table */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Платежи</h3>
            <button onClick={() => setShowPayForm(v => !v)} style={btn('#1565c0')}>+ Добавить</button>
          </div>

          {showPayForm && (
            <div style={{ background: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: 6, padding: 14, marginBottom: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                <label style={lbl}>Тип
                  <select value={payForm.direction} onChange={e => setPayForm(f => ({ ...f, direction: e.target.value }))} style={inp}>
                    <option value="income">Доход</option>
                    <option value="expense">Расход</option>
                  </select>
                </label>
                <label style={lbl}>Сумма ₽ *<input type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} style={inp} /></label>
                <label style={lbl}>Дата<input type="date" value={payForm.paid_at} onChange={e => setPayForm(f => ({ ...f, paid_at: e.target.value }))} style={inp} /></label>
                <label style={lbl}>Контрагент
                  <select value={payForm.contractor_id} onChange={e => setPayForm(f => ({ ...f, contractor_id: e.target.value }))} style={inp}>
                    <option value="">— не указан —</option>
                    {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label style={{ ...lbl, gridColumn: '1 / -1' }}>Описание<input value={payForm.description} onChange={e => setPayForm(f => ({ ...f, description: e.target.value }))} style={inp} /></label>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={addPayment} disabled={!payForm.amount} style={btn('#2e7d32')}>Добавить</button>
                <button onClick={() => setShowPayForm(false)} style={btn('#757575')}>Отмена</button>
              </div>
            </div>
          )}

          {payments.length === 0
            ? <div style={{ padding: 24, textAlign: 'center', color: '#aaa' }}>Нет платежей</div>
            : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    {['Дата', 'Тип', 'Сумма', 'Контрагент', 'Описание', ''].map(h => (
                      <th key={h} style={{ padding: '7px 10px', border: '1px solid #e0e0e0', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id}>
                      <td style={td}>{p.paid_at}</td>
                      <td style={td}><span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: p.direction === 'income' ? '#e8f5e9' : '#ffebee', color: p.direction === 'income' ? '#2e7d32' : '#c62828' }}>{p.direction === 'income' ? '↑ Доход' : '↓ Расход'}</span></td>
                      <td style={{ ...td, fontWeight: 600, color: p.direction === 'income' ? '#2e7d32' : '#c62828' }}>{fmt(p.amount)} ₽</td>
                      <td style={td}>{p.contractor_name || '—'}</td>
                      <td style={td}>{p.description || '—'}</td>
                      <td style={td}><button onClick={() => deletePayment(p.id)} style={{ padding: '2px 6px', fontSize: 11, border: '1px solid #ef9a9a', borderRadius: 4, cursor: 'pointer', background: '#ffebee', color: '#c62828' }}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      )}

      {/* Estimates tab */}
      {tab === 'estimates' && (
        <div>
          {tasks.length === 0
            ? <div style={{ padding: 32, textAlign: 'center', color: '#aaa' }}>Нет смет в проекте</div>
            : tasks.map(t => (
              <Link key={t.id} to={`/task/${t.id}/estimate`} style={{ display: 'block', padding: '10px 14px', border: '1px solid #e0e0e0', borderRadius: 6, marginBottom: 8, textDecoration: 'none', color: 'inherit', background: '#fafafa' }}>
                <div style={{ fontWeight: 500 }}>{(t as any).name || `Смета ${t.id.slice(0, 8)}`}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Статус: {t.estimate_status || 'не указан'} · {new Date(t.created_at).toLocaleDateString('ru-RU')}</div>
              </Link>
            ))}
        </div>
      )}
    </div>
  );
}

function fmt(v: number) { return v.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
const td: React.CSSProperties = { padding: '6px 10px', border: '1px solid #e0e0e0', verticalAlign: 'middle' };
const lbl: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 13 };
const inp: React.CSSProperties = { padding: '6px 10px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13 };
function btn(bg: string): React.CSSProperties { return { padding: '7px 16px', background: bg, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }; }
