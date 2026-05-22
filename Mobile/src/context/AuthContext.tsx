// ─── Context global de autenticación ──────────────────────────────────────────
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';

interface AuthUser {
  email: string;
  role: 'Admin' | 'User';
  token: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Rehidratar sesión desde AsyncStorage al abrir la app
    AsyncStorage.multiGet(['simon_token', 'simon_email', 'simon_role']).then(pairs => {
      const map = Object.fromEntries(pairs.map(([k, v]) => [k, v]));
      if (map.simon_token && map.simon_email && map.simon_role) {
        setUser({
          token: map.simon_token!,
          email: map.simon_email!,
          role: map.simon_role as 'Admin' | 'User',
        });
      }
    }).finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error('Credenciales inválidas');
    const data = await res.json();
    const authUser: AuthUser = {
      token: data.token,
      email: data.email ?? email,
      role: (data.role ?? 'User') as 'Admin' | 'User',
    };
    await AsyncStorage.multiSet([
      ['simon_token', authUser.token],
      ['simon_email', authUser.email],
      ['simon_role', authUser.role],
    ]);
    setUser(authUser);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['simon_token', 'simon_email', 'simon_role']);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
