import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from './api';
import { storageDel, storageGet, storageSet } from './storage';

export type Role = 'SUPER_ADMIN' | 'OWNER' | 'GYM_ADMIN' | 'MEMBER' | 'SHOP_OWNER' | 'SHOP_STAFF';

export type User = {
  id: number;
  email: string;
  name: string;
  role: Role;
  status: 'ACTIVE' | 'INACTIVE';
  gymId: number | null;
  shopId: number | null;
  phone?: string | null;
  emailVerified: boolean;
  needsOnboarding: boolean;
};

type AuthValue = {
  token: string | null;
  user: User | null;
  ready: boolean;
  setSession: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
};

const Auth = createContext<AuthValue | null>(null);
const TOKEN_KEY = 'accessToken';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await storageGet(TOKEN_KEY);
      if (saved) {
        try {
          const me = await api<User>('/auth/me', { token: saved });
          setToken(saved);
          setUser(me);
        } catch {
          await storageDel(TOKEN_KEY);
        }
      }
      setReady(true);
    })();
  }, []);

  const setSession = useCallback(async (nextToken: string, nextUser: User) => {
    await storageSet(TOKEN_KEY, nextToken);
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const logout = useCallback(async () => {
    await storageDel(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ token, user, ready, setSession, logout }),
    [token, user, ready, setSession, logout],
  );

  return <Auth.Provider value={value}>{children}</Auth.Provider>;
}

export function useAuth() {
  const ctx = useContext(Auth);
  if (!ctx) {
    throw new Error('useAuth outside provider');
  }
  return ctx;
}
