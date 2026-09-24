import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { timeAgo } from '../api.js';
import { useNotifications } from '../context/NotificationContext.jsx';
import { BellIcon, CloseIcon } from './Icons.jsx';

// Bell icon with unread badge and a dropdown list of notifications
export default function NotificationBell() {
  const { items, unread, connected, open, markAllRead, remove, clearAll } = useNotifications();
  const [show, setShow] = useState(false);
  const ref = useRef(null);
  const location = useLocation();

  // Close on page change, outside click and Escape
  useEffect(() => setShow(false), [location.pathname]);
  useEffect(() => {
    if (!show) return undefined;
    const onClick = (e) => !ref.current?.contains(e.target) && setShow(false);
    const onKey = (e) => e.key === 'Escape' && setShow(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [show]);

  return (
    <div className="bell" ref={ref}>
      <button className="icon-btn" onClick={() => setShow((s) => !s)} aria-label={`Notifications (${unread} unread)`} aria-expanded={show}>
        <BellIcon />
        {unread > 0 && <span key={unread} className="badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {show && (
        <div className="bell-panel" role="dialog" aria-label="Notifications">
          <div className="bell-head">
            <strong>Notifications</strong>
            <span className={`live-dot ${connected ? 'on' : ''}`} title={connected ? 'Live updates connected' : 'Reconnecting…'}>
              {connected ? 'Live' : 'Offline'}
            </span>
            {unread > 0 && <button className="link-plain small" onClick={markAllRead}>Mark all read</button>}
          </div>
          {items.length === 0 ? (
            <p className="muted bell-empty">No notifications yet. Order updates will show up here.</p>
          ) : (
            <ul className="bell-list">
              {items.map((n) => (
                <li key={n._id} className={n.read ? '' : 'unread'}>
                  <button className="bell-item" onClick={() => open(n)}>
                    <span className={`bell-type bell-type-${n.type.split('.')[0]}`} />
                    <span className="bell-text">
                      <strong>{n.title}</strong>
                      {n.message && <span>{n.message}</span>}
                      <span className="muted small">{timeAgo(n.createdAt)}</span>
                    </span>
                  </button>
                  <button className="bell-remove" onClick={() => remove(n)} aria-label="Delete notification"><CloseIcon width={14} height={14} /></button>
                </li>
              ))}
            </ul>
          )}
          {items.length > 0 && (
            <div className="bell-foot"><button className="link-plain small" onClick={clearAll}>Clear all</button></div>
          )}
        </div>
      )}
    </div>
  );
}
