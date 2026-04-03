import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import client from '../api/client';

interface Ks2DataItem {
  idx: number;
  name: string;
  unit: string;
  qty_contract: number;
  qty_accepted: number;
  unit_price: number;
  work_val: number;
  mat_val: number;
  total_val: number;
}

interface Ks2Data {
  act_number: string;
  period: string;
  contractor_name: string;
  items: Ks2DataItem[];
  total_work: number;
  total_mat: number;
  grand_total: number;
}

function fmt(v: number) {
  return v.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Ks2Preview() {
  const { taskId, accId } = useParams<{ taskId: string; accId: string }>();
  const [data, setData] = useState<Ks2Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!taskId || !accId) return;
    client
      .get<Ks2Data>(`/projects/estimates/${taskId}/acceptances/${accId}/ks2-data`)
      .then(({ data: d }) => setData(d))
      .catch((e) => {
        const detail = e?.response?.data?.detail;
        setError(detail ? String(detail).slice(0, 500) : 'Ошибка загрузки данных КС-2');
      });
  }, [taskId, accId]);

  async function downloadExcel() {
    if (!taskId || !accId) return;
    setDownloading(true);
    try {
      const resp = await client.get(
        `/projects/estimates/${taskId}/acceptances/${accId}/export-ks2`,
        { responseType: 'blob' },
      );
      const url = URL.createObjectURL(resp.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ks2_act_${data?.act_number ?? '1'}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      const blob = (e as { response?: { data?: Blob } })?.response?.data;
      if (blob instanceof Blob) {
        const txt = await blob.text().catch(() => '');
        try {
          const j = JSON.parse(txt);
          alert('Ошибка КС-2: ' + String(j.detail || txt).slice(0, 400));
        } catch {
          alert('Ошибка генерации КС-2: ' + txt.slice(0, 400));
        }
      } else {
        alert('Ошибка генерации КС-2');
      }
    } finally {
      setDownloading(false);
    }
  }

  const cellStyle: React.CSSProperties = {
    border: '1px solid #ccc',
    padding: '5px 8px',
    fontSize: 12,
    fontFamily: 'Arial, sans-serif',
  };
  const headerCell: React.CSSProperties = {
    ...cellStyle,
    fontWeight: 700,
    background: '#f0f0f0',
    textAlign: 'center',
  };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
        }
      `}</style>

      {/* Action bar */}
      <div className="no-print" style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <button
          onClick={() => window.print()}
          style={{
            padding: '8px 18px', background: '#1a73e8', color: '#fff',
            border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600,
          }}
        >
          Печатать
        </button>
        <button
          onClick={downloadExcel}
          disabled={downloading || !data}
          style={{
            padding: '8px 18px', background: downloading ? '#aaa' : '#0f9d58', color: '#fff',
            border: 'none', borderRadius: 6, cursor: downloading ? 'not-allowed' : 'pointer',
            fontSize: 14, fontWeight: 600,
          }}
        >
          {downloading ? 'Загрузка...' : 'Выгрузить Excel'}
        </button>
        <button
          onClick={() => window.close()}
          style={{
            padding: '8px 14px', background: 'transparent', color: '#666',
            border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer', fontSize: 13,
          }}
        >
          Закрыть
        </button>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, padding: 16, color: '#b91c1c', whiteSpace: 'pre-wrap', fontSize: 13 }}>
          {error}
        </div>
      )}

      {!data && !error && (
        <p style={{ color: '#666', fontSize: 14 }}>Загрузка данных...</p>
      )}

      {data && (
        <div>
          {/* Title */}
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
              АКТ о приёмке выполненных работ (форма КС-2)
            </div>
            <div style={{ fontSize: 13, color: '#444' }}>
              Подрядчик: <b>{data.contractor_name}</b>&nbsp;&nbsp;
              Акт №: <b>{data.act_number}</b>&nbsp;&nbsp;
              Период: <b>{data.period}</b>
            </div>
          </div>

          {/* Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 36 }} />
              <col />
              <col style={{ width: 52 }} />
              <col style={{ width: 88 }} />
              <col style={{ width: 88 }} />
              <col style={{ width: 88 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 100 }} />
            </colgroup>
            <thead>
              <tr>
                {['№', 'Наименование работ', 'Ед.изм.', 'Кол-во по дог.', 'Выполнено',
                  'Цена за ед.', 'Ст-ть работ', 'Ст-ть матер.', 'Итого'].map((h) => (
                  <th key={h} style={headerCell}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.filter(item => item.total_val > 0).map((item) => (
                <tr key={item.idx}>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>{item.idx}</td>
                  <td style={cellStyle}>{item.name}</td>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>{item.unit}</td>
                  <td style={{ ...cellStyle, textAlign: 'right' }}>{item.qty_contract}</td>
                  <td style={{ ...cellStyle, textAlign: 'right' }}>{item.qty_accepted}</td>
                  <td style={{ ...cellStyle, textAlign: 'right' }}>{fmt(item.unit_price)}</td>
                  <td style={{ ...cellStyle, textAlign: 'right' }}>{fmt(item.work_val)}</td>
                  <td style={{ ...cellStyle, textAlign: 'right' }}>{fmt(item.mat_val)}</td>
                  <td style={{ ...cellStyle, textAlign: 'right' }}>{fmt(item.total_val)}</td>
                </tr>
              ))}
              {/* Totals row */}
              <tr>
                <td colSpan={6} style={{ ...cellStyle, fontWeight: 700, textAlign: 'right', background: '#f8f8f8' }}>
                  ИТОГО:
                </td>
                <td style={{ ...cellStyle, fontWeight: 700, textAlign: 'right', background: '#f8f8f8' }}>{fmt(data.total_work)}</td>
                <td style={{ ...cellStyle, fontWeight: 700, textAlign: 'right', background: '#f8f8f8' }}>{fmt(data.total_mat)}</td>
                <td style={{ ...cellStyle, fontWeight: 700, textAlign: 'right', background: '#f8f8f8' }}>{fmt(data.grand_total)}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: 24, fontSize: 13, color: '#555' }}>
            <div>Итого стоимость выполненных работ: <b>{fmt(data.grand_total)} руб.</b></div>
          </div>
        </div>
      )}
    </div>
  );
}
