interface StatusConfig {
  label: string;
  color: string;
  animated?: boolean;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  pending:    { label: 'Ожидание',        color: '#888' },
  processing: { label: 'Обработка...',    color: '#2196f3', animated: true },
  completed:  { label: 'Завершено',       color: '#4caf50' },
  failed:     { label: 'Ошибка',          color: '#f44336' },
  cancelled:  { label: 'Отменено',        color: '#ff9800' },
  uploaded:   { label: 'Загружено',       color: '#9e9e9e' },
  calculated: { label: 'Рассчитано',      color: '#2196f3' },
  optimized:  { label: 'Оптимизировано',  color: '#4caf50' },
};

interface Props {
  status: string;
}

export default function StatusBadge({ status }: Props) {
  const config = STATUS_CONFIG[status] ?? { label: status, color: '#888' };

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 12,
        background: config.color,
        color: '#fff',
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: 0.2,
        opacity: config.animated ? undefined : 1,
        animation: config.animated ? 'pulse 1.5s ease-in-out infinite' : undefined,
      }}
    >
      {config.label}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </span>
  );
}
