import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { safeGetItem, safeSetItem, safeRemoveItem, safeGetJSON, safeSetJSON, clearAllStorage } from '../lib/storage';
import { StorageKeys } from '../lib/constants';
import { api } from '../lib/api';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  register: (email: string, password: string, username: string, name: string) => Promise<{ success: boolean; error?: string }>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from storage on mount
  useEffect(() => {
    async function loadUser() {
      try {
        const token = await safeGetItem(StorageKeys.AUTH_TOKEN);
        if (token) {
          // Try to get current user from API
          try {
            const { user: fetchedUser } = await api.getCurrentUser();
            setUser(fetchedUser);
            await safeSetJSON(StorageKeys.USER_DATA, fetchedUser);
          } catch {
            // Token might be expired, try cached data
            const cachedUser = await safeGetJSON<User | null>(StorageKeys.USER_DATA, null);
            if (cachedUser) {
              setUser(cachedUser);
            } else {
              // Clear invalid token
              await safeRemoveItem(StorageKeys.AUTH_TOKEN);
            }
          }
        }
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();
  }, []);

  const register = useCallback(async (
    email: string,
    password: string,
    username: string,
    name: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      const { user: newUser, token } = await api.register({ email, password, username, name });

      await safeSetItem(StorageKeys.AUTH_TOKEN, token);
      await safeSetJSON(StorageKeys.USER_DATA, newUser);

      setUser(newUser);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      const { user: loggedInUser, token } = await api.login({ email, password });

      await safeSetItem(StorageKeys.AUTH_TOKEN, token);
      await safeSetJSON(StorageKeys.USER_DATA, loggedInUser);

      setUser(loggedInUser);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    await clearAllStorage();
  }, []);

  const refreshUser = useCallback(async () => {
    if (!user) return;

    try {
      const { user: fetchedUser } = await api.getCurrentUser();
      setUser(fetchedUser);
      await safeSetJSON(StorageKeys.USER_DATA, fetchedUser);
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  }, [user]);

  const updateUser = useCallback((data: Partial<User>) => {
    if (!user) return;
    const updatedUser = { ...user, ...data };
    setUser(updatedUser);
    safeSetJSON(StorageKeys.USER_DATA, updatedUser);
  }, [user]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    register,
    login,
    logout,
    refreshUser,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
