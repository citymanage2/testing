import { useEffect, useState } from 'react';
import client from '../api/client';
import { C, btnPrimary, btnGhost, INPUT, LBL, CARD } from '../ui';

interface Contractor { id: string; kind: string; name: string; }
interface DocMeta { id: string; doc_kind: string; file_name: string; created_at: string; params?: Record<string, unknown>; }
interface Acceptance { id: string; act_number: string; contractor_name?: string; period_start?: string; period_end?: string; status: string; }

const DOC_KIND_LABELS: Record<string, string> = { estimate_xlsx: 'Смета Excel', ks2: 'КС-2', ks3: 'КС-3' };
const TAB_LABELS: Record<string, string> = { estimate: '⬇ Смета', ks2: 'КС-2', ks3: 'КС-3' };

export default function DocumentGenerator({ taskId }: { taskId: string }) {
  const [tab, setTab] = useState<'estimate' | 'ks2' | 'ks3'>('estimate');
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [acceptances, setAcceptances] = useState<Acceptance[]>([]);
  const [history, setHistory] = useState<DocMeta[]>([]);
  const [generating, setGenerating] = useState(false);

  const [contractorId, setContractorId] = useState('');
  const [periodStart, setPeriodStart] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().slice(0, 10));
  const [actNumber, setActNumber] = useState('1');
  const [estimateTitle, setEstimateTitle] = useState('');
  const [ks2Amount, setKs2Amount] = useState('');
  const [acceptanceId, setAcceptanceId] = useState('');

  useEffect(() => {
    client.get<Contractor[]>('/contractors').then(r => setContractors(r.data)).catch(() => {});
    client.get<Acceptance[]>(`/projects/estimates/${taskId}/acceptances`).then(r => setAcceptances(r.data)).catch(() => {});
    loadHistory();
  }, [taskId]);

  async function loadHistory() {
    try { setHistory((await client.get<DocMeta[]>(`/projects/estimates/${taskId}/documents`)).data); }
    catch {}
  }

  async function generate() {
    setGenerating(true);
    try {
      let url = '';
      let body: Record<string, unknown> = {};
      if (tab === 'estimate') {
        url = `/projects/estimates/${taskId}/documents/estimate-xlsx`;
        body = { title: estimateTitle || undefined, contractor_id: contractorId || undefined };
      } else if (tab === 'ks2') {
        url = `/projects/estimates/${taskId}/documents/ks2`;
        body = acceptanceId
          ? { acceptance_id: acceptanceId, period_start: periodStart, period_end: periodEnd }
          : { contractor_id: contractorId || undefined, period_start: periodStart, period_end: periodEnd, act_number: actNumber };
      } else {
        url = `/projects/estimates/${taskId}/documents/ks3`;
        body = { contractor_id: contractorId || undefined, period_start: periodStart, period_end: periodEnd, act_number: actNumber, ks2_amount: ks2Amount ? parseFloat(ks2Amount) : undefined };
      }
      const resp = await client.post(url, body, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(resp.data);
      const cd = resp.headers['content-disposition'] || '';
      const match = cd.match(/filename="([^"]+)"/);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = match ? match[1] : 'document.xlsx';
      a.click();
      URL.revokeObjectURL(blobUrl);
      loadHistory();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Ошибка генерации документа');
    } finally {
      setGenerating(false);
    }
  }

  async function reDownload(doc: DocMeta) {
    const resp = await client.get(`/projects/estimates/${taskId}/documents/${doc.id}/download`, { responseType: 'blob' });
    const url = URL.createObjectURL(resp.data);
    const a = document.createElement('a'); a.href = url; a.download = doc.file_name; a.click();
    URL.revokeObjectURL(url);
  }

  const clientContractors = contractors.filter(c => c.kind === 'client');

  return (
    <div style={{ ...CARD, overflow: 'hidden', marginTop: 16 }}>
      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt }}>
        {(['estimate', 'ks2', 'ks3'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '9px 20px', border: 'none', borderBottom: tab === t ? `2px solid ${C.primary}` : '2px solid transparent', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: tab === t ? 600 : 400, color: tab === t ? C.primary : C.textSec }}
            data-tooltip={t === 'estimate' ? 'Сформировать смету в формате Excel с расценками и итогами' : t === 'ks2' ? 'Сформировать форму КС-2 (Акт о приёмке выполненных работ)' : 'Сформировать форму КС-3 (Справка о стоимости выполненных работ)'}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div style={{ padding: '16px 20px' }}>
        {tab === 'estimate' && (
          <div style={{ display: 'grid', gap: 10, maxWidth: 400 }}>
            <label style={LBL}>Название документа (необязательно)
              <input value={estimateTitle} onChange={e => setEstimateTitle(e.target.value)} placeholder="Смета на отделочные работы" style={{ ...INPUT, marginTop: 4 }} />
            </label>
            <label style={LBL}>Заказчик (для шапки)
              <select value={contractorId} onChange={e => setContractorId(e.target.value)} style={{ ...INPUT, marginTop: 4 }}>
                <option value="">— не указывать —</option>
                {clientContractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          </div>
        )}

        {tab === 'ks2' && (
          <div style={{ display: 'grid', gap: 10, maxWidth: 420 }}>
            {acceptances.length > 0 && (
              <label style={LBL}>Сформировать на основе акта приёмки
                <select value={acceptanceId} onChange={e => setAcceptanceId(e.target.value)} style={{ ...INPUT, marginTop: 4 }}>
                  <option value="">— все позиции сметы —</option>
                  {acceptances.map(a => (
                    <option key={a.id} value={a.id}>
                      Акт №{a.act_number} {a.contractor_name ? `• ${a.contractor_name}` : ''} {a.period_start ? `• ${a.period_start}–${a.period_end}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!acceptanceId && (
              <label style={LBL}>Заказчик *
                <select value={contractorId} onChange={e => setContractorId(e.target.value)} style={{ ...INPUT, marginTop: 4 }}>
                  <option value="">— выберите заказчика —</option>
                  {clientContractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={LBL}>Начало периода<input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} style={{ ...INPUT, marginTop: 4 }} /></label>
              <label style={LBL}>Конец периода<input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} style={{ ...INPUT, marginTop: 4 }} /></label>
            </div>
            {!acceptanceId && <label style={LBL}>Номер акта<input value={actNumber} onChange={e => setActNumber(e.target.value)} style={{ ...INPUT, marginTop: 4 }} /></label>}
          </div>
        )}

        {tab === 'ks3' && (
          <div style={{ display: 'grid', gap: 10, maxWidth: 420 }}>
            <label style={LBL}>Заказчик *
              <select value={contractorId} onChange={e => setContractorId(e.target.value)} style={{ ...INPUT, marginTop: 4 }}>
                <option value="">— выберите заказчика —</option>
                {clientContractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={LBL}>Начало периода<input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} style={{ ...INPUT, marginTop: 4 }} /></label>
              <label style={LBL}>Конец периода<input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} style={{ ...INPUT, marginTop: 4 }} /></label>
            </div>
            <label style={LBL}>Номер акта<input value={actNumber} onChange={e => setActNumber(e.target.value)} style={{ ...INPUT, marginTop: 4 }} /></label>
            <label style={LBL}>Сумма КС-2 (необязательно)
              <input type="number" value={ks2Amount} onChange={e => setKs2Amount(e.target.value)} placeholder="Автоматически из сметы" style={{ ...INPUT, marginTop: 4 }} />
            </label>
          </div>
        )}

        <button onClick={generate} disabled={generating} style={{ ...btnPrimary(), marginTop: 14 }} data-tooltip="Сформировать документ на основе данных сметы и скачать его на компьютер">
          {generating ? '⏳ Формирование...' : '⬇ Сформировать и скачать'}
        </button>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '12px 20px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.textSec, marginBottom: 8 }}>История документов</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {history.slice(0, 10).map(doc => (
              <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ padding: '1px 7px', background: C.primaryBg, borderRadius: 10, fontSize: 11, color: C.primary }}>{DOC_KIND_LABELS[doc.doc_kind] || doc.doc_kind}</span>
                <span style={{ fontSize: 12, flex: 1, color: C.text }}>{doc.file_name}</span>
                <span style={{ fontSize: 11, color: C.textMuted }}>{new Date(doc.created_at).toLocaleDateString('ru-RU')}</span>
                <button onClick={() => reDownload(doc)} style={btnGhost('sm')} data-tooltip="Скачать ранее сформированный документ повторно">⬇</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
