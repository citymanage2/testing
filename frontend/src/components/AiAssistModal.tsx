import { useState } from 'react';
import client from '../api/client';
import { C, btnPrimary, btnGhost, INPUT, OVERLAY, MODAL } from '../ui';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  taskId: string;
  onClose: () => void;
  selectedIds?: Set<string>;       // items selected in EstimateView
  onPricesApplied?: () => void;    // callback to reload estimate after fill
}

interface AiResponse {
  response: string;
  used_ai: boolean;
}

interface FillPricesResponse {
  updated: number;
  total_sent: number;
  message: string;
}

const FILL_PRICES_CHIP = 'Заполнить цены';

// ─── Suggestion chips ─────────────────────────────────────────────────────────

const CHIPS = [
  FILL_PRICES_CHIP,
  'Найти позиции с нулевыми ценами',
  'Проверить наличие разделов',
  'Найти дублирующиеся позиции',
  'Проанализировать структуру сметы',
  'Предложить разбивку по видам работ',
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function AiAssistModal({ taskId, onClose, selectedIds, onPricesApplied }: Props) {
  const [prompt, setPrompt]       = useState('');
  const [response, setResponse]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [usedAi, setUsedAi]       = useState(false);
  const [isFillMode, setIsFillMode] = useState(false);

  const isFillPricesChip = prompt === FILL_PRICES_CHIP;

  // ── Fill prices helper ──────────────────────────────────────────────────────

  async function callFillPrices(promptText: string) {
    try {
      const itemIds = selectedIds && selectedIds.size > 0 ? Array.from(selectedIds) : undefined;
      const { data } = await client.post<FillPricesResponse>(
        `/projects/estimates/${taskId}/ai-fill-prices`,
        { item_ids: itemIds, prompt: promptText },
      );
      setResponse(data.message ?? '');
      setUsedAi(true);
      setIsFillMode(true);
      if (data.updated > 0 && onPricesApplied) onPricesApplied();
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || 'неизвестная ошибка';
      setResponse(`Ошибка при заполнении цен: ${detail}`);
      setUsedAi(false);
    } finally {
      setLoading(false);
    }
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setResponse('');
    setIsFillMode(false);

    // "Заполнить цены" — special endpoint
    if (isFillPricesChip) {
      await callFillPrices('');
      return;
    }

    // Detect price-fill intent in free-form prompt
    const lowerPrompt = prompt.toLowerCase();
    const isPriceFillIntent = (
      lowerPrompt.includes('заполни') || lowerPrompt.includes('проставь') ||
      lowerPrompt.includes('рассчита')
    ) && (
      lowerPrompt.includes('цен') || lowerPrompt.includes('стоимост') || lowerPrompt.includes('прайс')
    );

    if (isPriceFillIntent) {
      await callFillPrices(prompt.trim());
      return;
    }

    // Regular analysis
    try {
      const { data } = await client.post<AiResponse>(
        `/projects/estimates/${taskId}/ai-assist`,
        { prompt: prompt.trim() },
      );
      setResponse(data.response ?? '');
      setUsedAi(data.used_ai ?? false);
    } catch {
      setResponse('Произошла ошибка при обращении к серверу.');
      setUsedAi(false);
    } finally {
      setLoading(false);
    }
  }

  // ── Key handler ─────────────────────────────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={OVERLAY} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        style={{
          ...MODAL,
          maxWidth: 600,
          maxHeight: '80vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 2,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text }}>
            🤖 ИИ-помощник по смете
          </h2>
          <button
            style={{
              ...btnGhost('sm'),
              fontSize: 18,
              lineHeight: 1,
              padding: '2px 8px',
              color: C.textMuted,
            }}
            onClick={onClose}
            data-tooltip="Закрыть ИИ-помощник"
          >
            ✕
          </button>
        </div>

        {/* Suggestion chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {CHIPS.map((chip) => (
            <button
              key={chip}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '5px 12px',
                borderRadius: 99,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                background: prompt === chip ? C.primaryBg : C.surfaceAlt,
                color: prompt === chip ? C.primary : C.textSec,
                border: `1px solid ${prompt === chip ? C.primary : C.border}`,
                transition: 'all .15s',
              }}
              onClick={() => setPrompt(chip)}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Textarea */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label
            htmlFor="ai-prompt"
            style={{ fontSize: 13, fontWeight: 500, color: C.text }}
          >
            Запрос
          </label>
          <textarea
            id="ai-prompt"
            rows={6}
            style={{
              ...INPUT,
              resize: 'vertical',
              fontFamily: 'inherit',
              lineHeight: 1.5,
            }}
            placeholder="Опишите что нужно сделать со сметой..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <span style={{ fontSize: 11, color: C.textMuted }}>
            Ctrl+Enter для отправки
          </span>
        </div>

        {/* Selected items hint for fill mode */}
        {isFillPricesChip && (
          <div style={{ fontSize: 12, color: C.textSec, background: C.primaryBg, borderRadius: 6, padding: '8px 12px', border: `1px solid ${C.primary}` }}>
            {selectedIds && selectedIds.size > 0
              ? `💡 Будут заполнены цены для ${selectedIds.size} выбранных позиций`
              : '💡 Будут заполнены цены для всех позиций с нулевой ценой'}
          </div>
        )}

        {/* Submit button */}
        <div>
          <button
            style={{
              ...btnPrimary('md'),
              opacity: loading || !prompt.trim() ? 0.6 : 1,
              cursor: loading || !prompt.trim() ? 'not-allowed' : 'pointer',
            }}
            disabled={loading || !prompt.trim()}
            onClick={handleSubmit}
            data-tooltip="Отправить запрос ИИ-помощнику для анализа или доработки сметы (Ctrl+Enter)"
          >
            {loading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <LoadingDots /> {isFillPricesChip ? 'Заполняю цены...' : 'Анализирую...'}
              </span>
            ) : isFillPricesChip ? (
              '💰 Заполнить цены'
            ) : (
              '🔍 Анализировать'
            )}
          </button>
        </div>

        {/* Response area */}
        {response && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {/* Badge */}
            <div>
              {usedAi ? (
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 10px',
                    borderRadius: 99,
                    fontSize: 11,
                    fontWeight: 600,
                    background: isFillMode ? '#e8f5e9' : C.primaryBg,
                    color: isFillMode ? '#2e7d32' : C.primary,
                    border: `1px solid ${isFillMode ? '#4caf50' : C.primary}`,
                  }}
                >
                  {isFillMode ? '✅ Цены заполнены' : '✨ Ответ ИИ'}
                </span>
              ) : (
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 10px',
                    borderRadius: 99,
                    fontSize: 11,
                    fontWeight: 600,
                    background: C.surfaceAlt,
                    color: C.textSec,
                    border: `1px solid ${C.border}`,
                  }}
                >
                  ⚙️ Автоматический анализ
                </span>
              )}
            </div>

            {/* Response text */}
            <div
              style={{
                whiteSpace: 'pre-wrap',
                background: C.surfaceAlt,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: '12px 14px',
                fontSize: 13,
                color: C.text,
                lineHeight: 1.6,
                overflowX: 'auto',
              }}
            >
              {response}
            </div>

            {/* Hint when AI was not used */}
            {!usedAi && (
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  color: C.textMuted,
                  lineHeight: 1.5,
                }}
              >
                Для расширенного анализа с ИИ установите переменную{' '}
                <code
                  style={{
                    fontFamily: 'monospace',
                    background: C.surfaceAlt,
                    padding: '1px 5px',
                    borderRadius: 3,
                    border: `1px solid ${C.border}`,
                  }}
                >
                  ANTHROPIC_API_KEY
                </code>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Loading dots animation ───────────────────────────────────────────────────

function LoadingDots() {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
      }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: '#fff',
            display: 'inline-block',
            animation: `aiDotBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes aiDotBounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%            { transform: scale(1);   opacity: 1;   }
        }
      `}</style>
    </span>
  );
}
