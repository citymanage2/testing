import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import client from '../api/client';
import StatusBadge from '../components/StatusBadge';
import VersionHistoryDrawer from '../components/VersionHistoryDrawer';
import OptimizationChecklist from '../components/OptimizationChecklist';
import AnaloguePanel from '../components/AnaloguePanel';

interface Item { id: string; position: number; section: string; type: string; name: string; unit: string; quantity: number; price_work: number; price_material: number; total: number; is_analogue: boolean; }
interface EstimateData { items: Item[]; vat_rate: number; total_work: number; total_mat: number; total: number; total_vat: number; estimate_status: string; }

export default function EstimateView() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<EstimateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showOpt, setShowOpt] = useState(false);
  const [analogueItemId, setAnalogueItemId] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    try { setData((await client.get<EstimateData>(`/projects/estimates/${id}/items`)).data); }
    catch { setError('Ошибка загрузки'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [id]);

  if (loading) return <div style={{ padding: 24 }}>Загрузка...</div>;
  if (error) return <div style={{ padding: 24, color: '#f44336' }}>{error}</div>;
  if (!data) return null;

  const analogueItem = analogueItemId ? data.items.find((i) => i.id === analogueItemId) : null;

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Смета</h2>
        <StatusBadge status={data.estimate_status} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => setShowHistory(true)} style={actionBtn('#757575')}>История версий</button>
          <button onClick={() => setShowOpt(true)} style={actionBtn('#ff9800')}>Оптимизировать</button>
        </div>
      </div>

      <div style={{ overflowX: 'auto', marginBottom: 24 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              {['№', 'Раздел', 'Тип', 'Наименование', 'Ед.', 'Кол-во', 'Цена работ', 'Цена мат.', 'Стоимость', ''].map((h) => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', border: '1px solid #e0e0e0', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id}>
                <td style={td}>{item.position}</td>
                <td style={td}>{item.section}</td>
                <td style={td}>{item.type}</td>
                <td style={{ ...td, maxWidth: 280 }}>
                  {item.name}
                  {item.is_analogue && <span style={{ marginLeft: 6, padding: '1px 6px', background: '#4caf50', color: '#fff', borderRadius: 10, fontSize: 11 }}>аналог</span>}
                </td>
                <td style={td}>{item.unit}</td>
                <td style={td}>{item.quantity}</td>
                <td style={td}>{fmt(item.price_work)}</td>
                <td style={td}>{fmt(item.price_material)}</td>
                <td style={td}>{fmt(item.total)}</td>
                <td style={td}>
                  {item.type === 'Материал' && (
                    <button onClick={() => setAnalogueItemId(item.id)} style={{ padding: '2px 8px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Аналоги</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', background: '#f9f9f9', padding: '14px 20px', borderRadius: 6, border: '1px solid #e0e0e0' }}>
        {[['Работы', data.total_work], [`НДС ${data.vat_rate}%`, data.total_vat], ['Материалы', data.total_mat], ['Итого без НДС', data.total], ['ИТОГО', data.total + data.total_vat]].map(([label, value]) => (
          <div key={label as string} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 12, color: '#888' }}>{label}</span>
            <span style={{ fontSize: 16, fontWeight: label === 'ИТОГО' ? 700 : 500 }}>{fmt(value as number)} ₽</span>
          </div>
        ))}
      </div>

      {showHistory && id && <VersionHistoryDrawer taskId={id} onClose={() => setShowHistory(false)} onRestored={() => { setShowHistory(false); load(); }} />}
      {showOpt && id && <OptimizationChecklist taskId={id} onClose={() => setShowOpt(false)} onOptimized={() => { setShowOpt(false); load(); }} />}
      {analogueItemId && id && analogueItem && <AnaloguePanel taskId={id} itemId={analogueItemId} isAnalogue={analogueItem.is_analogue} onClose={() => setAnalogueItemId(null)} onApplied={() => { setAnalogueItemId(null); load(); }} />}
    </div>
  );
}

const td: React.CSSProperties = { padding: '6px 10px', border: '1px solid #e0e0e0', verticalAlign: 'middle' };
function fmt(v: number) { return v.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function actionBtn(bg: string): React.CSSProperties { return { padding: '7px 14px', background: bg, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 500 }; }
