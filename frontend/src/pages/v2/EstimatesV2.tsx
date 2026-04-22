import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import client, { extractDetail } from '../../api/client';
import { estimatesV2, type EstimateV2 } from '../../api/v2';
import { C, T, CARD, TH, TD, INPUT, LBL, OVERLAY, MODAL, btnPrimary, btnOutline, badge } from '../../ui';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик', internal: 'Внутренняя', to_client: 'Клиенту', signed: 'Подписана',
};
const STATUS_COLORS: Record<string, [string, string]> = {
  draft: [C.textMuted, C.surfaceAlt],
  internal: [C.warning, C.warningBg],
  to_client: [C.primary, C.primaryBg],
  signed: [C.success, C.successBg],
};

interface Project { id: string; name: string; }

export default function EstimatesV2() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectIdFilter = searchParams.get('project_id') ?? '';

  const [estimates, setEstimates] = useState<EstimateV2[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ project_id: projectIdFilter, name: '' });
  const [creating, setCreating] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [importProjectId, setImportProjectId] = useState(projectIdFilter);
  const [importName, setImportName] = useState('');
  const [importUseAi, setImportUseAi] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const [filterProject, setFilterProject] = useState(projectIdFilter);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [est, proj] = await Promise.all([
        estimatesV2.list(filterProject ? { project_id: filterProject } : {}),
        client.get<Project[]>('/projects').then(r => r.data),
      ]);
      setEstimates(est);
      setProjects(proj);
    } catch {
      setError('Не удалось загрузить сметы');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filterProject]);

  async function handleCreate() {
    if (!createForm.project_id || !createForm.name.trim()) return;
    setCreating(true);
    try {
      const est = await estimatesV2.create(createForm);
      setShowCreate(false);
      setCreateForm({ project_id: projectIdFilter, name: '' });
      navigate(`/v2/estimates/${est.id}`);
    } catch {
      setError('Ошибка создания сметы');
    } finally {
      setCreating(false);
    }
  }

  async function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file || !importProjectId || !importName.trim()) { setImportError('Выберите файл, проект и укажите название'); return; }
    setImporting(true);
    setImportError('');
    try {
      const resp = await estimatesV2.importFile(importProjectId, file, importName.trim(), importUseAi);
      setShowImport(false);
      setImportName('');
      if (resp.estimate_id) navigate(`/v2/estimates/${resp.estimate_id}`);
      else { await load(); }
    } catch (e: unknown) {
      const ax = e as { response?: { status?: number; data?: { detail?: unknown } } };
      const status = ax?.response?.status;
      const detail = extractDetail(e, 'Ошибка импорта');
      setImportError(status ? `[${status}] ${detail}` : detail);
    } finally {
      setImporting(false);
    }
  }

  const projectName = (id: string) => projects.find(p => p.id === id)?.name ?? id;

  return (
    <div style={{ padding: '0 20px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={T.h1}>Сметы v2</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btnOutline('md')} onClick={() => setShowImport(true)}>↑ Импорт</button>
          <button style={btnPrimary('md')} onClick={() => setShowCreate(true)}>+ Новая смета</button>
        </div>
      </div>

      {/* Filter */}
      <div style={{ ...CARD, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <label style={{ fontSize: 13, color: C.textSec, flexShrink: 0 }}>Проект:</label>
        <select
          value={filterProject}
          onChange={e => setFilterProject(e.target.value)}
          style={{ ...INPUT, width: 280 }}
        >
          <option value="">Все проекты</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ color: C.textSec, padding: 24 }}>Загрузка...</div>
      ) : error ? (
        <div style={{ color: C.danger, padding: 24 }}>{error}</div>
      ) : (
        <div style={CARD}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH}>Название</th>
                <th style={TH}>Проект</th>
                <th style={TH}>Статус</th>
                <th style={TH}>Версия</th>
                <th style={TH}>Ветка</th>
                <th style={TH}>Создана</th>
                <th style={{ ...TH, width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {estimates.length === 0 && (
                <tr><td colSpan={7} style={{ ...TD, color: C.textMuted, textAlign: 'center', padding: 32 }}>Нет смет</td></tr>
              )}
              {estimates.map(est => {
                const [color, bg] = STATUS_COLORS[est.status] ?? [C.textMuted, C.surfaceAlt];
                return (
                  <tr
                    key={est.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/v2/estimates/${est.id}`)}
                    onMouseEnter={e => (e.currentTarget.style.background = C.surfaceHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ ...TD, fontWeight: 500 }}>{est.name}</td>
                    <td style={TD}>{projectName(est.project_id)}</td>
                    <td style={TD}>
                      <span style={badge(color, bg)}>{STATUS_LABELS[est.status] ?? est.status}</span>
                    </td>
                    <td style={TD}>v{est.version}</td>
                    <td style={{ ...TD, color: C.textSec }}>{est.branch_label ?? '—'}</td>
                    <td style={{ ...TD, color: C.textSec }}>{new Date(est.created_at).toLocaleDateString('ru-RU')}</td>
                    <td style={TD} onClick={e => e.stopPropagation()}>
                      <button
                        style={btnOutline('sm')}
                        onClick={() => navigate(`/v2/estimates/${est.id}`)}
                      >Открыть</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div style={OVERLAY} onClick={() => setShowCreate(false)}>
          <div style={MODAL} onClick={e => e.stopPropagation()}>
            <h2 style={{ ...T.h2, marginBottom: 20 }}>Новая смета</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={LBL}>
                Проект
                <select
                  value={createForm.project_id}
                  onChange={e => setCreateForm(f => ({ ...f, project_id: e.target.value }))}
                  style={INPUT}
                >
                  <option value="">— выберите —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label style={LBL}>
                Название
                <input
                  style={INPUT}
                  value={createForm.name}
                  onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Смета v1"
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={btnOutline('md')} onClick={() => setShowCreate(false)}>Отмена</button>
              <button style={btnPrimary('md')} disabled={creating} onClick={handleCreate}>
                {creating ? 'Создаю...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import modal */}
      {showImport && (
        <div style={OVERLAY} onClick={() => setShowImport(false)}>
          <div style={MODAL} onClick={e => e.stopPropagation()}>
            <h2 style={{ ...T.h2, marginBottom: 20 }}>Импорт сметы</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={LBL}>
                Проект
                <select
                  value={importProjectId}
                  onChange={e => setImportProjectId(e.target.value)}
                  style={INPUT}
                >
                  <option value="">— выберите —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label style={LBL}>
                Название сметы
                <input style={INPUT} value={importName} onChange={e => setImportName(e.target.value)} placeholder="Смета заказчика" />
              </label>
              <label style={LBL}>
                Файл (Excel, PDF, DOCX)
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.pdf,.docx,.doc" style={{ fontSize: 13 }} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={importUseAi}
                  onChange={e => setImportUseAi(e.target.checked)}
                />
                Использовать ИИ для нормализации позиций
              </label>
              {importError && <div style={{ color: C.danger, fontSize: 13 }}>{importError}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={btnOutline('md')} onClick={() => setShowImport(false)}>Отмена</button>
              <button style={btnPrimary('md')} disabled={importing} onClick={handleImport}>
                {importing ? 'Импортирую...' : 'Импортировать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
