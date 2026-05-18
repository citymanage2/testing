import { useState } from 'react';

const BTN: Record<string, string> = {
  AC: '#a5a5a5', '+/-': '#a5a5a5', '%': '#a5a5a5',
  '÷': '#f1a33c', '×': '#f1a33c', '−': '#f1a33c', '+': '#f1a33c', '=': '#f1a33c',
};

const KEYS = [
  ['AC', '+/-', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '−'],
  ['1', '2', '3', '+'],
  ['0', '.', '='],
];

const OPS: Record<string, (a: number, b: number) => number> = {
  '÷': (a, b) => a / b,
  '×': (a, b) => a * b,
  '−': (a, b) => a - b,
  '+': (a, b) => a + b,
};

export default function App() {
  const [display, setDisplay] = useState('0');
  const [prev, setPrev] = useState<number | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [fresh, setFresh] = useState(false);

  function press(key: string) {
    if (key === 'AC') {
      setDisplay('0'); setPrev(null); setOp(null); setFresh(false);
    } else if (key === '+/-') {
      setDisplay(d => d.startsWith('-') ? d.slice(1) : '-' + d);
    } else if (key === '%') {
      setDisplay(d => String(parseFloat(d) / 100));
    } else if (key in OPS) {
      setPrev(parseFloat(display));
      setOp(key);
      setFresh(true);
    } else if (key === '=') {
      if (prev !== null && op) {
        const result = OPS[op](prev, parseFloat(display));
        setDisplay(String(parseFloat(result.toPrecision(12))));
        setPrev(null); setOp(null); setFresh(false);
      }
    } else if (key === '.') {
      const base = fresh ? '0' : display;
      if (!base.includes('.')) { setDisplay(base + '.'); setFresh(false); }
    } else {
      if (display === '0' || fresh) { setDisplay(key); setFresh(false); }
      else if (display.length < 12) setDisplay(display + key);
    }
  }

  const fmt = (v: string) => {
    const n = parseFloat(v);
    if (isNaN(n)) return v;
    if (Math.abs(n) >= 1e12) return n.toExponential(4);
    const s = v.includes('.') ? v : String(n);
    return s.length > 12 ? String(parseFloat(n.toPrecision(9))) : s;
  };

  const fontSize = display.length > 9 ? 36 : display.length > 6 ? 48 : 64;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1c1c1e', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <div style={{ width: 320, borderRadius: 40, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
        {/* Display */}
        <div style={{ background: '#000', padding: '32px 24px 16px', textAlign: 'right' }}>
          <div style={{ color: '#fff', fontSize, fontWeight: 300, lineHeight: 1.1, minHeight: 80, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', wordBreak: 'break-all' }}>
            {fmt(display)}
          </div>
        </div>
        {/* Buttons */}
        <div style={{ background: '#000', padding: '0 12px 12px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {KEYS.flat().map((key, i) => {
            const bg = BTN[key] ?? '#333';
            const isZero = key === '0';
            return (
              <button
                key={i}
                onClick={() => press(key)}
                style={{
                  gridColumn: isZero ? 'span 2' : undefined,
                  background: op === key && key in OPS ? '#fff' : bg,
                  color: op === key && key in OPS ? '#f1a33c' : (bg === '#a5a5a5' ? '#000' : '#fff'),
                  border: 'none',
                  borderRadius: 50,
                  height: 72,
                  fontSize: 28,
                  fontWeight: 400,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isZero ? 'flex-start' : 'center',
                  paddingLeft: isZero ? 28 : 0,
                  transition: 'opacity .1s',
                }}
                onMouseDown={e => (e.currentTarget.style.opacity = '0.7')}
                onMouseUp={e => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                {key}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
