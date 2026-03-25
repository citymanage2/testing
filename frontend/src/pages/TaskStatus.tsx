import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../api/client';
import StatusBadge from '../components/StatusBadge';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

interface TaskData {
  id: string;
  task_type: string;
  status: string;
  estimate_status: string | null;
  created_at: string;
  error_message?: string | null;
  messages?: Array<{ role: string; content: string; created_at: string }>;
}

interface ResultFile {
  id: string;
  filename: string;
  file_type: string;
}

export default function TaskStatus() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<TaskData | null>(null);
  const [results, setResults] = useState<ResultFile[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [cancelling, setCancelling] = useState(false);
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
            const { data: resultData } = await client.get<ResultFile[]>(`/tasks/${id}/results`);
            setResults(resultData);
          }
        }
      } catch {
        // ignore poll errors
      }
    };

    poll();
    const interval = task?.status === 'processing' ? 2000 : 5000;
    intervalRef.current = setInterval(poll, interval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [id, task?.status]);

  async function sendMessage() {
    if (!id || !chatInput.trim()) return;
    setSendingMessage(true);
    try {
      await client.post(`/tasks/${id}/message`, { content: chatInput });
      setChatInput('');
    } catch {
      // ignore
    } finally {
      setSendingMessage(false);
    }
  }

  async function cancelTask() {
    if (!id) return;
    setCancelling(true);
    try {
      await client.post(`/tasks/${id}/cancel`);
    } catch {
      // ignore
    } finally {
      setCancelling(false);
    }
  }

  if (!task) {
    return <div style={{ padding: 24 }}>Загрузка...</div>;
  }

  const isActive = ['pending', 'processing'].includes(task.status);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Задача {task.id}</h2>
        <StatusBadge status={task.status} />
      </div>

      <div style={{ marginBottom: 16, color: '#555' }}>
        <p style={{ margin: '0 0 4px' }}>
          <strong>Тип:</strong> {task.task_type}
        </p>
        <p style={{ margin: 0 }}>
          <strong>Создана:</strong> {new Date(task.created_at).toLocaleString('ru-RU')}
        </p>
        {task.error_message && (
          <p style={{ margin: '8px 0 0', color: '#f44336' }}>
            <strong>Ошибка:</strong> {task.error_message}
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {task.status === 'completed' && task.estimate_status !== null && (
          <button
            onClick={() => navigate(`/task/${id}/estimate`)}
            style={{
              padding: '8px 16px',
              background: '#4caf50',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Открыть смету
          </button>
        )}
        {isActive && (
          <button
            onClick={cancelTask}
            disabled={cancelling}
            style={{
              padding: '8px 16px',
              background: '#f44336',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: cancelling ? 'not-allowed' : 'pointer',
            }}
          >
            {cancelling ? 'Отмена...' : 'Отменить'}
          </button>
        )}
      </div>

      {/* Result files */}
      {results.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ marginTop: 0 }}>Результаты</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {results.map((file) => (
              <div
                key={file.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  border: '1px solid #e0e0e0',
                  borderRadius: 4,
                  background: '#fafafa',
                }}
              >
                <span>{file.filename}</span>
                <a
                  href={`${API_BASE}/tasks/${id}/results/${file.id}/download`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: '4px 12px',
                    background: '#1976d2',
                    color: '#fff',
                    borderRadius: 4,
                    textDecoration: 'none',
                    fontSize: 13,
                  }}
                >
                  Скачать
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat interface */}
      <div>
        <h3 style={{ marginTop: 0 }}>Чат</h3>
        <div
          style={{
            border: '1px solid #e0e0e0',
            borderRadius: 4,
            minHeight: 160,
            maxHeight: 320,
            overflowY: 'auto',
            padding: 12,
            background: '#fafafa',
            marginBottom: 8,
          }}
        >
          {(task.messages ?? []).length === 0 ? (
            <p style={{ color: '#aaa', margin: 0 }}>Нет сообщений</p>
          ) : (
            (task.messages ?? []).map((msg, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <span
                  style={{
                    fontWeight: 600,
                    color: msg.role === 'user' ? '#1976d2' : '#555',
                    marginRight: 8,
                  }}
                >
                  {msg.role === 'user' ? 'Вы' : 'AI'}:
                </span>
                <span>{msg.content}</span>
              </div>
            ))
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Сообщение..."
            disabled={sendingMessage}
            style={{ flex: 1, padding: '8px 12px', fontSize: 14, borderRadius: 4, border: '1px solid #ccc' }}
          />
          <button
            onClick={sendMessage}
            disabled={sendingMessage || !chatInput.trim()}
            style={{
              padding: '8px 16px',
              background: '#1976d2',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: sendingMessage ? 'not-allowed' : 'pointer',
            }}
          >
            {sendingMessage ? '...' : 'Отправить'}
          </button>
        </div>
      </div>
    </div>
  );
}
