import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { authService, AUTH_TOKEN_KEY, REFRESH_TOKEN_KEY, getStoredAccessToken } from '../services/api';
import type { LoginCredentials, User, Role } from '../types/Device';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  hasPermission: (permission: string) => boolean;
  isAdmin: () => boolean;
  isManager: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const createLocalFallbackUser = (): User => ({
  id: '1',
  username: 'admin',
  email: 'admin@localhost',
  first_name: 'Admin',
  last_name: 'User',
  role_id: 'admin-role',
  role: 'admin',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const userRef = useRef<User | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      const token = getStoredAccessToken();
      if (token) {
        try {
          const profile = await authService.getProfile();
          if (isMounted) {
            setUser(profile);
          }
        } catch (error) {
          if (token.startsWith('local-token-') && isMounted) {
            setUser(createLocalFallbackUser());
          } else if (isMounted) {
            setUser(null);
          }
        }
      }

      if (isMounted) {
        setLoading(false);
      }
    };

    initAuth();

    const tokenCheckInterval = setInterval(() => {
      const currentToken = getStoredAccessToken();
      if (!currentToken && userRef.current) {
        setUser(null);
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(tokenCheckInterval);
    };
  }, []);

  const login = async (credentials: LoginCredentials) => {
    try {
      setLoading(true);
      const response = await authService.login(credentials);
      setUser(response.user);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
    } finally {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      setUser(null);
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!user?.role) {
      return false;
    }

    if (typeof user.role === 'string') {
      return user.role === 'admin' || user.role === 'manager';
    }

    return Boolean((user.role as Role).permissions?.some((p) => p.name === permission));
  };

  const isAdmin = (): boolean => {
    if (!user) {
      return false;
    }

    if (typeof user.role === 'string') {
      return user.role === 'admin';
    }

    return (user.role as Role)?.name === 'admin';
  };

  const isManager = (): boolean => {
    if (!user) {
      return false;
    }

    if (typeof user.role === 'string') {
      return user.role === 'manager' || user.role === 'admin';
    }

    return (user.role as Role)?.name === 'manager' || isAdmin();
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: Boolean(user),
    login,
    logout,
    loading,
    hasPermission,
    isAdmin,
    isManager,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

