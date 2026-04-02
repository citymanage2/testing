import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import client from '../api/client';
import ProjectDocuments from '../components/ProjectDocuments';
import SubcontractorContracts from '../components/SubcontractorContracts';
import WorkSchedule from '../components/WorkSchedule';
import ClientActsManager from '../components/ClientActsManager';
import PurchaseRequests from '../components/PurchaseRequests';
import WarrantyClaims from '../components/WarrantyClaims';
import KpRequests from '../components/KpRequests';
import { C, btnPrimary, btnOutline, btnDanger, btnGhost, badge, INPUT, LBL, CARD, TH, TD, OVERLAY, MODAL } from '../ui';

interface CardData {
  id: string; name: string; description?: string; address?: string;
  client_id?: string; client_name?: string;
  start_date?: string; end_date?: string;
  status?: string; budget_planned?: number; notes?: string;
  gallery_count: number; created_at: string; updated_at: string;
  // lifecycle
  stage?: string; construction_type?: string;
  sales_manager_id?: string; project_manager_id?: string;
  contract_number?: string; contract_date?: string;
}
interface GalleryMeta { id: number; file_name: string; mime_type: string; caption?: string; uploaded_at: string; }
interface Payment { id: string; direction: string; amount: number; paid_at: string; description?: string; contractor_id?: string; contractor_name?: string; created_at: string; }
interface FinSummary { budget_planned?: number; estimate_total: number; income_received: number; expenses_paid: number; balance: number; budget_remaining?: number; }
interface Contractor { id: string; kind: string; name: string; }
interface TaskInProject { id: string; task_type: string; status: string; estimate_status?: string; name?: string; created_at: string; }
interface StageInfo { stage: string; stage_label: string; allowed_next_stages: string[]; }

const STAGE_ORDER = ['LEAD','ESTIMATION','OPTIMIZATION','APPROVAL','EXECUTION','HANDOVER','WARRANTY','CLOSED'];

const STAGE_LABELS: Record<string, string> = {
  LEAD: 'Лид/Продажа', ESTIMATION: 'Осмечивание', OPTIMIZATION: 'Оптимизация',
  APPROVAL: 'Согласование КП', EXECUTION: 'Реализация', HANDOVER: 'Сдача объекта',
  WARRANTY: 'Гарантийный период', CLOSED: 'Закрыт',
};

