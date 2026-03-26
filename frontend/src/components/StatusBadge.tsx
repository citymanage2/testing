const COLORS: Record<string, string> = {
  pending: '#ff9800', processing: '#2196f3', completed: '#4caf50',
  failed: '#f44336', cancelled: '#9e9e9e',
};
const LABELS: Record<string, string> = {
  pending: 'Ожидание', processing: 'Обработка', completed: 'Завершено',
  failed: 'Ошибка', cancelled: 'Отменено',
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 12, background: COLORS[status] || '#9e9e9e', color: '#fff', fontSize: 12, fontWeight: 600 }}>
      {LABELS[status] || status}
    </span>
  );
}
