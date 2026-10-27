import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';
import { authenticateUser, getAllUsers, updateUserHeartbeat } from '../utils/userService';
import { logActivity } from '../utils/activityService';

const AuthContext = createContext(null);

const AUTH_SESSION_KEY = 'mm_auth_session';

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Restore session from localStorage or Supabase on launch
  useEffect(() => {
    const initializeAuth = async () => {
      // 1. Check local session storage first for fast response
      const savedSession = localStorage.getItem(AUTH_SESSION_KEY);
      if (savedSession) {
        try {
          const parsedUser = JSON.parse(savedSession);
          if (parsedUser && parsedUser.name) {
            if (parsedUser.name === 'Administrator') {
              parsedUser.name = 'Admin';
              localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(parsedUser));
            }
            setUser(parsedUser);
            setIsAuthenticated(true);
            updateUserHeartbeat(parsedUser.id);
            setLoading(false);
            return;
          }
        } catch {}
      }

      // 2. Check Supabase auth session if available
      if (supabase) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const role = session.user.user_metadata?.role || (session.user.email?.includes('admin') ? 'Admin' : 'Staff');
            const authUser = {
              id: session.user.id,
              name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
              username: session.user.email?.split('@')[0] || 'user',
              email: session.user.email,
              role: role
            };
            setUser(authUser);
            setIsAuthenticated(true);
            updateUserHeartbeat(authUser.id);
            localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(authUser));
            setLoading(false);
            return;
          }
        } catch (err) {
          console.warn("Supabase session fetch error:", err);
        }
      }

      // 3. No active session found - require user to log in
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
    };

    initializeAuth();
  }, []);

  // Maintain active heartbeat every 60s
  useEffect(() => {
    if (user?.id) {
      updateUserHeartbeat(user.id);
      const timer = setInterval(() => {
        updateUserHeartbeat(user.id);
      }, 60000);
      return () => clearInterval(timer);
    }
  }, [user?.id]);

  const login = async (identifier, password) => {
    // 1. Check credentials against user database
    const authResult = await authenticateUser(identifier, password);
    if (authResult.success) {
      const activeUser = authResult.user;
      setUser(activeUser);
      setIsAuthenticated(true);
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(activeUser));
      return true;
    }

    // 2. Fallback attempt with Supabase native Auth if available
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email: identifier, password });
        if (!error && data?.user) {
          const role = data.user.email?.includes('admin') ? 'Admin' : 'Staff';
          const authUser = {
            id: data.user.id,
            name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User',
            username: data.user.email?.split('@')[0] || 'user',
            email: data.user.email,
            role: role
          };
          setUser(authUser);
          setIsAuthenticated(true);
          localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(authUser));
          return true;
        }
      } catch (err) {
        console.warn("Supabase native login failed:", err);
      }
    }

    return false;
  };

  const logout = async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {}
    }

    localStorage.removeItem(AUTH_SESSION_KEY);
    setUser(null);
    setIsAuthenticated(false);
  };

  const isAdmin = user?.role === 'Admin';

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: 'white' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Monsoon Meridian</div>
          <div style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Initializing workstation credentials...</div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
