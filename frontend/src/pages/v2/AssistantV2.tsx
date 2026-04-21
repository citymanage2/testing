import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import client from '../../api/client';
import { assistantV2Api } from '../../api/v2';
import { C, T, CARD, INPUT, btnPrimary, btnOutline } from '../../ui';

const MODULES = [
  { value: 'estimate', label: 'Сметы' },
  { value: 'grp', label: 'ГПР' },
  { value: 'warehouse', label: 'Склад' },
  { value: 'finance', label: 'Финансы' },
];

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  module?: string;
  timestamp: Date;
  error?: boolean;
}

interface Project { id: string; name: string; }

export default function AssistantV2() {
  const [searchParams] = useSearchParams();
  const projectIdParam = searchParams.get('project_id') ?? '';

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(projectIdParam);
  const [module, setModule] = useState('finance');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    client.get<Project[]>('/projects').then(r => setProjects(r.data)).catch(() => {});
  }, []);

  async function handleSend() {
    if (!projectId || !input.trim() || sending) return;
    const question = input.trim();
    setInput('');

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: question,
      module,
      timestamp: new Date(),
    };
    setMessages(ms => [...ms, userMsg]);
    setSending(true);

    try {
      const resp = await assistantV2Api.ask(projectId, question, module);
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: resp.answer,
        timestamp: new Date(),
      };
      setMessages(ms => [...ms, assistantMsg]);
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: detail ?? 'Ошибка ассистента. Попробуйте позже.',
        timestamp: new Date(),
        error: true,
      };
      setMessages(ms => [...ms, errMsg]);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const QUICK_QUESTIONS = [
    'Как дела с маржой?',
    'Какие риски по ГПР?',
    'Есть ли перерасход материалов?',
    'Прогноз выручки до конца проекта',
  ];

  return (
    <div style={{ padding: '0 20px 40px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      <h1 style={{ ...T.h1, marginBottom: 16, flexShrink: 0 }}>ИИ-ассистент проекта</h1>

      {/* Settings bar */}
      <div style={{ ...CARD, marginBottom: 12, flexShrink: 0, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 500 }}>
          Проект
          <select style={{ ...INPUT, width: 280 }} value={projectId} onChange={e => { setProjectId(e.target.value); setMessages([]); }}>
            <option value="">— выберите проект —</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 500 }}>
          Модуль
          <select style={{ ...INPUT, width: 180 }} value={module} onChange={e => setModule(e.target.value)}>
            {MODULES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </label>
        {projectId && (
          <button style={{ ...btnOutline('sm'), marginTop: 18 }} onClick={() => setMessages([])}>Очистить чат</button>
        )}
      </div>

      {!projectId ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMuted }}>
          Выберите проект для начала диалога
        </div>
      ) : (
        <>
          {/* Messages area */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12, minHeight: 0 }}>
            {messages.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 16 }}>
                <div style={{ fontSize: 40 }}>🤖</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Спросите ассистента о проекте</div>
                <div style={{ fontSize: 13, color: C.textSec, textAlign: 'center', maxWidth: 400 }}>
                  Ассистент имеет доступ к данным сметы, ГПР, складу и финансам выбранного проекта.
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 500 }}>
                  {QUICK_QUESTIONS.map(q => (
                    <button
                      key={q}
                      onClick={() => setInput(q)}
                      style={{
                        padding: '6px 12px', borderRadius: 20, border: `1px solid ${C.border}`,
                        background: C.surface, cursor: 'pointer', fontSize: 12, color: C.textSec,
                        transition: 'background .15s, color .15s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.primaryBg; (e.currentTarget as HTMLButtonElement).style.color = C.primary; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = C.surface; (e.currentTarget as HTMLButtonElement).style.color = C.textSec; }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(msg => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div style={{
                  maxWidth: '72%',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: msg.role === 'user' ? C.primary : msg.error ? C.dangerBg : C.surface,
                  color: msg.role === 'user' ? '#fff' : msg.error ? C.danger : C.text,
                  fontSize: 13,
                  lineHeight: 1.6,
                  border: msg.role === 'assistant' ? `1px solid ${msg.error ? C.dangerBorder : C.border}` : 'none',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.role === 'assistant' && !msg.error && (
                    <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>
                      🤖 Ассистент · {msg.timestamp.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                  {msg.role === 'user' && (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
                      {MODULES.find(m => m.value === msg.module)?.label ?? msg.module} · {msg.timestamp.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                  {msg.text}
                </div>
              </div>
            ))}

            {sending && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '10px 14px', borderRadius: '18px 18px 18px 4px', background: C.surface, border: `1px solid ${C.border}`, fontSize: 13, color: C.textSec }}>
                  <span style={{ animation: 'pulse 1.5s infinite' }}>Думаю...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div style={{ ...CARD, flexShrink: 0, display: 'flex', gap: 10, alignItems: 'flex-end', padding: '12px 16px' }}>
            <textarea
              style={{
                ...INPUT,
                resize: 'none',
                minHeight: 44,
                maxHeight: 160,
                lineHeight: 1.5,
                padding: '10px 12px',
              }}
              placeholder={`Спросите о ${MODULES.find(m => m.value === module)?.label.toLowerCase() ?? 'проекте'}...`}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={sending}
            />
            <button
              style={{ ...btnPrimary('md'), flexShrink: 0, height: 44, paddingLeft: 18, paddingRight: 18 }}
              onClick={handleSend}
              disabled={sending || !input.trim()}
            >
              {sending ? '...' : '→'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, textAlign: 'center', flexShrink: 0 }}>
            Enter — отправить · Shift+Enter — новая строка
          </div>
        </>
      )}
    </div>
  );
}
