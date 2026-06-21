'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  loginWithGoogle: () => Promise<void>;
  loginWithFacebook: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          // Validate token and get user data
          // This would be an API call in production
          const userData = localStorage.getItem('user_data');
          if (userData) {
            setUser(JSON.parse(userData));
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    // This would be an API call in production
    // Simulating login
    const mockUser: User = {
      id: '1',
      email,
      name: email.split('@')[0],
      avatar: 'https://i.pravatar.cc/150',
      role: 'user',
      isVerified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    localStorage.setItem('auth_token', 'mock_token');
    localStorage.setItem('user_data', JSON.stringify(mockUser));
    setUser(mockUser);
  };

  const register = async (name: string, email: string, password: string) => {
    // This would be an API call in production
    const mockUser: User = {
      id: '1',
      email,
      name,
      avatar: 'https://i.pravatar.cc/150',
      role: 'user',
      isVerified: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    localStorage.setItem('auth_token', 'mock_token');
    localStorage.setItem('user_data', JSON.stringify(mockUser));
    setUser(mockUser);
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    setUser(null);
  };

  const loginWithGoogle = async () => {
    // This would integrate with Google OAuth
    console.log('Google login');
  };

  const loginWithFacebook = async () => {
    // This would integrate with Facebook OAuth
    console.log('Facebook login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        logout,
        loginWithGoogle,
        loginWithFacebook
      }}
    >
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
