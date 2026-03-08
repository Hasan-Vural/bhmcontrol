import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = window.localStorage.getItem('auth_token');
    if (!saved) {
      setLoading(false);
      return;
    }
    api.setAuthToken(saved);
    api
      .authMe()
      .then((res) => {
        setUser(res.user || null);
      })
      .catch(() => {
        setUser(null);
        window.localStorage.removeItem('auth_token');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (loginId, password) => {
    const body = String(loginId).includes('@')
      ? { email: loginId, password }
      : { username: loginId, password };
    const res = await api.authLogin(body);
    if (res.token) {
      window.localStorage.setItem('auth_token', res.token);
      api.setAuthToken(res.token);
    }
    setUser(res.user);
    return res.user;
  };

  const impersonate = async (userId, testHesapToken) => {
    const res = testHesapToken
      ? await api.testHesap.impersonate(userId, testHesapToken)
      : await api.authImpersonate({ userId });
    if (res.token) {
      window.localStorage.setItem('auth_token', res.token);
      api.setAuthToken(res.token);
    }
    setUser(res.user);
    return res.user;
  };

  const logout = async () => {
    try {
      await api.authLogout();
    } catch {
      // ignore
    }
    window.localStorage.removeItem('auth_token');
    api.setAuthToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, impersonate }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