const STAGE_COLORS: Record<string, string> = {
  LEAD: C.textMuted, ESTIMATION: C.warning, OPTIMIZATION: '#7c3aed',
  APPROVAL: C.primary, EXECUTION: '#0891b2', HANDOVER: '#16a34a',
  WARRANTY: '#b45309', CLOSED: C.textMuted,
};
const CONSTRUCTION_TYPES = ['Новое строительство', 'Реконструкция', 'Ремонт', 'Прочее'];
type TabType = 'info' | 'docs' | 'contracts' | 'schedule' | 'acts' | 'purchases' | 'gallery' | 'finance' | 'estimates' | 'warranty' | 'kp';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [card, setCard] = useState<CardData | null>(null);
  const [stageInfo, setStageInfo] = useState<StageInfo | null>(null);
  const [gallery, setGallery] = useState<GalleryMeta[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [finSummary, setFinSummary] = useState<FinSummary | null>(null);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [tasks, setTasks] = useState<TaskInProject[]>([]);
  const [tab, setTab] = useState<TabType>('info');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<CardData>>({});
  const [saving, setSaving] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [payForm, setPayForm] = useState({ direction: 'income', amount: '', paid_at: new Date().toISOString().slice(0, 10), description: '', contractor_id: '' });
  const [showPayForm, setShowPayForm] = useState(false);
  const [showStageModal, setShowStageModal] = useState(false);
  const [stageReason, setStageReason] = useState('');
  const [pendingStage, setPendingStage] = useState('');
  const [suggestions, setSuggestions] = useState<{stage: string; label: string; ready: boolean; condition_hint: string}[]>([]);
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
      setCard(cardR.data); setForm(cardR.data);
      setGallery(galleryR.data); setPayments(paymentsR.data);
      setFinSummary(finR.data); setContractors(contractorsR.data);
      setTasks(detailR.data.tasks || []);
      // Load stage info
      try {
        const stageR = await client.get<StageInfo>(`/projects/${id}/stage`);
        setStageInfo(stageR.data);
      } catch {}
      // Load stage suggestions
      client.get(`/projects/${id}/stage-suggestions`).then(r => setSuggestions(r.data.suggestions)).catch(() => {});
    } catch { navigate('/task/create'); }
  }

  useEffect(() => { loadAll(); }, [id]);

  async function saveCard() {
    setSaving(true);
    try {
      await client.patch(`/projects/${id}/card`, form);
      // Also update lifecycle details if changed
      await client.patch(`/projects/${id}/details`, {
        construction_type: form.construction_type,
        contract_number: form.contract_number,
        contract_date: form.contract_date,
      }).catch(() => {});
      setEditing(false); loadAll();
    } finally { setSaving(false); }
  }

  async function doStageTransition() {
    if (!pendingStage) return;
    try {
      await client.post(`/projects/${id}/stage`, { stage: pendingStage, reason: stageReason || undefined });
      setShowStageModal(false); setStageReason(''); setPendingStage('');
      loadAll();
    } catch (e: any) { alert(e?.response?.data?.detail || 'Ошибка перехода стадии'); }
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

  async function addPayment() {
    await client.post(`/projects/${id}/payments`, { direction: payForm.direction, amount: parseFloat(payForm.amount), paid_at: payForm.paid_at, description: payForm.description || undefined, contractor_id: payForm.contractor_id || undefined });
    setShowPayForm(false);
    setPayForm({ direction: 'income', amount: '', paid_at: new Date().toISOString().slice(0, 10), description: '', contractor_id: '' });
    loadAll();
  }

  if (!card) return <div style={{ padding: 24, color: C.textSec }}>Загрузка...</div>;

  const clientContractors = contractors.filter(c => c.kind === 'client');
  const stageBg = STAGE_COLORS[stageInfo?.stage || card.stage || 'LEAD'];
  const currentStage = stageInfo?.stage || card.stage || '';
  const stageIdx = STAGE_ORDER.indexOf(currentStage);
  const atLeast = (s: string) => stageIdx < 0 || stageIdx >= STAGE_ORDER.indexOf(s);

  const ALL_TABS: [TabType, string][] = [
    ['info',      '📋 Информация'],
    ['docs',      '📁 Документы'],
    ['estimates', `📐 Сметы (${tasks.length})`],
    ['finance',   '💰 Финансы'],
    ['kp',        '📊 Оптимизация КП'],
    ...(atLeast('ESTIMATION') ? [['schedule', '📅 ГПР'] as [TabType, string]] : []),
    ...(atLeast('APPROVAL')   ? [['contracts', '📄 Договоры'] as [TabType, string]] : []),
    ...(atLeast('EXECUTION')  ? [
      ['acts',      '✅ Акты КС-2'],
      ['purchases', '🛒 Закупки'],
      ['gallery',   `🖼 Фото (${card.gallery_count})`],
    ] as [TabType, string][] : []),
    ...(atLeast('WARRANTY')   ? [['warranty', '🛡 Гарантия'] as [TabType, string]] : []),
  ];
  const TABS = ALL_TABS;

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* ── Header ── */}
      <div style={{ ...CARD, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            {editing ? (
              <input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                style={{ ...INPUT, fontSize: 20, fontWeight: 600 }} />
            ) : (
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {card.name}
                {stageInfo && <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 12, background: stageBg + '22', color: stageBg, border: `1px solid ${stageBg}44`, fontWeight: 600 }}>{stageInfo.stage_label}</span>}
              </h2>
            )}
            <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap', fontSize: 13, color: C.textSec }}>
              {card.address && <span>📍 {card.address}</span>}
              {card.client_name && <span>👤 {card.client_name}</span>}
              {card.contract_number && <span>📋 Договор №{card.contract_number}</span>}
              {card.start_date && <span>🗓 {card.start_date}{card.end_date ? ` — ${card.end_date}` : ''}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {editing ? (
              <>
                <button onClick={saveCard} disabled={saving} style={btnPrimary('sm')}>{saving ? 'Сохранение...' : 'Сохранить'}</button>
                <button onClick={() => { setEditing(false); setForm(card); }} style={btnOutline('sm')}>Отмена</button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} style={btnGhost('sm')}>✎ Редактировать</button>
            )}
          </div>
        </div>

        {/* Edit form */}
        {editing && (
          <div style={{ marginTop: 14, padding: '14px 0', borderTop: `1px solid ${C.border}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              <label style={LBL}>Адрес<input value={form.address || ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} style={{ ...INPUT, marginTop: 4 }} /></label>
              <label style={LBL}>Заказчик
                <select value={form.client_id || ''} onChange={e => setForm(f => ({ ...f, client_id: e.target.value || undefined }))} style={{ ...INPUT, marginTop: 4 }}>
                  <option value="">— не указан —</option>
                  {clientContractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label style={LBL}>Тип строительства
                <select value={form.construction_type || ''} onChange={e => setForm(f => ({ ...f, construction_type: e.target.value || undefined }))} style={{ ...INPUT, marginTop: 4 }}>
                  <option value="">— не указан —</option>
                  {CONSTRUCTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label style={LBL}>Номер договора<input value={form.contract_number || ''} onChange={e => setForm(f => ({ ...f, contract_number: e.target.value || undefined }))} style={{ ...INPUT, marginTop: 4 }} /></label>
              <label style={LBL}>Дата договора<input type="date" value={form.contract_date || ''} onChange={e => setForm(f => ({ ...f, contract_date: e.target.value || undefined }))} style={{ ...INPUT, marginTop: 4 }} /></label>
              <label style={LBL}>Дата начала<input type="date" value={form.start_date || ''} onChange={e => setForm(f => ({ ...f, start_date: e.target.value || undefined }))} style={{ ...INPUT, marginTop: 4 }} /></label>
              <label style={LBL}>Дата окончания<input type="date" value={form.end_date || ''} onChange={e => setForm(f => ({ ...f, end_date: e.target.value || undefined }))} style={{ ...INPUT, marginTop: 4 }} /></label>
              <label style={LBL}>Плановый бюджет ₽<input type="number" value={form.budget_planned || ''} onChange={e => setForm(f => ({ ...f, budget_planned: parseFloat(e.target.value) || undefined }))} style={{ ...INPUT, marginTop: 4 }} /></label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
              <label style={LBL}>Описание<textarea value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} style={{ ...INPUT, marginTop: 4, resize: 'vertical' }} /></label>
              <label style={LBL}>Примечания<textarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ ...INPUT, marginTop: 4, resize: 'vertical' }} /></label>
            </div>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: 4, marginBottom: 16 }}>
        {TABS.map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t ? 600 : 400, background: tab === t ? C.surface : 'transparent', color: tab === t ? C.primary : C.textSec, boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,.1)' : 'none', whiteSpace: 'nowrap' }}>
            {l}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      {tab === 'info' && (
        <div>
        {/* Stage Stepper */}
        <div style={{ ...CARD, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: C.text }}>Стадии проекта</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {STAGE_ORDER.map((stage, idx) => {
              const currentIdx = STAGE_ORDER.indexOf(stageInfo?.stage || 'LEAD');
              const isCompleted = idx < currentIdx;
              const isCurrent = idx === currentIdx;
              const isFuture = idx > currentIdx;
              const suggestion = suggestions.find(s => s.stage === stage);
              const isAllowed = stageInfo?.allowed_next_stages?.includes(stage);

              return (
                <div key={stage} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '8px 0', borderBottom: idx < STAGE_ORDER.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  {/* Circle indicator */}
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700,
                    background: isCompleted ? C.success : isCurrent ? C.primary : C.surfaceAlt,
                    color: isCompleted || isCurrent ? '#fff' : C.textMuted,
                    border: `2px solid ${isCompleted ? C.success : isCurrent ? C.primary : C.border}`,
                  }}>
                    {isCompleted ? '✓' : idx + 1}
                  </div>
                  {/* Label + action */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: isCurrent ? 700 : 500, color: isFuture && !isAllowed ? C.textMuted : C.text }}>
                        {STAGE_LABELS[stage]}
                      </span>
                      {isCurrent && <span style={badge(C.primary, C.primaryBg)}>Текущая</span>}
                      {isAllowed && !isCurrent && (
                        <span style={badge(suggestion?.ready ? C.success : C.warning, suggestion?.ready ? C.successBg : C.warningBg)}>
                          {suggestion?.ready ? '✅ Готово' : '⚠️ Условия'}
                        </span>
                      )}
                    </div>
                    {isAllowed && !isCurrent && (
                      <button
                        style={{ ...btnOutline('sm'), marginTop: 4 }}
                        title={suggestion?.condition_hint}
                        onClick={() => { setPendingStage(stage); setShowStageModal(true); }}
                      >
                        Перейти →
                      </button>
                    )}
                    {isAllowed && suggestion && !suggestion.ready && (
                      <div style={{ fontSize: 11, color: C.warning, marginTop: 2 }}>{suggestion.condition_hint}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {[
            ['Стадия проекта', stageInfo?.stage_label || '—'],
            ['Тип строительства', card.construction_type || '—'],
            ['Адрес', card.address || '—'],
            ['Заказчик', card.client_name || '—'],
            ['Договор №', card.contract_number || '—'],
            ['Дата договора', card.contract_date || '—'],
            ['Начало', card.start_date || '—'],
            ['Окончание', card.end_date || '—'],
            ['Плановый бюджет', card.budget_planned ? fmt(card.budget_planned) + ' ₽' : '—'],
          ].map(([label, value]) => (
            <div key={label} style={{ ...CARD, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{value}</div>
            </div>
          ))}
          {card.notes && (
            <div style={{ ...CARD, gridColumn: '1 / -1', padding: '10px 14px', background: C.warningBg, border: `1px solid ${C.warning}22` }}>
              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 3 }}>Примечания</div>
              <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', color: C.text }}>{card.notes}</div>
            </div>
          )}
        </div>
        </div>
      )}

      {tab === 'docs' && id && <ProjectDocuments projectId={id} />}
      {tab === 'contracts' && id && <SubcontractorContracts projectId={id} />}
      {tab === 'schedule' && id && <WorkSchedule projectId={id} />}
      {tab === 'acts' && id && <ClientActsManager projectId={id} />}
      {tab === 'purchases' && id && <PurchaseRequests projectId={id} />}
      {tab === 'warranty' && <WarrantyClaims projectId={id!} />}
      {tab === 'kp' && <KpRequests projectId={id!} />}

      {tab === 'gallery' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
            <button onClick={() => galleryInputRef.current?.click()} style={btnPrimary('sm')}>+ Загрузить фото</button>
            <span style={{ fontSize: 12, color: C.textMuted }}>PNG/JPEG/WebP, макс. 5MB</span>
            <input ref={galleryInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={uploadImages} />
          </div>
          {gallery.length === 0
            ? <div style={{ ...CARD, padding: 40, textAlign: 'center', color: C.textMuted }}>Нет фотографий</div>
            : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                {gallery.map(img => (
                  <div key={img.id} style={{ position: 'relative', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                    <img src={`/api/projects/${id}/gallery/${img.id}`} alt={img.caption || img.file_name}
                      style={{ width: '100%', height: 140, objectFit: 'cover', cursor: 'pointer', display: 'block' }}
                      onClick={() => setLightbox(img.id)} />
                    {img.caption && <div style={{ padding: '4px 8px', fontSize: 11, color: C.textSec }}>{img.caption}</div>}
                    <button onClick={() => { if (confirm('Удалить фото?')) client.delete(`/projects/${id}/gallery/${img.id}`).then(loadAll); }}
                      style={{ position: 'absolute', top: 4, right: 4, padding: '2px 6px', background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          {lightbox !== null && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setLightbox(null)}>
              <img src={`/api/projects/${id}/gallery/${lightbox}`} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }} />
            </div>
          )}
        </div>
      )}

      {tab === 'finance' && finSummary && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
            {([
              ['Смета (с НДС)', finSummary.estimate_total, C.primary],
              ['Плановый бюджет', finSummary.budget_planned ?? null, C.textSec],
              ['Получено доходов', finSummary.income_received, C.success],
              ['Оплачено расходов', finSummary.expenses_paid, C.danger],
              ['Баланс', finSummary.balance, finSummary.balance >= 0 ? C.success : C.danger],
              ['Остаток бюджета', finSummary.budget_remaining ?? null, (finSummary.budget_remaining ?? 0) >= 0 ? C.success : C.danger],
            ] as [string, number | null, string][]).map(([label, value, color]) => value !== null && (
              <div key={label} style={{ ...CARD, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: C.textMuted }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color, marginTop: 4 }}>{fmt(value)} ₽</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 15, color: C.text }}>Платежи</h3>
            <button onClick={() => setShowPayForm(v => !v)} style={btnPrimary('sm')}>+ Добавить</button>
          </div>
          {showPayForm && (
            <div style={{ ...CARD, padding: 14, marginBottom: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                <label style={LBL}>Тип<select value={payForm.direction} onChange={e => setPayForm(f => ({ ...f, direction: e.target.value }))} style={{ ...INPUT, marginTop: 4 }}><option value="income">Доход</option><option value="expense">Расход</option></select></label>
                <label style={LBL}>Сумма ₽<input type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} style={{ ...INPUT, marginTop: 4 }} /></label>
                <label style={LBL}>Дата<input type="date" value={payForm.paid_at} onChange={e => setPayForm(f => ({ ...f, paid_at: e.target.value }))} style={{ ...INPUT, marginTop: 4 }} /></label>
                <label style={LBL}>Контрагент<select value={payForm.contractor_id} onChange={e => setPayForm(f => ({ ...f, contractor_id: e.target.value }))} style={{ ...INPUT, marginTop: 4 }}><option value="">— не указан —</option>{contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                <label style={{ ...LBL, gridColumn: '1/-1' }}>Описание<input value={payForm.description} onChange={e => setPayForm(f => ({ ...f, description: e.target.value }))} style={{ ...INPUT, marginTop: 4 }} /></label>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={addPayment} disabled={!payForm.amount} style={btnPrimary('sm')}>Добавить</button>
                <button onClick={() => setShowPayForm(false)} style={btnOutline('sm')}>Отмена</button>
              </div>
            </div>
          )}
          {payments.length === 0
            ? <div style={{ ...CARD, padding: 24, textAlign: 'center', color: C.textMuted }}>Нет платежей</div>
            : (
              <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr>{['Дата', 'Тип', 'Сумма', 'Контрагент', 'Описание', ''].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
                  <tbody>
                    {payments.map(p => (
                      <tr key={p.id}>
                        <td style={TD}>{p.paid_at}</td>
                        <td style={TD}><span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: p.direction === 'income' ? C.successBg : C.dangerBg, color: p.direction === 'income' ? C.success : C.danger }}>{p.direction === 'income' ? '↑ Доход' : '↓ Расход'}</span></td>
                        <td style={{ ...TD, fontWeight: 600, color: p.direction === 'income' ? C.success : C.danger }}>{fmt(p.amount)} ₽</td>
                        <td style={TD}>{p.contractor_name || '—'}</td>
                        <td style={TD}>{p.description || '—'}</td>
                        <td style={TD}><button onClick={() => { if (confirm('Удалить?')) client.delete(`/projects/${id}/payments/${p.id}`).then(loadAll); }} style={{ ...btnDanger('sm'), padding: '2px 6px' }}>✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      )}

      {tab === 'estimates' && (
        <div>
          {tasks.length === 0
            ? <div style={{ ...CARD, padding: 40, textAlign: 'center', color: C.textMuted }}>Нет смет в проекте</div>
            : tasks.map(t => (
              <Link key={t.id} to={`/task/${t.id}/estimate`} style={{ display: 'block', padding: '10px 14px', border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 8, textDecoration: 'none', color: 'inherit', background: C.surfaceAlt }}>
                <div style={{ fontWeight: 500, color: C.text }}>{(t as any).name || `Смета ${t.id.slice(0, 8)}`}</div>
                <div style={{ fontSize: 12, color: C.textSec, marginTop: 2 }}>Статус: {t.estimate_status || 'не указан'} · {new Date(t.created_at).toLocaleDateString('ru-RU')}</div>
              </Link>
            ))}
        </div>
      )}

      {/* Stage transition modal */}
      {showStageModal && (
        <div style={OVERLAY}>
          <div style={{ ...MODAL, maxWidth: 400 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16 }}>Перейти на стадию: {STAGE_LABELS[pendingStage]}</h3>
            <label style={LBL}>Причина перехода (необязательно)
              <textarea value={stageReason} onChange={e => setStageReason(e.target.value)} rows={3} style={{ ...INPUT, marginTop: 4, resize: 'vertical' }} />
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={doStageTransition} style={btnPrimary()}>Подтвердить переход</button>
              <button onClick={() => setShowStageModal(false)} style={btnOutline()}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function fmt(v: number) { return v.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
