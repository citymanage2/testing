import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { C } from '../ui';

interface Notification {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  reference_type?: string;
  reference_id?: string;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин назад`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ч назад`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'вчера';
  return `${days} д назад`;
}

export default function NotificationBell() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

  const fetchCount = useCallback(() => {
    client.get('/notifications/unread-count')
      .then(r => setCount(r.data.count ?? 0))
      .catch(() => {});
  }, []);

  const fetchNotifications = useCallback(() => {
    setLoading(true);
    client.get('/notifications?limit=20')
      .then(r => setNotifications(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Poll every 60s
  useEffect(() => {
    fetchCount();
    const timer = setInterval(fetchCount, 60000);
    return () => clearInterval(timer);
  }, [fetchCount]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next) fetchNotifications();
  };

  const markRead = async (n: Notification) => {
    if (!n.is_read) {
      await client.patch(`/notifications/${n.id}/read`).catch(() => {});
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
      setCount(c => Math.max(0, c - 1));
    }
    setOpen(false);
    if (n.reference_type === 'project' && n.reference_id) {
      navigate(`/projects/${n.reference_id}`);
    }
  };

  const markAllRead = async () => {
    await client.post('/notifications/read-all').catch(() => {});
    setNotifications(prev => prev.map(x => ({ ...x, is_read: true })));
    setCount(0);
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Bell button */}
      <button
        ref={btnRef}
        onClick={toggleOpen}
        style={{
          position: 'relative',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: 20,
          lineHeight: 1,
          padding: '4px 6px',
          borderRadius: 6,
          color: open ? C.primary : '#fff',
          transition: 'color .15s',
        }}
        title="Уведомления"
      >
        🔔
        {count > 0 && (
          <span style={{
            position: 'absolute',
            top: -2,
            right: -2,
            minWidth: 17,
            height: 17,
            background: C.danger,
            color: '#fff',
            borderRadius: 99,
            fontSize: 10,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            lineHeight: 1,
            border: `2px solid ${C.surface}`,
            pointerEvents: 'none',
          }}>
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            top: 52,
            right: 12,
            width: 360,
            maxHeight: 480,
            background: '#fff',
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,.15)',
            zIndex: 2000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Panel header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: `1px solid ${C.border}`,
            flexShrink: 0,
          }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: C.text }}>Уведомления</span>
            {count > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: C.primary,
                  padding: 0,
                  fontFamily: 'inherit',
                }}
              >
                Отметить все прочитанными
              </button>
            )}
          </div>

          {/* Notification list */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>Загрузка...</div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>Нет уведомлений</div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => markRead(n)}
                  style={{
                    padding: '10px 16px',
                    borderBottom: `1px solid ${C.border}`,
                    cursor: 'pointer',
                    background: n.is_read ? '#fff' : C.primaryBg,
                    borderLeft: n.is_read ? 'none' : `3px solid ${C.primary}`,
                    paddingLeft: n.is_read ? 16 : 13,
                    transition: 'background .1s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = n.is_read ? C.surfaceAlt : '#dbeafe'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = n.is_read ? '#fff' : C.primaryBg; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: n.is_read ? 400 : 600, color: C.text, lineHeight: 1.3 }}>
                      {n.title}
                    </span>
                    <span style={{ fontSize: 11, color: C.textMuted, flexShrink: 0, marginTop: 1 }}>
                      {relativeTime(n.created_at)}
                    </span>
                  </div>
                  {n.body && (
                    <div style={{
                      fontSize: 12,
                      color: C.textSec,
                      marginTop: 2,
                      lineHeight: 1.4,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    } as React.CSSProperties}>
                      {n.body}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
