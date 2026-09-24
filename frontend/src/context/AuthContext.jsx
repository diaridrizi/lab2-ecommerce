import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, auth, refreshSession } from '../api.js';

const AuthContext = createContext(null);

// Tells the other open tabs about login/logout, so they stay in sync
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('shop-auth') : null;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true while we restore the session on page load

  const endSession = useCallback(() => {
    auth.setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    try { localStorage.removeItem('shop_token'); } catch { /* old version stored the JWT here */ }
    auth.onSessionEnded(endSession);
    // Keep the same object when nothing changed, so pages that depend on `user` don't reload
    auth.onUserRefreshed((fresh) =>
      setUser((old) => (old && JSON.stringify(old) === JSON.stringify(fresh) ? old : fresh))
    );

    // On page load: the access token is gone (it was only in memory), so use the refresh cookie to get a new one
    if (auth.hasSessionHint()) {
      refreshSession().catch(endSession).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }

    const onMessage = (e) => {
      if (e.data === 'logout') endSession();
      if (e.data === 'login') refreshSession().catch(() => {});
    };
    channel?.addEventListener('message', onMessage);
    return () => channel?.removeEventListener('message', onMessage);
  }, [endSession]);

  const handleAuth = (data) => {
    auth.setToken(data.accessToken);
    setUser(data.user);
    channel?.postMessage('login');
    return data.user;
  };

  const login = async (email, password) => handleAuth(await api.post('/auth/login', { email, password }));
  const register = async (name, email, password) =>
    handleAuth(await api.post('/auth/register', { name, email, password }));

  // Log out this device: the server revokes the refresh token and clears the cookie
  const logout = async () => {
    await api.post('/auth/logout').catch(() => {});
    endSession();
    channel?.postMessage('logout');
  };

  // Log out on every device
  const logoutEverywhere = async () => {
    await api.post('/auth/logout-all');
    endSession();
    channel?.postMessage('logout');
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, logoutEverywhere, endSession, isAdmin: user?.role === 'admin' }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
