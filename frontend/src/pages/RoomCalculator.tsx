import { useState } from 'react';
import client from '../api/client';

interface RoomInput {
  length: number; width: number; height: number;
  door_count: number; door_width: number; door_height: number;
  window_count: number; window_width: number; window_height: number;
  extra_opening_area: number;
  ceiling_type: string; slope_angle: number; cornice_width: number;
  floor_type: string; floor_screed_thickness: number;
  skirting_height: number; extra_wall_area: number; tile_height: number;
}

interface RoomResult {
  perimeter: number; floor_area: number; ceiling_area: number; total_volume: number;
  wall_area_gross: number; wall_area_net: number; wall_tile_area: number;
  door_area: number; window_area: number;
  ceiling_area_gross: number; cornice_area: number;
  floor_screed_volume: number;
  skirting_length: number; skirting_area: number;
  paint_area_net: number; wallpaper_area_net: number;
}

const defaultInput: RoomInput = {
  length: 5, width: 4, height: 2.7,
  door_count: 1, door_width: 0.9, door_height: 2.1,
  window_count: 1, window_width: 1.2, window_height: 1.4,
  extra_opening_area: 0,
  ceiling_type: 'flat', slope_angle: 30, cornice_width: 0,
  floor_type: 'flat', floor_screed_thickness: 0.05,
  skirting_height: 0.1, extra_wall_area: 0, tile_height: 0,
};

export default function RoomCalculator() {
  const [form, setForm] = useState<RoomInput>({ ...defaultInput });
  const [result, setResult] = useState<RoomResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function calculate() {
    setCalculating(true);
    try {
      const r = await client.post<RoomResult>('/calculator/room', form);
      setResult(r.data);
    } catch { alert('Ошибка расчёта'); }
    finally { setCalculating(false); }
  }

  function copy(label: string, value: number) {
    navigator.clipboard.writeText(String(value));
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  function n(key: keyof RoomInput, value: string) {
    setForm(f => ({ ...f, [key]: parseFloat(value) || 0 }));
  }

  const RESULTS: [string, keyof RoomResult, string][] = [
    ['Периметр', 'perimeter', 'м'],
    ['Площадь пола', 'floor_area', 'м²'],
    ['Площадь потолка', 'ceiling_area', 'м²'],
    ['Объём помещения', 'total_volume', 'м³'],
    ['Площадь стен (валовая)', 'wall_area_gross', 'м²'],
    ['Площадь стен (за вычетом проёмов)', 'wall_area_net', 'м²'],
    ['Площадь стен под плитку', 'wall_tile_area', 'м²'],
    ['Площадь дверных проёмов', 'door_area', 'м²'],
    ['Площадь оконных проёмов', 'window_area', 'м²'],
    ['Плинтус (длина)', 'skirting_length', 'м'],
    ['Плинтус (площадь)', 'skirting_area', 'м²'],
    ['Карниз', 'cornice_area', 'м²'],
    ['Стяжка пола (объём)', 'floor_screed_volume', 'м³'],
    ['Площадь под покраску', 'paint_area_net', 'м²'],
    ['Площадь под обои', 'wallpaper_area_net', 'м²'],
  ];

  return (
    <div style={{ padding: 24, maxWidth: 960 }}>
      <h2 style={{ marginTop: 0 }}>Строительный калькулятор</h2>
      <p style={{ color: '#666', fontSize: 13, marginBottom: 20 }}>Введите размеры помещения — система автоматически рассчитает 15 параметров объектa.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 20 }}>
        {/* Размеры */}
        <div style={card}>
          <div style={cardTitle}>Габариты помещения</div>
          <Row label="Длина (м)" value={form.length} onChange={v => n('length', v)} />
          <Row label="Ширина (м)" value={form.width} onChange={v => n('width', v)} />
          <Row label="Высота потолка (м)" value={form.height} onChange={v => n('height', v)} />
        </div>

        {/* Двери */}
        <div style={card}>
          <div style={cardTitle}>Дверные проёмы</div>
          <Row label="Количество дверей" value={form.door_count} onChange={v => n('door_count', v)} integer />
          <Row label="Ширина двери (м)" value={form.door_width} onChange={v => n('door_width', v)} />
          <Row label="Высота двери (м)" value={form.door_height} onChange={v => n('door_height', v)} />
        </div>

        {/* Окна */}
        <div style={card}>
          <div style={cardTitle}>Оконные проёмы</div>
          <Row label="Количество окон" value={form.window_count} onChange={v => n('window_count', v)} integer />
          <Row label="Ширина окна (м)" value={form.window_width} onChange={v => n('window_width', v)} />
          <Row label="Высота окна (м)" value={form.window_height} onChange={v => n('window_height', v)} />
          <Row label="Прочие проёмы (м²)" value={form.extra_opening_area} onChange={v => n('extra_opening_area', v)} />
        </div>

        {/* Потолок */}
        <div style={card}>
          <div style={cardTitle}>Потолок</div>
          <label style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Тип потолка
            <select value={form.ceiling_type} onChange={e => setForm(f => ({ ...f, ceiling_type: e.target.value }))} style={{ ...sel, marginLeft: 8 }}>
              <option value="flat">Плоский</option>
              <option value="slope">Скатный</option>
              <option value="cornice">С карнизом</option>
            </select>
          </label>
          {form.ceiling_type === 'slope' && <Row label="Угол наклона (°)" value={form.slope_angle} onChange={v => n('slope_angle', v)} />}
          <Row label="Ширина карниза (м)" value={form.cornice_width} onChange={v => n('cornice_width', v)} />
        </div>

        {/* Пол и плинтус */}
        <div style={card}>
          <div style={cardTitle}>Пол и отделка</div>
          <Row label="Высота плинтуса (м)" value={form.skirting_height} onChange={v => n('skirting_height', v)} />
          <Row label="Толщина стяжки (м)" value={form.floor_screed_thickness} onChange={v => n('floor_screed_thickness', v)} />
          <Row label="Высота плитки от пола (м)" value={form.tile_height} onChange={v => n('tile_height', v)} />
          <Row label="Доп. площадь стен (ниши, м²)" value={form.extra_wall_area} onChange={v => n('extra_wall_area', v)} />
        </div>
      </div>

      <button onClick={calculate} disabled={calculating} style={{ padding: '10px 28px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
        {calculating ? 'Расчёт...' : 'Рассчитать'}
      </button>

      {result && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ marginBottom: 12 }}>Результаты расчёта</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 8 }}>
            {RESULTS.map(([label, key, unit]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: 6 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#666' }}>{label}</div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{result[key]} <span style={{ fontSize: 12, color: '#888' }}>{unit}</span></div>
                </div>
                <button onClick={() => copy(label, result[key])} title="Копировать значение" style={{ padding: '3px 8px', border: '1px solid #ccc', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 11, color: copied === label ? '#2e7d32' : '#555' }}>
                  {copied === label ? '✓' : '⎘'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, onChange, integer }: { label: string; value: number; onChange: (v: string) => void; integer?: boolean }) {
  return (
    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 12 }}>
      <span>{label}</span>
      <input type="number" step={integer ? '1' : '0.01'} value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: 80, padding: '3px 6px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13, textAlign: 'right' }} />
    </label>
  );
}

const card: React.CSSProperties = { background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6, padding: '14px 16px' };
const cardTitle: React.CSSProperties = { fontWeight: 600, fontSize: 13, marginBottom: 10, color: '#1565c0' };
const sel: React.CSSProperties = { padding: '3px 6px', border: '1px solid #ccc', borderRadius: 4, fontSize: 12 };
