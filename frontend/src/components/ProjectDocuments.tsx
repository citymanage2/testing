import { useEffect, useRef, useState } from 'react';
import client from '../api/client';
import {
  C, CARD, INPUT, LBL, MODAL, OVERLAY, TD, TH,
  badge, btnDanger, btnGhost, btnOutline, btnPrimary,
} from '../ui';

interface Document {
  id: string;
  file_name: string;
  category: string;
  status: string;
  comment: string;
  version: number;
  uploaded_at: string;
}

const CATEGORIES: Record<string, string> = {
  tz: 'Техническое задание',
  design: 'Проектная документация',
  incoming_estimate: 'Входящая смета',
  tu: 'Технические условия',
  other: 'Прочее',
};

const STATUSES: Record<string, string> = {
  received: 'Получен',
  pending: 'Ожидается',
  not_required: 'Не требуется',
};

function statusBadge(s: string) {
  if (s === 'received') return <span style={badge(C.success, C.successBg)}>{STATUSES[s]}</span>;
  if (s === 'pending') return <span style={badge(C.warning, C.warningBg)}>{STATUSES[s]}</span>;
  return <span style={badge(C.textMuted, '#f1f5f9')}>{STATUSES['not_required']}</span>;
}

function categoryBadge(cat: string) {
  return (
    <span style={badge(C.primary, C.primaryBg)}>
      {CATEGORIES[cat] ?? cat}
    </span>
  );
}

function fmt(d: string) {
  return d ? new Date(d).toLocaleDateString('ru-RU') : '—';
}

interface EditState { docId: string; status: string; comment: string }

export default function ProjectDocuments({ projectId }: { projectId: string }) {
  const [docs, setDocs] = useState<Document[]>([]);
  const [filterCat, setFilterCat] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  // upload form
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCat, setUploadCat] = useState('tz');
  const [uploadComment, setUploadComment] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // edit modal
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    client.get(`/projects/${projectId}/documents`)
      .then(r => setDocs(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [projectId]);

  const filtered = filterCat === 'all' ? docs : docs.filter(d => d.category === filterCat);

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', uploadFile);
    fd.append('category', uploadCat);
    fd.append('comment', uploadComment);
    try {
      await client.post(`/projects/${projectId}/documents`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setShowUpload(false);
      setUploadFile(null);
      setUploadComment('');
      load();
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: Document) => {
    const r = await client.get(`/projects/${projectId}/documents/${doc.id}/download`, { responseType: 'blob' });
    const url = URL.createObjectURL(r.data);
    const a = document.createElement('a');
    a.href = url; a.download = doc.file_name; a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить документ?')) return;
    await client.delete(`/projects/${projectId}/documents/${id}`);
    load();
  };

  const handleSaveEdit = async () => {
    if (!editState) return;
    setSaving(true);
    try {
      await client.patch(`/projects/${projectId}/documents/${editState.docId}`, {
        status: editState.status,
        comment: editState.comment,
      });
      setEditState(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const segBtnStyle = (active: boolean) => ({
    ...btnOutline('sm'),
    background: active ? C.primary : C.surface,
    color: active ? '#fff' : C.text,
    border: `1px solid ${active ? C.primary : C.border}`,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <button style={segBtnStyle(filterCat === 'all')} onClick={() => setFilterCat('all')} data-tooltip="Показать все документы проекта">Все</button>
          {Object.entries(CATEGORIES).map(([k, v]) => (
            <button key={k} style={segBtnStyle(filterCat === k)} onClick={() => setFilterCat(k)} data-tooltip={`Показать только документы категории "${v}"`}>{v}</button>
          ))}
        </div>
        <button style={{ ...btnPrimary('sm'), marginLeft: 'auto' }} onClick={() => setShowUpload(true)} data-tooltip="Загрузить новый документ в проект (ТЗ, проектная документация, смета и др.)">
          + Загрузить
        </button>
      </div>

      {/* Table */}
      <div style={{ ...CARD, padding: 0, overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: C.textMuted }}>Загрузка...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: C.textMuted }}>Нет документов</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH}>Категория</th>
                <th style={TH}>Файл</th>
                <th style={TH}>Версия</th>
                <th style={TH}>Статус</th>
                <th style={TH}>Комментарий</th>
                <th style={TH}>Дата</th>
                <th style={TH}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(doc => (
                <tr key={doc.id}>
                  <td style={TD}>{categoryBadge(doc.category)}</td>
                  <td style={{ ...TD, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.file_name}
                  </td>
                  <td style={TD}>v{doc.version ?? 1}</td>
                  <td style={TD}>{statusBadge(doc.status)}</td>
                  <td style={{ ...TD, maxWidth: 180, color: C.textSec, fontSize: 12 }}>
                    {doc.comment || '—'}
                  </td>
                  <td style={TD}>{fmt(doc.uploaded_at)}</td>
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                    <button style={btnGhost('sm')} onClick={() => handleDownload(doc)} data-tooltip="Скачать документ на компьютер">⬇</button>
                    <button style={btnGhost('sm')} onClick={() => setEditState({ docId: doc.id, status: doc.status, comment: doc.comment ?? '' })} data-tooltip="Редактировать статус и комментарий документа">✏️</button>
                    <button style={btnDanger('sm')} onClick={() => handleDelete(doc.id)} data-tooltip="Удалить документ из проекта">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div style={OVERLAY} onClick={e => { if (e.target === e.currentTarget) setShowUpload(false); }}>
          <div style={MODAL}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>Загрузить документ</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={LBL}>
                Категория
                <select style={INPUT} value={uploadCat} onChange={e => setUploadCat(e.target.value)}>
                  {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label style={LBL}>
                Файл
                <input
                  ref={fileRef}
                  type="file"
                  style={INPUT}
                  onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <label style={LBL}>
                Комментарий
                <textarea
                  style={{ ...INPUT, resize: 'vertical', minHeight: 60 }}
                  value={uploadComment}
                  onChange={e => setUploadComment(e.target.value)}
                  placeholder="Необязательно"
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={btnOutline()} onClick={() => setShowUpload(false)} data-tooltip="Закрыть форму загрузки без загрузки файла">Отмена</button>
              <button style={btnPrimary()} onClick={handleUpload} disabled={!uploadFile || uploading} data-tooltip="Загрузить выбранный файл в проект">
                {uploading ? 'Загрузка...' : 'Загрузить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editState && (
        <div style={OVERLAY} onClick={e => { if (e.target === e.currentTarget) setEditState(null); }}>
          <div style={{ ...MODAL, maxWidth: 400 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>Редактировать документ</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={LBL}>
                Статус
                <select style={INPUT} value={editState.status} onChange={e => setEditState(s => s && ({ ...s, status: e.target.value }))}>
                  {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label style={LBL}>
                Комментарий
                <textarea
                  style={{ ...INPUT, resize: 'vertical', minHeight: 60 }}
                  value={editState.comment}
                  onChange={e => setEditState(s => s && ({ ...s, comment: e.target.value }))}
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={btnOutline()} onClick={() => setEditState(null)} data-tooltip="Закрыть форму без сохранения изменений">Отмена</button>
              <button style={btnPrimary()} onClick={handleSaveEdit} disabled={saving} data-tooltip="Сохранить изменения статуса и комментария документа">
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
