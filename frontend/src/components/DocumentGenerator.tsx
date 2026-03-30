import { useEffect, useState } from 'react';
import client from '../api/client';

interface Contractor { id: string; kind: string; name: string; }
interface DocMeta { id: string; doc_kind: string; file_name: string; created_at: string; params?: Record<string, unknown>; }

const DOC_KIND_LABELS: Record<string, string> = { estimate_xlsx: 'Смета Excel', ks2: 'КС-2', ks3: 'КС-3' };

export default function DocumentGenerator({ taskId }: { taskId: string }) {
  const [tab, setTab] = useState<'estimate' | 'ks2' | 'ks3'>('estimate');
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [history, setHistory] = useState<DocMeta[]>([]);
  const [generating, setGenerating] = useState(false);

  // shared KS fields
  const [contractorId, setContractorId] = useState('');
  const [periodStart, setPeriodStart] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().slice(0, 10));
  const [actNumber, setActNumber] = useState('1');
  const [estimateTitle, setEstimateTitle] = useState('');
  const [ks2Amount, setKs2Amount] = useState('');

  useEffect(() => {
    client.get<Contractor[]>('/contractors').then(r => setContractors(r.data)).catch(() => {});
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
        body = { contractor_id: contractorId || undefined, period_start: periodStart, period_end: periodEnd, act_number: actNumber };
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
      a.download = match ? match[1] : `document.xlsx`;
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
    <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6, overflow: 'hidden', marginTop: 16 }}>
      <div style={{ display: 'flex', borderBottom: '1px solid #e0e0e0', background: '#f5f5f5' }}>
        {([['estimate', '⬇ Смета'], ['ks2', 'КС-2'], ['ks3', 'КС-3']] as const).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '9px 18px', border: 'none', borderBottom: tab === t ? '2px solid #1565c0' : '2px solid transparent', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: tab === t ? 600 : 400, color: tab === t ? '#1565c0' : '#555' }}>
            {l}
          </button>
        ))}
      </div>

      <div style={{ padding: '16px 20px' }}>
        {tab === 'estimate' && (
          <div style={{ display: 'grid', gap: 10, maxWidth: 400 }}>
            <label style={lbl}>Название документа (необязательно)
              <input value={estimateTitle} onChange={e => setEstimateTitle(e.target.value)} placeholder="Смета на отделочные работы" style={inp} />
            </label>
            <label style={lbl}>Заказчик (для шапки)
              <select value={contractorId} onChange={e => setContractorId(e.target.value)} style={inp}>
                <option value="">— не указывать —</option>
                {clientContractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          </div>
        )}

        {(tab === 'ks2' || tab === 'ks3') && (
          <div style={{ display: 'grid', gap: 10, maxWidth: 400 }}>
            <label style={lbl}>Заказчик *
              <select value={contractorId} onChange={e => setContractorId(e.target.value)} style={inp}>
                <option value="">— выберите заказчика —</option>
                {clientContractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={lbl}>Начало периода<input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} style={inp} /></label>
              <label style={lbl}>Конец периода<input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} style={inp} /></label>
            </div>
            <label style={lbl}>Номер акта<input value={actNumber} onChange={e => setActNumber(e.target.value)} style={inp} /></label>
            {tab === 'ks3' && (
              <label style={lbl}>Сумма КС-2 (необязательно, по умолчанию — из сметы)
                <input type="number" value={ks2Amount} onChange={e => setKs2Amount(e.target.value)} placeholder="Автоматически из сметы" style={inp} />
              </label>
            )}
          </div>
        )}

        <button onClick={generate} disabled={generating} style={{ marginTop: 14, padding: '8px 20px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          {generating ? 'Формирование...' : '⬇ Сформировать и скачать'}
        </button>
      </div>

      {history.length > 0 && (
        <div style={{ borderTop: '1px solid #e0e0e0', padding: '12px 20px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 8 }}>История документов</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {history.slice(0, 10).map(doc => (
              <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
                <span style={{ padding: '1px 6px', background: '#e3f2fd', borderRadius: 10, fontSize: 11, color: '#1565c0' }}>{DOC_KIND_LABELS[doc.doc_kind] || doc.doc_kind}</span>
                <span style={{ fontSize: 12, flex: 1 }}>{doc.file_name}</span>
                <span style={{ fontSize: 11, color: '#999' }}>{new Date(doc.created_at).toLocaleDateString('ru-RU')}</span>
                <button onClick={() => reDownload(doc)} style={{ padding: '2px 8px', fontSize: 11, border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', background: '#fff' }}>⬇</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 13 };
const inp: React.CSSProperties = { padding: '6px 10px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13 };
