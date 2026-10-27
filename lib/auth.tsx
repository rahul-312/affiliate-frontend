'use client';

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { apiRequest, setAuthToken, setUnauthorizedHandler } from './api';
import type { StaffRole, User } from './types';

const STORAGE_KEY = 'affiliate-hub.session';
const STAFF_ROLES: readonly StaffRole[] = ['ops', 'finance'];

interface Session {
  token: string;
  user: User;
}

/** Reads the JWT expiry without trusting anything else in it; the API remains the authority. */
function isExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

function readStoredSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    if (!session.token || isExpired(session.token)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function persistSession(session: Session | null) {
  try {
    if (session) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode); the in-memory session still works.
  }
}

/**
 * The session lives outside React as a tiny external store, read through
 * useSyncExternalStore. `undefined` means "not loaded yet" (always the case
 * on the server), `null` means signed out.
 */
const sessionStore = (() => {
  let current: Session | null | undefined;
  const listeners = new Set<() => void>();

  const set = (next: Session | null) => {
    current = next;
    persistSession(next);
    setAuthToken(next?.token ?? null);
    listeners.forEach((listener) => listener());
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot(): Session | null {
      if (current === undefined) {
        current = readStoredSession();
        setAuthToken(current?.token ?? null);
        setUnauthorizedHandler(() => set(null));
      }
      return current;
    },
    getServerSnapshot: (): undefined => undefined,
    set,
  };
})();

interface AuthContextValue {
  user: User | null;
  role: StaffRole | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot, sessionStore.getServerSnapshot);

  const signOut = useCallback(() => sessionStore.set(null), []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await apiRequest<Session>('/auth/login', { method: 'POST', body: { email, password } });
    if (!STAFF_ROLES.includes(result.user.role as StaffRole)) {
      throw new Error('This dashboard is for the ops and finance teams. Affiliates should use the mobile app.');
    }
    sessionStore.set(result);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      role: (session?.user.role as StaffRole | undefined) ?? null,
      ready: session !== undefined,
      signIn,
      signOut,
    }),
    [session, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
