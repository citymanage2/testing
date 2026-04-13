import { useEffect, useState } from 'react';
import client from '../api/client';
import { C, btnPrimary, btnOutline, btnDanger, btnGhost, badge, INPUT, LBL, CARD, TH, TD, OVERLAY, MODAL } from '../ui';

interface WarrantyClaim {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: 'open' | 'in_progress' | 'resolved';
  claimed_at?: string;
  deadline?: string;
  resolved_at?: string;
  assigned_to?: string;
  created_at: string;
  is_overdue: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Открыта',
  in_progress: 'В работе',
  resolved: 'Решена',
};

function statusBadge(s: string) {
  if (s === 'open') return <span style={badge('#d97706', '#fffbeb')}>{STATUS_LABELS[s]}</span>;
  if (s === 'in_progress') return <span style={badge(C.primary, C.primaryBg)}>{STATUS_LABELS[s]}</span>;
  if (s === 'resolved') return <span style={badge(C.success, C.successBg)}>{STATUS_LABELS[s]}</span>;
  return <span style={badge(C.textMuted, '#f1f5f9')}>{s}</span>;
}

const STATUS_NEXT: Record<string, string | undefined> = {
  open: 'in_progress',
  in_progress: 'resolved',
};

const emptyForm = () => ({
  title: '',
  description: '',
  claimed_at: '',
  deadline: '',
  assigned_to: '',
});

export default function WarrantyClaims({ projectId }: { projectId: string }) {
  const [claims, setClaims] = useState<WarrantyClaim[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<null | 'new' | WarrantyClaim>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await client.get(`/projects/${projectId}/warranty-claims`);
      setClaims(r.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [projectId]);

  const openNew = () => {
    setForm(emptyForm());
    setModal('new');
  };

  const openEdit = (c: WarrantyClaim) => {
    setForm({
      title: c.title,
      description: c.description || '',
      claimed_at: c.claimed_at || '',
      deadline: c.deadline || '',
      assigned_to: c.assigned_to || '',
    });
    setModal(c);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || undefined,
        claimed_at: form.claimed_at || undefined,
        deadline: form.deadline || undefined,
        assigned_to: form.assigned_to || undefined,
      };
      if (modal === 'new') {
        await client.post(`/projects/${projectId}/warranty-claims`, payload);
      } else if (modal) {
        await client.patch(`/projects/${projectId}/warranty-claims/${(modal as WarrantyClaim).id}`, payload);
      }
      setModal(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const deleteClaim = async (id: string) => {
    if (!confirm('Удалить претензию?')) return;
    await client.delete(`/projects/${projectId}/warranty-claims/${id}`);
    load();
  };

  const changeStatus = async (id: string, newStatus: string) => {
    await client.patch(`/projects/${projectId}/warranty-claims/${id}`, { status: newStatus });
    load();
  };

  const fld = (field: keyof ReturnType<typeof emptyForm>, val: string) =>
    setForm(f => ({ ...f, [field]: val }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button style={btnPrimary('sm')} onClick={openNew} data-tooltip="Добавить новую гарантийную претензию по объекту">+ Добавить претензию</button>
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: C.textMuted }}>Загрузка...</div>
      ) : claims.length === 0 ? (
        <div style={{ ...CARD, padding: 40, textAlign: 'center', color: C.textMuted }}>Нет гарантийных претензий</div>
      ) : (
        <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={TH}>Заголовок</th>
                <th style={TH}>Статус</th>
                <th style={TH}>Срок устранения</th>
                <th style={TH}>Ответственный</th>
                <th style={TH}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {claims.map(c => (
                <tr
                  key={c.id}
                  style={c.is_overdue ? { borderLeft: `3px solid ${C.danger}` } : undefined}
                >
                  <td style={TD}>
                    <div style={{ fontWeight: 500 }}>{c.title}</div>
                    {c.description && (
                      <div style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>{c.description}</div>
                    )}
                  </td>
                  <td style={TD}>{statusBadge(c.status)}</td>
                  <td style={{ ...TD, color: c.is_overdue ? C.danger : 'inherit' }}>
                    {c.deadline || '—'}
                  </td>
                  <td style={TD}>{c.assigned_to || '—'}</td>
                  <td style={TD}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                      {STATUS_NEXT[c.status] && (
                        <button
                          style={btnGhost('sm')}
                          onClick={() => changeStatus(c.id, STATUS_NEXT[c.status]!)}
                          data-tooltip={`Перевести претензию в статус "${STATUS_LABELS[STATUS_NEXT[c.status]!]}"`}
                        >
                          → {STATUS_LABELS[STATUS_NEXT[c.status]!]}
                        </button>
                      )}
                      <button style={btnOutline('sm')} onClick={() => openEdit(c)} data-tooltip="Редактировать данные претензии: заголовок, описание, сроки, ответственного">Изменить</button>
                      <button style={btnDanger('sm')} onClick={() => deleteClaim(c.id)} data-tooltip="Удалить гарантийную претензию">✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal !== null && (
        <div style={OVERLAY} onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div style={{ ...MODAL, maxWidth: 480 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>
              {modal === 'new' ? 'Добавить претензию' : 'Редактировать претензию'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={LBL}>
                Заголовок *
                <input
                  style={INPUT}
                  value={form.title}
                  onChange={e => fld('title', e.target.value)}
                  placeholder="Краткое описание проблемы"
                />
              </label>
              <label style={LBL}>
                Описание
                <textarea
                  style={{ ...INPUT, marginTop: 4, resize: 'vertical' }}
                  rows={3}
                  value={form.description}
                  onChange={e => fld('description', e.target.value)}
                />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={LBL}>
                  Дата претензии
                  <input
                    style={INPUT}
                    type="date"
                    value={form.claimed_at}
                    onChange={e => fld('claimed_at', e.target.value)}
                  />
                </label>
                <label style={LBL}>
                  Срок устранения
                  <input
                    style={INPUT}
                    type="date"
                    value={form.deadline}
                    onChange={e => fld('deadline', e.target.value)}
                  />
                </label>
              </div>
              <label style={LBL}>
                Ответственный
                <input
                  style={INPUT}
                  value={form.assigned_to}
                  onChange={e => fld('assigned_to', e.target.value)}
                  placeholder="ФИО или должность"
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={btnOutline()} onClick={() => setModal(null)} data-tooltip="Закрыть форму без сохранения">Отмена</button>
              <button
                style={btnPrimary()}
                onClick={save}
                disabled={saving || !form.title.trim()}
                data-tooltip="Сохранить данные гарантийной претензии"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
