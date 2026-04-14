import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import client from '../api/client';
import ProjectDocuments from '../components/ProjectDocuments';
import SubcontractorContracts from '../components/SubcontractorContracts';
import WorkSchedule from '../components/WorkSchedule';
import ClientActsManager from '../components/ClientActsManager';
import PurchaseRequests from '../components/PurchaseRequests';
import WarrantyClaims from '../components/WarrantyClaims';
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
interface FinSummary { budget_planned?: number; estimate_total: number; client_total: number; subcontractor_total: number; profit: number; income_received: number; expenses_paid: number; balance: number; budget_remaining?: number; }
interface Contractor { id: string; kind: string; name: string; }
interface TaskInProject { id: string; task_type: string; status: string; estimate_status?: string; estimate_type?: string; parent_estimate_id?: string; calculation_method?: string; name?: string; created_at: string; }
interface EstimateWithTotal { id: string; name?: string; estimate_type?: string; parent_estimate_id?: string; calculation_method?: string; estimate_status?: string; created_at: string; total: number; }
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
type TabType = 'info' | 'docs' | 'schedule' | 'acts' | 'purchases' | 'gallery' | 'finance' | 'estimates' | 'warranty';

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
  const [pmNameInput, setPmNameInput] = useState('');
  const [savingPm, setSavingPm] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [subModalForm, setSubModalForm] = useState({ sourceTaskId: '', name: '' });
  const [savingSub, setSavingSub] = useState(false);
  const [subSourceItems, setSubSourceItems] = useState<{id: string; name: string; type: string; section: string; unit: string; quantity: number}[]>([]);
  const [subSelectedIds, setSubSelectedIds] = useState<Set<string>>(new Set());
  const [loadingSubItems, setLoadingSubItems] = useState(false);
  const [subDistribution, setSubDistribution] = useState<Record<string, {distributed: number; remaining: number; total: number}>>({});
  const [subItemQuantities, setSubItemQuantities] = useState<Record<string, string>>({});
  const [estimatesWithTotals, setEstimatesWithTotals] = useState<EstimateWithTotal[]>([]);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [savingNewClient, setSavingNewClient] = useState(false);
  const [subParentId, setSubParentId] = useState('');
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
      // Load estimates with totals
      client.get<EstimateWithTotal[]>(`/projects/${id}/estimates-with-totals`).then(r => setEstimatesWithTotals(r.data)).catch(() => {});
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

  useEffect(() => {
    if (!subModalForm.sourceTaskId) {
      setSubSourceItems([]); setSubSelectedIds(new Set());
      setSubDistribution({}); setSubItemQuantities({});
      return;
    }
    setLoadingSubItems(true);
    Promise.all([
      client.get<{ items: {id: string; name: string; type: string; section: string; unit: string; quantity: number; row_type?: string}[] }>(
        `/projects/estimates/${subModalForm.sourceTaskId}/items`
      ),
      client.get<{item_id: string; quantity_total: number; quantity_distributed: number; quantity_remaining: number}[]>(
        `/tasks/${subModalForm.sourceTaskId}/sub-distribution`
      ).catch(() => ({ data: [] })),
    ]).then(([itemsResp, distResp]) => {
      const items = itemsResp.data.items.filter(i => i.row_type !== 'section_header');
      setSubSourceItems(items);
      setSubSelectedIds(new Set(items.map(i => i.id)));

      const distMap: Record<string, {distributed: number; remaining: number; total: number}> = {};
      const qtyMap: Record<string, string> = {};
      for (const d of distResp.data) {
        distMap[d.item_id] = { distributed: d.quantity_distributed, remaining: d.quantity_remaining, total: d.quantity_total };
        qtyMap[d.item_id] = String(d.quantity_remaining > 0 ? d.quantity_remaining : d.quantity_total);
      }
      // fallback for items not in distribution (no sub-estimates yet)
      items.forEach(item => {
        if (!distMap[item.id]) {
          distMap[item.id] = { distributed: 0, remaining: item.quantity, total: item.quantity };
          qtyMap[item.id] = String(item.quantity);
        }
      });
      setSubDistribution(distMap);
      setSubItemQuantities(qtyMap);
    }).catch(() => {}).finally(() => setLoadingSubItems(false));
  }, [subModalForm.sourceTaskId]);

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

  const clientEstimates = estimatesWithTotals.filter(t => t.estimate_type !== 'subcontractor');
  const subEstimates = estimatesWithTotals.filter(t => t.estimate_type === 'subcontractor');
  const clientTotal = clientEstimates.reduce((s, t) => s + t.total, 0);
  const subTotal = subEstimates.reduce((s, t) => s + t.total, 0);
  const saldo = clientTotal - subTotal;

  const ALL_TABS: [TabType, string][] = [
    ['info',      '📋 Информация'],
    ['docs',      '📁 Документы'],
    ['estimates', `📐 Сметы (${tasks.length})`],
    ['finance',   '💰 Финансы'],
    ...(atLeast('ESTIMATION') ? [['schedule', '📅 ГПР'] as [TabType, string]] : []),
    ...(atLeast('EXECUTION')  ? [
      ['acts',      '✅ КС-2'],
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
                <button onClick={saveCard} disabled={saving} style={btnPrimary('sm')} data-tooltip="Сохранить изменения по проекту">{saving ? 'Сохранение...' : 'Сохранить'}</button>
                <button onClick={() => { setEditing(false); setForm(card); }} style={btnOutline('sm')} data-tooltip="Отменить редактирование без сохранения">Отмена</button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} style={btnGhost('sm')} data-tooltip="Редактировать реквизиты проекта: адрес, заказчик, даты, бюджет">✎ Редактировать</button>
            )}
          </div>
        </div>

        {/* Edit form */}
        {editing && (
          <div style={{ marginTop: 14, padding: '14px 0', borderTop: `1px solid ${C.border}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              <label style={LBL}>Адрес<input value={form.address || ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} style={{ ...INPUT, marginTop: 4 }} /></label>
              <label style={LBL}>Заказчик
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <select value={form.client_id || ''} onChange={e => setForm(f => ({ ...f, client_id: e.target.value || undefined }))} style={{ ...INPUT, flex: 1 }}>
                    <option value="">— не указан —</option>
                    {clientContractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button type="button" style={btnGhost('sm')} data-tooltip="Создать нового заказчика и сразу привязать к проекту" onClick={() => setShowNewClientForm(v => !v)}>+</button>
                </div>
                {showNewClientForm && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <input value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="Название заказчика" style={{ ...INPUT, flex: 1 }} />
                    <button type="button" disabled={savingNewClient || !newClientName.trim()} style={btnPrimary('sm')} data-tooltip="Создать заказчика с введённым названием" onClick={async () => {
                      setSavingNewClient(true);
                      try {
                        const r = await client.post('/contractors', { kind: 'client', name: newClientName.trim() });
                        setContractors(prev => [...prev, r.data]);
                        setForm(f => ({ ...f, client_id: r.data.id }));
                        setNewClientName(''); setShowNewClientForm(false);
                      } finally { setSavingNewClient(false); }
                    }}>{savingNewClient ? '...' : 'Создать'}</button>
                    <button type="button" style={btnGhost('sm')} data-tooltip="Отменить создание заказчика" onClick={() => { setShowNewClientForm(false); setNewClientName(''); }}>✕</button>
                  </div>
                )}
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
                        data-tooltip={suggestion?.condition_hint ? `Перейти на стадию "${STAGE_LABELS[stage]}"\n${suggestion.condition_hint}` : `Перейти на стадию "${STAGE_LABELS[stage]}"`}
                        onClick={() => { setPendingStage(stage); setShowStageModal(true); }}
                      >
                        Перейти →
                      </button>
                    )}
                    {isAllowed && suggestion && !suggestion.ready && (
                      <div style={{ fontSize: 11, color: C.warning, marginTop: 2 }}>{suggestion.condition_hint}</div>
                    )}
                    {isAllowed && !suggestion?.ready && stage === 'EXECUTION' && suggestion?.condition_hint?.includes('руководител') && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                        <input
                          value={pmNameInput}
                          onChange={e => setPmNameInput(e.target.value)}
                          placeholder="Имя руководителя проекта"
                          style={{ ...INPUT, fontSize: 12, padding: '4px 8px', width: 220 }}
                        />
                        <button
                          disabled={savingPm || !pmNameInput.trim()}
                          style={btnPrimary('sm')}
                          data-tooltip="Назначить руководителя проекта — необходимо для перехода в стадию Реализации"
                          onClick={async () => {
                            setSavingPm(true);
                            try {
                              await client.patch(`/projects/${id}/details`, { project_manager_name: pmNameInput.trim() });
                              setPmNameInput('');
                              loadAll();
                            } finally { setSavingPm(false); }
                          }}
                        >{savingPm ? '...' : 'Назначить'}</button>
                      </div>
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

      {tab === 'docs' && id && (
        <div>
          <ProjectDocuments projectId={id} />
          <div style={{ marginTop: 24, borderTop: `2px solid ${C.border}`, paddingTop: 20 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 15, color: C.text }}>Договоры</h3>
            <SubcontractorContracts projectId={id} />
          </div>
        </div>
      )}
      {tab === 'schedule' && id && <WorkSchedule projectId={id} />}
      {tab === 'acts' && id && <ClientActsManager projectId={id} />}
      {tab === 'purchases' && id && <PurchaseRequests projectId={id} />}
      {tab === 'warranty' && <WarrantyClaims projectId={id!} />}

      {tab === 'gallery' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
            <button onClick={() => galleryInputRef.current?.click()} style={btnPrimary('sm')} data-tooltip="Загрузить фотографии объекта (PNG/JPEG/WebP, до 5MB каждая)">+ Загрузить фото</button>
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
                      data-tooltip="Удалить это фото из галереи"
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
              ['Смета с заказчиком', finSummary.client_total, C.primary],
              ['Смета с субподрядчиком', finSummary.subcontractor_total, C.warning],
              ['Прибыль', finSummary.profit, finSummary.profit >= 0 ? C.success : C.danger],
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
            <button onClick={() => setShowPayForm(v => !v)} style={btnPrimary('sm')} data-tooltip="Добавить платёж: доход (от заказчика) или расход (подрядчику, поставщику)">+ Добавить</button>
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
                <button onClick={addPayment} disabled={!payForm.amount} style={btnPrimary('sm')} data-tooltip="Сохранить платёж">Добавить</button>
                <button onClick={() => setShowPayForm(false)} style={btnOutline('sm')} data-tooltip="Закрыть форму без добавления">Отмена</button>
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
                        <td style={TD}><button onClick={() => { if (confirm('Удалить?')) client.delete(`/projects/${id}/payments/${p.id}`).then(loadAll); }} style={{ ...btnDanger('sm'), padding: '2px 6px' }} data-tooltip="Удалить этот платёж">✕</button></td>
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
          {/* Totals summary */}
          {estimatesWithTotals.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 20 }}>
              {[
                ['Заказчик', clientTotal, C.primary],
                ['Подрядчик', subTotal, C.warning],
                ['Сальдо', saldo, saldo >= 0 ? C.success : C.danger],
              ].map(([label, val, color]) => (
                <div key={label as string} style={{ ...CARD, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{label as string}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: color as string, marginTop: 4 }}>{fmt(val as number)} ₽</div>
                </div>
              ))}
            </div>
          )}

          {/* Client estimates with their sub-estimates */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <h4 style={{ margin: 0, fontSize: 14, color: C.text, fontWeight: 600 }}>Сметы с заказчиком</h4>
            <button style={btnPrimary('sm')} data-tooltip="Создать пустую клиентскую смету для ручного заполнения или последующей генерации ИИ" onClick={async () => {
              const n = prompt('Название новой сметы:');
              if (!n?.trim()) return;
              const r = await client.post('/tasks/create-manual', { name: n.trim(), project_id: id, estimate_type: 'main' });
              window.location.href = `/task/${r.data.task_id}/estimate`;
            }}>+ Новая смета</button>
          </div>

          {clientEstimates.length === 0
            ? <div style={{ ...CARD, padding: 20, textAlign: 'center', color: C.textMuted, marginBottom: 16 }}>Нет смет с заказчиком</div>
            : clientEstimates.map(t => {
              const linkedSubs = subEstimates.filter(s => s.parent_estimate_id === t.id);
              return (
                <div key={t.id} style={{ marginBottom: 12 }}>
                  {/* Client estimate row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Link to={`/task/${t.id}/estimate`} style={{ flex: 1, display: 'block', padding: '10px 14px', border: `1px solid ${C.primary}44`, borderRadius: 8, textDecoration: 'none', color: 'inherit', background: C.primaryBg }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, color: C.text }}>{t.name || `Смета ${t.id.slice(0, 8)}`}</span>
                        <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: C.primary + '22', color: C.primary, fontWeight: 600 }}>заказчик</span>
                        {t.calculation_method === 'ai' && <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: '#7c3aed22', color: '#7c3aed', fontWeight: 600 }}>ИИ</span>}
                        {t.calculation_method === 'manual' && <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: C.surfaceAlt, color: C.textSec, fontWeight: 600 }}>Вручную</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: C.textSec, marginTop: 4, flexWrap: 'wrap' }}>
                        <span>Статус: {t.estimate_status || 'не указан'}</span>
                        <span>{new Date(t.created_at).toLocaleDateString('ru-RU')}</span>
                        {t.total > 0 && <span style={{ fontWeight: 700, color: C.primary }}>{fmt(t.total)} ₽</span>}
                      </div>
                    </Link>
                    <button
                      onClick={() => {
                        setSubParentId(t.id);
                        setSubModalForm({ sourceTaskId: '', name: '' });
                        setShowSubModal(true);
                      }}
                      style={{ ...btnOutline('sm'), flexShrink: 0, whiteSpace: 'nowrap' }}
                      data-tooltip="Создать смету с подрядчиком на основании этой клиентской сметы"
                    >+ Подрядчик</button>
                    <button
                      onClick={async () => {
                        if (!confirm('Удалить смету?')) return;
                        try { await client.delete(`/tasks/${t.id}`); loadAll(); }
                        catch { alert('Ошибка удаления'); }
                      }}
                      style={{ padding: '6px 10px', background: C.dangerBg, color: C.danger, border: `1px solid ${C.dangerBorder}`, borderRadius: 6, cursor: 'pointer', fontSize: 13, flexShrink: 0 }}
                      data-tooltip="Безвозвратно удалить эту смету"
                    >✕</button>
                  </div>
                  {/* Linked sub-estimates */}
                  {linkedSubs.map(s => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, marginLeft: 28 }}>
                      <div style={{ width: 2, height: '100%', background: C.warning, alignSelf: 'stretch', borderRadius: 2, flexShrink: 0 }} />
                      <Link to={`/task/${s.id}/estimate`} style={{ flex: 1, display: 'block', padding: '8px 12px', border: `1px solid ${C.warning}44`, borderRadius: 8, textDecoration: 'none', color: 'inherit', background: C.warningBg }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 500, color: C.text }}>{s.name || `Смета ${s.id.slice(0, 8)}`}</span>
                          <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: C.warning + '22', color: C.warning, fontWeight: 600 }}>подрядчик</span>
                          {s.calculation_method === 'ai' && <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: '#7c3aed22', color: '#7c3aed', fontWeight: 600 }}>ИИ</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: C.textSec, marginTop: 4 }}>
                          <span>Статус: {s.estimate_status || 'не указан'}</span>
                          <span>{new Date(s.created_at).toLocaleDateString('ru-RU')}</span>
                          {s.total > 0 && <span style={{ fontWeight: 700, color: C.warning }}>{fmt(s.total)} ₽</span>}
                        </div>
                      </Link>
                      <button
                        onClick={async () => {
                          if (!confirm('Удалить смету?')) return;
                          try { await client.delete(`/tasks/${s.id}`); loadAll(); }
                          catch { alert('Ошибка удаления'); }
                        }}
                        style={{ padding: '6px 10px', background: C.dangerBg, color: C.danger, border: `1px solid ${C.dangerBorder}`, borderRadius: 6, cursor: 'pointer', fontSize: 13, flexShrink: 0 }}
                        data-tooltip="Безвозвратно удалить смету с подрядчиком"
                      >✕</button>
                    </div>
                  ))}
                </div>
              );
            })
          }

          {/* Unlinked sub-estimates */}
          {subEstimates.filter(s => !s.parent_estimate_id).length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 10 }}>
                <h4 style={{ margin: 0, fontSize: 14, color: C.text, fontWeight: 600 }}>Сметы с подрядчиком (без привязки)</h4>
                <button style={btnOutline('sm')} data-tooltip="Создать смету с подрядчиком без привязки к клиентской смете" onClick={() => {
                  setSubParentId('');
                  setSubModalForm({ sourceTaskId: '', name: '' });
                  setShowSubModal(true);
                }}>+ Новая</button>
              </div>
              {subEstimates.filter(s => !s.parent_estimate_id).map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Link to={`/task/${t.id}/estimate`} style={{ flex: 1, display: 'block', padding: '10px 14px', border: `1px solid ${C.warning}44`, borderRadius: 8, textDecoration: 'none', color: 'inherit', background: C.warningBg }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 500, color: C.text }}>{t.name || `Смета ${t.id.slice(0, 8)}`}</span>
                      <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: C.warning + '22', color: C.warning, fontWeight: 600 }}>подрядчик</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12, color: C.textSec, marginTop: 4 }}>
                      <span>Статус: {t.estimate_status || 'не указан'}</span>
                      <span>{new Date(t.created_at).toLocaleDateString('ru-RU')}</span>
                      {t.total > 0 && <span style={{ fontWeight: 700, color: C.warning }}>{fmt(t.total)} ₽</span>}
                    </div>
                  </Link>
                  <button
                    onClick={async () => {
                      if (!confirm('Удалить смету?')) return;
                      try { await client.delete(`/tasks/${t.id}`); loadAll(); }
                      catch { alert('Ошибка удаления'); }
                    }}
                    style={{ padding: '6px 10px', background: C.dangerBg, color: C.danger, border: `1px solid ${C.dangerBorder}`, borderRadius: 6, cursor: 'pointer', fontSize: 13, flexShrink: 0 }}
                    data-tooltip="Безвозвратно удалить эту смету с подрядчиком"
                  >✕</button>
                </div>
              ))}
            </>
          )}

          {/* Button to add standalone sub-estimate when no client estimates */}
          {clientEstimates.length === 0 && (
            <div style={{ marginTop: 16 }}>
              <button style={btnOutline('sm')} data-tooltip="Создать отдельную смету с подрядчиком (без привязки к смете заказчика)" onClick={() => {
                setSubParentId('');
                setSubModalForm({ sourceTaskId: '', name: '' });
                setShowSubModal(true);
              }}>+ Смета с подрядчиком</button>
            </div>
          )}
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
              <button onClick={doStageTransition} style={btnPrimary()} data-tooltip={`Перевести проект на стадию: ${STAGE_LABELS[pendingStage] || pendingStage}`}>Подтвердить переход</button>
              <button onClick={() => setShowStageModal(false)} style={btnOutline()} data-tooltip="Отменить переход между стадиями">Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Subcontractor estimate modal */}
      {showSubModal && (
        <div style={OVERLAY}>
          <div style={{ ...MODAL, maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>Создать смету с подрядчиком</h3>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: C.textMuted }}>
              {subParentId ? `Привязана к клиентской смете: ${clientEstimates.find(e => e.id === subParentId)?.name || subParentId.slice(0, 8)}` : 'На основании сметы заказчика (выберите позиции) или как дополнительное соглашение на новые работы.'}
            </p>
            <div style={{ display: 'grid', gap: 10, overflow: 'auto', flex: 1 }}>
              <label style={LBL}>Основание
                <select value={subModalForm.sourceTaskId} onChange={e => setSubModalForm(f => ({ ...f, sourceTaskId: e.target.value }))}
                  style={{ ...INPUT, marginTop: 4 }}>
                  <option value="">— Дополнительное соглашение (новые работы) —</option>
                  {tasks.filter(t => t.estimate_type !== 'subcontractor').map(t => (
                    <option key={t.id} value={t.id}>
                      На основании: {t.name || t.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>

              {subModalForm.sourceTaskId && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Позиции для копирования:</span>
                    {loadingSubItems ? (
                      <span style={{ fontSize: 12, color: C.textMuted }}>Загрузка...</span>
                    ) : (
                      <>
                        <button style={{ ...btnGhost('sm'), fontSize: 12 }}
                          data-tooltip="Выбрать все позиции для копирования в смету подрядчика"
                          onClick={() => setSubSelectedIds(new Set(subSourceItems.map(i => i.id)))}>
                          Выбрать все
                        </button>
                        <button style={{ ...btnGhost('sm'), fontSize: 12 }}
                          data-tooltip="Снять выделение со всех позиций"
                          onClick={() => setSubSelectedIds(new Set())}>
                          Снять все
                        </button>
                        <span style={{ fontSize: 12, color: C.textMuted }}>{subSelectedIds.size} / {subSourceItems.length}</span>
                      </>
                    )}
                  </div>
                  {!loadingSubItems && subSourceItems.length > 0 && (
                    <>
                      {Object.values(subDistribution).some(d => d.distributed > 0) && (
                        <div style={{ padding: '6px 10px', background: '#fffbeb', border: `1px solid #fcd34d`, borderRadius: 6, fontSize: 12, color: '#92400e', marginBottom: 6 }}>
                          Показаны остатки объёмов, не распределённых другим подрядчикам. Вы можете изменить количество вручную.
                        </div>
                      )}
                      <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, maxHeight: 320, overflowY: 'auto' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr auto 90px', gap: 0, padding: '4px 10px', background: C.surfaceAlt, borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 600, color: C.textSec }}>
                          <span/>
                          <span>Позиция</span>
                          <span style={{ textAlign: 'right', paddingRight: 8 }}>Распределено</span>
                          <span style={{ textAlign: 'center' }}>Кол-во</span>
                        </div>
                        {(() => {
                          const rows: React.ReactNode[] = [];
                          let lastSection = '';
                          subSourceItems.forEach(item => {
                            const sec = item.section || '— без раздела —';
                            if (sec !== lastSection) {
                              lastSection = sec;
                              rows.push(
                                <div key={`sec-${sec}`} style={{ gridColumn: '1 / -1', padding: '4px 10px', background: C.surfaceAlt, fontSize: 11, fontWeight: 700, color: C.textSec, borderBottom: `1px solid ${C.border}` }}>
                                  {sec}
                                </div>
                              );
                            }
                            const dist = subDistribution[item.id];
                            const fullyDistributed = dist && dist.distributed >= dist.total && dist.total > 0;
                            rows.push(
                              <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '20px 1fr auto 90px', alignItems: 'center', gap: 0, padding: '5px 10px', borderBottom: `1px solid ${C.border}`, background: fullyDistributed ? '#fef9f0' : 'transparent' }}>
                                <input type="checkbox" checked={subSelectedIds.has(item.id)}
                                  onChange={e => {
                                    const next = new Set(subSelectedIds);
                                    if (e.target.checked) next.add(item.id); else next.delete(item.id);
                                    setSubSelectedIds(next);
                                  }} style={{ marginTop: 1 }} />
                                <div style={{ minWidth: 0 }}>
                                  <span style={{ fontWeight: 500, color: C.text, fontSize: 12 }}>{item.name}</span>
                                  <span style={{ marginLeft: 6, fontSize: 10, color: item.type === 'Работа' ? '#1d4ed8' : '#065f46', background: item.type === 'Работа' ? '#dbeafe' : '#d1fae5', padding: '1px 4px', borderRadius: 3 }}>
                                    {item.type === 'Работа' ? 'Р' : 'М'}
                                  </span>
                                  {dist && dist.distributed > 0 && (
                                    <span style={{ marginLeft: 6, fontSize: 10, color: C.textMuted }}>{item.unit}</span>
                                  )}
                                </div>
                                <div style={{ fontSize: 11, color: C.textMuted, paddingRight: 8, textAlign: 'right', whiteSpace: 'nowrap' }}>
                                  {dist && dist.distributed > 0
                                    ? <span style={{ color: fullyDistributed ? C.danger : '#d97706' }}>{dist.distributed}/{dist.total}</span>
                                    : <span style={{ color: C.textMuted }}>{item.quantity} {item.unit}</span>}
                                </div>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={subItemQuantities[item.id] ?? String(item.quantity)}
                                  onChange={e => setSubItemQuantities(prev => ({ ...prev, [item.id]: e.target.value }))}
                                  disabled={!subSelectedIds.has(item.id)}
                                  style={{ ...INPUT, padding: '2px 6px', fontSize: 12, width: '100%', opacity: subSelectedIds.has(item.id) ? 1 : 0.4, textAlign: 'right' }}
                                />
                              </div>
                            );
                          });
                          return rows;
                        })()}
                      </div>
                    </>
                  )}
                </div>
              )}

              <label style={LBL}>Название сметы
                <input value={subModalForm.name} onChange={e => setSubModalForm(f => ({ ...f, name: e.target.value }))}
                  style={{ ...INPUT, marginTop: 4 }}
                  placeholder={subModalForm.sourceTaskId ? 'Смета субподрядчика (копия)' : 'Доп. соглашение №1'} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
              <button disabled={savingSub} style={btnPrimary()} data-tooltip="Создать смету с подрядчиком и открыть её для редактирования" onClick={async () => {
                setSavingSub(true);
                try {
                  let newTaskId: string;
                  if (subModalForm.sourceTaskId) {
                    const allSelected = subSelectedIds.size === subSourceItems.length;
                    const selectedIds = Array.from(subSelectedIds);
                    // Build quantities map only for items with custom (non-total) quantities
                    const item_quantities: Record<string, number> = {};
                    selectedIds.forEach(itemId => {
                      const orig = subSourceItems.find(i => i.id === itemId);
                      const qtyStr = subItemQuantities[itemId];
                      if (orig && qtyStr !== undefined) {
                        const qty = parseFloat(qtyStr);
                        if (!isNaN(qty) && qty !== orig.quantity) {
                          item_quantities[itemId] = qty;
                        }
                      }
                    });
                    const r = await client.post(`/tasks/${subModalForm.sourceTaskId}/copy-as-subcontractor`, {
                      name: subModalForm.name || undefined,
                      item_ids: allSelected ? undefined : selectedIds,
                      item_quantities: Object.keys(item_quantities).length > 0 ? item_quantities : undefined,
                      parent_estimate_id: subParentId || subModalForm.sourceTaskId || undefined,
                    });
                    newTaskId = r.data.task_id;
                  } else {
                    const r = await client.post('/tasks/create-manual', {
                      name: subModalForm.name || 'Доп. соглашение',
                      project_id: id,
                      estimate_type: 'subcontractor',
                      parent_estimate_id: subParentId || undefined,
                    });
                    newTaskId = r.data.task_id;
                  }
                  setShowSubModal(false);
                  window.location.href = `/task/${newTaskId}/estimate`;
                } catch (e: any) {
                  alert(e?.response?.data?.detail || 'Ошибка создания сметы');
                } finally { setSavingSub(false); }
              }}>{savingSub ? 'Создание...' : 'Создать'}</button>
              <button style={btnOutline()} data-tooltip="Закрыть без создания сметы" onClick={() => setShowSubModal(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function fmt(v: number) { return v.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
