import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import client from '../api/client';
import StatusBadge from '../components/StatusBadge';
import VersionHistoryDrawer from '../components/VersionHistoryDrawer';
import OptimizationChecklist from '../components/OptimizationChecklist';
import AnaloguePanel from '../components/AnaloguePanel';

interface EstimateItem {
  id: string;
  position: number;
  section: string;
  type: string;
  name: string;
  unit: string;
  quantity: number;
  price_work: number;
  price_material: number;
  total: number;
  is_analogue: boolean;
}

interface EstimateData {
  items: EstimateItem[];
  vat_rate: number;
  total_work: number;
  total_mat: number;
  total: number;
  total_vat: number;
  estimate_status: string;
}

export default function EstimateView() {
  const { id: taskId } = useParams<{ id: string }>();
  const [data, setData] = useState<EstimateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showOptimization, setShowOptimization] = useState(false);
  const [analoguePanelItemId, setAnaloguePanelItemId] = useState<string | null>(null);

  async function loadData() {
    if (!taskId) return;
    setLoading(true);
    try {
      const { data: resp } = await client.get<EstimateData>(`/projects/estimates/${taskId}/items`);
      setData(resp);
    } catch {
      setError('Ошибка загрузки сметы');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [taskId]);

  if (loading) return <div style={{ padding: 24 }}>Загрузка...</div>;
  if (error) return <div style={{ padding: 24, color: '#f44336' }}>{error}</div>;
  if (!data) return null;

  const analogueItem = analoguePanelItemId
    ? data.items.find((it) => it.id === analoguePanelItemId)
    : null;

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Смета задачи {taskId}</h2>
        <StatusBadge status={data.estimate_status} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowVersionHistory(true)}
            style={btnStyle('#757575')}
          >
            История версий
          </button>
          <button
            onClick={() => setShowOptimization(true)}
            style={btnStyle('#ff9800')}
          >
            Оптимизировать
          </button>
        </div>
      </div>

      {/* Items table */}
      <div style={{ overflowX: 'auto', marginBottom: 24 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              {['Позиция', 'Раздел', 'Тип', 'Наименование', 'Ед.', 'Кол-во', 'Цена работ', 'Цена мат.', 'Стоимость', 'Аналог?'].map(
                (col) => (
                  <th
                    key={col}
                    style={{
                      padding: '8px 10px',
                      textAlign: 'left',
                      border: '1px solid #e0e0e0',
                      whiteSpace: 'nowrap',
                      fontWeight: 600,
                    }}
                  >
                    {col}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={tdStyle}>{item.position}</td>
                <td style={tdStyle}>{item.section}</td>
                <td style={tdStyle}>{item.type}</td>
                <td style={{ ...tdStyle, maxWidth: 280 }}>{item.name}</td>
                <td style={tdStyle}>{item.unit}</td>
                <td style={tdStyle}>{item.quantity}</td>
                <td style={tdStyle}>{formatMoney(item.price_work)}</td>
                <td style={tdStyle}>{formatMoney(item.price_material)}</td>
                <td style={tdStyle}>{formatMoney(item.total)}</td>
                <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                  {item.is_analogue && (
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '1px 6px',
                        background: '#4caf50',
                        color: '#fff',
                        borderRadius: 10,
                        fontSize: 11,
                        marginRight: 4,
                      }}
                    >
                      аналог
                    </span>
                  )}
                  {item.type === 'Материал' && (
                    <button
                      onClick={() => setAnaloguePanelItemId(item.id)}
                      style={{
                        padding: '2px 8px',
                        background: '#1976d2',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      Аналоги
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div
        style={{
          display: 'flex',
          gap: 24,
          flexWrap: 'wrap',
          background: '#f9f9f9',
          padding: '16px 20px',
          borderRadius: 6,
          border: '1px solid #e0e0e0',
        }}
      >
        <TotalItem label="Работы" value={data.total_work} />
        <TotalItem label="Материалы" value={data.total_mat} />
        <TotalItem label="Итого без НДС" value={data.total} />
        <TotalItem label={`НДС ${data.vat_rate}%`} value={data.total_vat} />
        <TotalItem label="ИТОГО" value={data.total + data.total_vat} bold />
      </div>

      {/* Drawers / panels */}
      {showVersionHistory && taskId && (
        <VersionHistoryDrawer
          taskId={taskId}
          onClose={() => setShowVersionHistory(false)}
          onRestored={() => {
            setShowVersionHistory(false);
            loadData();
          }}
        />
      )}

      {showOptimization && taskId && (
        <OptimizationChecklist
          taskId={taskId}
          onClose={() => setShowOptimization(false)}
          onOptimized={() => {
            setShowOptimization(false);
            loadData();
          }}
        />
      )}

      {analoguePanelItemId && taskId && analogueItem && (
        <AnaloguePanel
          taskId={taskId}
          itemId={analoguePanelItemId}
          isAnalogue={analogueItem.is_analogue}
          onClose={() => setAnaloguePanelItemId(null)}
          onApplied={() => {
            setAnaloguePanelItemId(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}

function TotalItem({ label, value, bold = false }: { label: string; value: number; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 12, color: '#888' }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: bold ? 700 : 500 }}>{formatMoney(value)} ₽</span>
    </div>
  );
}

function formatMoney(value: number): string {
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const tdStyle: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid #e0e0e0',
  verticalAlign: 'middle',
};

function btnStyle(bg: string): React.CSSProperties {
  return {
    padding: '7px 14px',
    background: bg,
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: 14,
  };
}
