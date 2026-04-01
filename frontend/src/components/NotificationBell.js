import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { C } from '../ui';
function relativeTime(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)
        return 'только что';
    if (mins < 60)
        return `${mins} мин назад`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)
        return `${hrs} ч назад`;
    const days = Math.floor(hrs / 24);
    if (days === 1)
        return 'вчера';
    return `${days} д назад`;
}
export default function NotificationBell() {
    const [count, setCount] = useState(0);
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);
    const panelRef = useRef(null);
    const btnRef = useRef(null);
    const navigate = useNavigate();
    const fetchCount = useCallback(() => {
        client.get('/notifications/unread-count')
            .then(r => setCount(r.data.count ?? 0))
            .catch(() => { });
    }, []);
    const fetchNotifications = useCallback(() => {
        setLoading(true);
        client.get('/notifications?limit=20')
            .then(r => setNotifications(r.data))
            .catch(() => { })
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
        if (!open)
            return;
        const handler = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target) &&
                btnRef.current && !btnRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);
    const toggleOpen = () => {
        const next = !open;
        setOpen(next);
        if (next)
            fetchNotifications();
    };
    const markRead = async (n) => {
        if (!n.is_read) {
            await client.patch(`/notifications/${n.id}/read`).catch(() => { });
            setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
            setCount(c => Math.max(0, c - 1));
        }
        setOpen(false);
        if (n.reference_type === 'project' && n.reference_id) {
            navigate(`/projects/${n.reference_id}`);
        }
    };
    const markAllRead = async () => {
        await client.post('/notifications/read-all').catch(() => { });
        setNotifications(prev => prev.map(x => ({ ...x, is_read: true })));
        setCount(0);
    };
    return (_jsxs("div", { style: { position: 'relative', display: 'inline-block' }, children: [_jsxs("button", { ref: btnRef, onClick: toggleOpen, style: {
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
                }, title: "\u0423\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F", children: ["\uD83D\uDD14", count > 0 && (_jsx("span", { style: {
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
                            border: `2px solid ${C.headerBg}`,
                            pointerEvents: 'none',
                        }, children: count > 99 ? '99+' : count }))] }), open && (_jsxs("div", { ref: panelRef, style: {
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
                }, children: [_jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            borderBottom: `1px solid ${C.border}`,
                            flexShrink: 0,
                        }, children: [_jsx("span", { style: { fontWeight: 600, fontSize: 14, color: C.text }, children: "\u0423\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F" }), count > 0 && (_jsx("button", { onClick: markAllRead, style: {
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    color: C.primary,
                                    padding: 0,
                                    fontFamily: 'inherit',
                                }, children: "\u041E\u0442\u043C\u0435\u0442\u0438\u0442\u044C \u0432\u0441\u0435 \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u043D\u043D\u044B\u043C\u0438" }))] }), _jsx("div", { style: { overflowY: 'auto', flex: 1 }, children: loading ? (_jsx("div", { style: { padding: 24, textAlign: 'center', color: C.textMuted, fontSize: 13 }, children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430..." })) : notifications.length === 0 ? (_jsx("div", { style: { padding: 24, textAlign: 'center', color: C.textMuted, fontSize: 13 }, children: "\u041D\u0435\u0442 \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0439" })) : (notifications.map(n => (_jsxs("div", { onClick: () => markRead(n), style: {
                                padding: '10px 16px',
                                borderBottom: `1px solid ${C.border}`,
                                cursor: 'pointer',
                                background: n.is_read ? '#fff' : C.primaryBg,
                                borderLeft: n.is_read ? 'none' : `3px solid ${C.primary}`,
                                paddingLeft: n.is_read ? 16 : 13,
                                transition: 'background .1s',
                            }, onMouseEnter: e => { e.currentTarget.style.background = n.is_read ? C.surfaceAlt : '#dbeafe'; }, onMouseLeave: e => { e.currentTarget.style.background = n.is_read ? '#fff' : C.primaryBg; }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }, children: [_jsx("span", { style: { fontSize: 13, fontWeight: n.is_read ? 400 : 600, color: C.text, lineHeight: 1.3 }, children: n.title }), _jsx("span", { style: { fontSize: 11, color: C.textMuted, flexShrink: 0, marginTop: 1 }, children: relativeTime(n.created_at) })] }), n.body && (_jsx("div", { style: {
                                        fontSize: 12,
                                        color: C.textSec,
                                        marginTop: 2,
                                        lineHeight: 1.4,
                                        overflow: 'hidden',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                    }, children: n.body }))] }, n.id)))) })] }))] }));
}
