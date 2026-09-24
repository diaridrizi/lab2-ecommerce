// Real-time notifications over WebSockets (Socket.IO).
// When logged in we open one connection, authenticated with the access token. The server pushes:
//   "notification"          - a new notification (bell menu + toast)
//   "notifications:sync"    - unread count changed in another tab
//   "order:created|updated|deleted" - live data, pages listen with useRealtime()
//   "session:ended"         - logged out everywhere / password reset by an admin
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { api, auth, refreshSession } from '../api.js';
import { useAuth } from './AuthContext.jsx';

const NotificationContext = createContext(null);
const TOAST_MS = 6000;

export function NotificationProvider({ children }) {
  const { user, endSession } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const listeners = useRef(new Map()); // event -> Set(handler)

  const load = useCallback(() => {
    api.get('/notifications?limit=20').then((d) => { setItems(d.items); setUnread(d.unread); }).catch(() => {});
  }, []);

  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x._id !== id)), []);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setUnread(0);
      setToasts([]);
      return undefined;
    }
    load();

    // `auth` as a function: every (re)connect sends the newest access token
    const socket = io({ auth: (cb) => cb({ token: auth.getToken() }), reconnectionDelayMax: 10_000 });
    socketRef.current = socket;
    let retries = 0;

    socket.on('connect', () => {
      retries = 0;
      setConnected(true);
      load(); // catch up on anything we missed while disconnected
    });
    socket.on('disconnect', (reason) => {
      setConnected(false);
      // The server closed it (e.g. role or password changed): reconnect with a fresh token
      // If the refresh fails too, this device's session was revoked (password changed elsewhere)
      if (reason === 'io server disconnect') refreshSession().then(() => socket.connect()).catch(endSession);
    });
    // Handshake refused: usually the access token expired -> refresh it and try again (a few times)
    socket.on('connect_error', (err) => {
      if (err.message !== 'unauthorized' || retries++ >= 3) return;
      refreshSession().then(() => socket.connect()).catch(endSession);
    });

    socket.on('notification', (n) => {
      setItems((list) => [n, ...list].slice(0, 50));
      setUnread((c) => c + 1);
      setToasts((t) => [...t, n].slice(-3));
      setTimeout(() => dismissToast(n._id), TOAST_MS);
    });
    socket.on('notifications:sync', ({ unread: count }) => {
      setUnread(count);
      load();
    });
    socket.on('session:ended', () => {
      socket.disconnect();
      endSession();
      navigate('/login', { state: { message: 'You were logged out on this device.' } });
    });

    // Forward live data events to pages that subscribed with useRealtime()
    socket.onAny((event, data) => {
      listeners.current.get(event)?.forEach((fn) => fn(data));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
    // Reconnect only when a different user logs in (not on every user object refresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role]);

  const subscribe = useCallback((event, fn) => {
    if (!listeners.current.has(event)) listeners.current.set(event, new Set());
    listeners.current.get(event).add(fn);
    return () => listeners.current.get(event)?.delete(fn);
  }, []);

  const markRead = async (n) => {
    if (n.read) return;
    setItems((list) => list.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
    setUnread((c) => Math.max(0, c - 1));
    await api.patch(`/notifications/${n._id}`, { read: true }).catch(load);
  };
  const markAllRead = async () => {
    setItems((list) => list.map((x) => ({ ...x, read: true })));
    setUnread(0);
    await api.post('/notifications/read-all').catch(load);
  };
  const remove = async (n) => {
    setItems((list) => list.filter((x) => x._id !== n._id));
    if (!n.read) setUnread((c) => Math.max(0, c - 1));
    await api.del(`/notifications/${n._id}`).catch(load);
  };
  const clearAll = async () => {
    setItems([]);
    setUnread(0);
    await api.del('/notifications').catch(load);
  };

  // Click on a notification: mark it read and open its page
  const open = (n) => {
    markRead(n);
    dismissToast(n._id);
    if (n.link) navigate(n.link);
  };

  return (
    <NotificationContext.Provider value={{ items, unread, connected, markRead, markAllRead, remove, clearAll, open, subscribe }}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t._id} className={`toast toast-${t.type.split('.')[0]}`} role="status">
            <button className="toast-body" onClick={() => open(t)}>
              <strong>{t.title}</strong>
              {t.message && <span>{t.message}</span>}
            </button>
            <button className="toast-close" onClick={() => dismissToast(t._id)} aria-label="Dismiss">×</button>
            <span className="toast-timer" style={{ animationDuration: `${TOAST_MS}ms` }} />
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);

// Run `handler` whenever the server sends `event`, e.g. useRealtime('order:updated', (o) => ...)
export function useRealtime(event, handler) {
  const { subscribe } = useNotifications();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => subscribe(event, (data) => ref.current(data)), [event, subscribe]);
}
