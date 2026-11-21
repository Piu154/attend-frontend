import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { api } from './api';

const AuthContext = createContext(null);
const STORAGE_KEY = 'attend.session';

// sessionStorage keeps you signed in on refresh, and signs you out when the tab is closed
function loadSession() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(loadSession);

  const login = useCallback(async (email, password) => {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } });
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setSession(data);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, []);

  // like api(), but adds the login token and signs you out if the token has expired
  const request = useCallback(
    async (path, options = {}) => {
      try {
        return await api(path, { ...options, token: session?.accessToken });
      } catch (e) {
        if (e.status === 401) logout();
        throw e;
      }
    },
    [session, logout],
  );

  const value = useMemo(
    () => ({
      token: session?.accessToken,
      user: session?.user,
      restaurant: session?.restaurant,
      login,
      logout,
      request,
    }),
    [session, login, logout, request],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}