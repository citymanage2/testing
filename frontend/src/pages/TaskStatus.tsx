import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../api/client';
import StatusBadge from '../components/StatusBadge';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

interface TaskData {
  id: string; task_type: string; status: string; estimate_status: string | null;
  created_at: string; error_message?: string | null;
  messages?: Array<{ role: string; content: string; created_at: string }>;
}
interface ResultFile { id: number; file_name: string; mime_type: string; }

export default function TaskStatus() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<TaskData | null>(null);
  const [results, setResults] = useState<ResultFile[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [copied, setCopied] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!id) return;
    const poll = async () => {
      try {
        const { data } = await client.get<TaskData>(`/tasks/${id}/status`);
        setTask(data);
        if (['completed', 'failed', 'cancelled'].includes(data.status)) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          if (data.status === 'completed') {
            const { data: r } = await client.get<ResultFile[]>(`/tasks/${id}/results`);
            setResults(r);
          }
        }
      } catch { /* ignore */ }
    };
    poll();
    intervalRef.current = setInterval(poll, 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [id]);

  async function sendMessage() {
    if (!id || !chatInput.trim()) return;
    setSending(true);
    try { await client.post(`/tasks/${id}/message`, { content: chatInput }); setChatInput(''); }
    catch { /* ignore */ }
    finally { setSending(false); }
  }

  function buildLog(): string {
    if (!task) return '';
    const lines = [`Задача: ${task.id}`, `Тип: ${task.task_type}`, `Статус: ${task.status}`, `Создана: ${new Date(task.created_at).toLocaleString('ru-RU')}`];
    if (task.error_message) lines.push(`Ошибка: ${task.error_message}`);
    const msgs = task.messages ?? [];
    if (msgs.length) { lines.push('', '--- Сообщения ---'); msgs.forEach((m) => lines.push(`[${m.role === 'user' ? 'Вы' : 'AI'}] ${m.content}`)); }
    return lines.join('\n');
  }

  function downloadLog() {
    const blob = new Blob([buildLog()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `task-${id}-log.txt`; a.click();
    URL.revokeObjectURL(url);
  }

  async function copyLog() {
    await navigator.clipboard.writeText(buildLog());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!task) return <div style={{ padding: 24 }}>Загрузка...</div>;
  const isActive = ['pending', 'processing'].includes(task.status);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Задача {task.id.slice(0, 8)}…</h2>
        <StatusBadge status={task.status} />
      </div>
      <p style={{ margin: '0 0 4px', color: '#555' }}><strong>Тип:</strong> {task.task_type}</p>
      <p style={{ margin: '0 0 16px', color: '#555' }}><strong>Создана:</strong> {new Date(task.created_at).toLocaleString('ru-RU')}</p>
      {task.error_message && <p style={{ color: '#f44336' }}><strong>Ошибка:</strong> {task.error_message}</p>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {task.status === 'completed' && task.estimate_status !== null && (
          <button onClick={() => navigate(`/task/${id}/estimate`)} style={btn('#4caf50')}>Открыть смету</button>
        )}
        {isActive && (
          <button onClick={async () => { setCancelling(true); try { await client.post(`/tasks/${id}/cancel`); } catch { /**/ } finally { setCancelling(false); } }} disabled={cancelling} style={btn('#f44336')}>
            {cancelling ? 'Отмена...' : 'Отменить'}
          </button>
        )}
      </div>

      {results.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ marginTop: 0 }}>Результаты</h3>
          {results.map((f) => (
            <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: 4, background: '#fafafa', marginBottom: 6 }}>
              <span>{f.file_name}</span>
              <a href={`${API_BASE}/results/${f.id}/download`} target="_blank" rel="noreferrer" style={{ padding: '4px 12px', background: '#1565c0', color: '#fff', borderRadius: 4, textDecoration: 'none', fontSize: 13 }}>Скачать</a>
            </div>
          ))}
        </div>
      )}

      <div>
        <h3 style={{ marginTop: 0 }}>Чат</h3>
        <div style={{ border: '1px solid #e0e0e0', borderRadius: 4, minHeight: 140, maxHeight: 300, overflowY: 'auto', padding: 12, background: '#fafafa', marginBottom: 8 }}>
          {(task.messages ?? []).length === 0 ? <p style={{ color: '#aaa', margin: 0 }}>Нет сообщений</p>
            : (task.messages ?? []).map((m, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <span style={{ fontWeight: 600, color: m.role === 'user' ? '#1565c0' : '#555', marginRight: 8 }}>{m.role === 'user' ? 'Вы' : 'AI'}:</span>
                <span>{m.content}</span>
              </div>
            ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder="Уточните смету..." disabled={sending} style={{ flex: 1, padding: '8px 12px', fontSize: 14, borderRadius: 4, border: '1px solid #ccc' }} />
          <button onClick={sendMessage} disabled={sending || !chatInput.trim()} style={btn('#1565c0')}>{sending ? '...' : 'Отправить'}</button>
        </div>
      </div>

      <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #e0e0e0', display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: '#888' }}>Логи:</span>
        <button onClick={downloadLog} style={btn('#546e7a')}>Скачать .txt</button>
        <button onClick={copyLog} style={btn(copied ? '#4caf50' : '#78909c')}>{copied ? 'Скопировано!' : 'Копировать'}</button>
      </div>
    </div>
  );
}

function btn(bg: string): React.CSSProperties {
  return { padding: '7px 14px', background: bg, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 500 };
}
