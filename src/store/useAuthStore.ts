import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  provider: 'google' | 'email';
}

export interface RegisteredAccount {
  id: string;
  name: string;
  email: string;
  password?: string;
  avatarUrl?: string;
  provider: 'google' | 'email';
  createdAt: string;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accounts: RegisteredAccount[];
  
  initializeAuth: () => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signInWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUpWithGoogle: (name: string, email: string) => Promise<{ success: boolean; error?: string }>;
  signInWithGoogle: (email?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

function hashPassword(pass: string): string {
  let hash = 0x811c9dc5;
  const salt = 'worklane_auth_salt_v2';
  const str = salt + pass;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      accounts: [],

      initializeAuth: async () => {
        if (!isSupabaseConfigured()) return;
        
        try {
          const parseUser = (u: any): AuthUser => ({
            id: u.id,
            name: u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0] || 'User',
            email: u.email || '',
            avatarUrl: u.user_metadata?.avatar_url || u.user_metadata?.picture,
            provider: (u.app_metadata?.provider as any) || (u.user_metadata?.provider as any) || 'email',
          });

          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            set({ user: parseUser(session.user), isAuthenticated: true });
          }

          supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
              set({ user: parseUser(session.user), isAuthenticated: true });
            } else if (!session && isSupabaseConfigured()) {
              set({ user: null, isAuthenticated: false });
            }
          });
        } catch (err) {
          console.warn('[Supabase Auth] Init error:', err);
        }
      },

      signUpWithEmail: async (name, email, password) => {
        const cleanEmail = email.trim().toLowerCase();

        if (isSupabaseConfigured()) {
          try {
            const { data, error } = await supabase.auth.signUp({
              email: cleanEmail,
              password,
              options: {
                data: {
                  name: name.trim() || cleanEmail.split('@')[0],
                },
              },
            });
            if (error) return { success: false, error: error.message };
            
            if (data.session?.user) {
              const u = data.session.user;
              const authUser: AuthUser = {
                id: u.id,
                name: u.user_metadata?.name || name.trim() || cleanEmail.split('@')[0],
                email: cleanEmail,
                avatarUrl: u.user_metadata?.avatar_url,
                provider: 'email',
              };
              set({ user: authUser, isAuthenticated: true });
            }
            return { success: true };
          } catch (err: any) {
            return { success: false, error: err.message || 'Sign up failed' };
          }
        }

        // Local Fallback mode
        const { accounts } = get();
        const existing = accounts.find(a => a.email.toLowerCase() === cleanEmail);
        if (existing) {
          return { success: false, error: 'Email is already registered! Please sign in.' };
        }

        const newAccount: RegisteredAccount = {
          id: `usr_${Date.now()}`,
          name: name.trim() || cleanEmail.split('@')[0],
          email: cleanEmail,
          password: hashPassword(password),
          provider: 'email',
          createdAt: new Date().toISOString(),
        };

        set({ accounts: [...accounts, newAccount] });
        return { success: true };
      },

      signInWithEmail: async (email, password) => {
        const cleanEmail = email.trim().toLowerCase();

        if (isSupabaseConfigured()) {
          try {
            const { data, error } = await supabase.auth.signInWithPassword({
              email: cleanEmail,
              password,
            });
            if (error) return { success: false, error: error.message };

            if (data.user) {
              const u = data.user;
              const authUser: AuthUser = {
                id: u.id,
                name: u.user_metadata?.name || cleanEmail.split('@')[0],
                email: cleanEmail,
                avatarUrl: u.user_metadata?.avatar_url,
                provider: 'email',
              };
              set({ user: authUser, isAuthenticated: true });
              return { success: true };
            }
          } catch (err: any) {
            return { success: false, error: err.message || 'Sign in failed' };
          }
        }

        // Local Fallback mode
        const { accounts } = get();
        const account = accounts.find(a => a.email.toLowerCase() === cleanEmail);
        if (!account) {
          return { success: false, error: 'Account not found! Please sign up first.' };
        }

        const hashedPassword = hashPassword(password);
        if (account.password && account.password !== hashedPassword && account.password !== password) {
          return { success: false, error: 'Incorrect password! Please try again.' };
        }

        const authUser: AuthUser = {
          id: account.id,
          name: account.name,
          email: account.email,
          avatarUrl: account.avatarUrl,
          provider: account.provider,
        };

        set({ user: authUser, isAuthenticated: true });
        return { success: true };
      },

      signUpWithGoogle: async (name, email) => {
        const cleanEmail = email.trim().toLowerCase();

        if (isSupabaseConfigured()) {
          return get().signInWithGoogle();
        }

        // Local Fallback mode
        const { accounts } = get();
        const existing = accounts.find(a => a.email.toLowerCase() === cleanEmail);
        if (existing) {
          return { success: false, error: 'This Google account is already registered! Please sign in.' };
        }

        const newAccount: RegisteredAccount = {
          id: `goog_${Date.now()}`,
          name: name.trim() || cleanEmail.split('@')[0],
          email: cleanEmail,
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
          provider: 'google',
          createdAt: new Date().toISOString(),
        };

        set({ accounts: [...accounts, newAccount] });
        return { success: true };
      },

      signInWithGoogle: async (email?: string) => {
        if (isSupabaseConfigured()) {
          try {
            const { error } = await supabase.auth.signInWithOAuth({
              provider: 'google',
              options: {
                redirectTo: window.location.origin,
              },
            });
            if (error) return { success: false, error: error.message };
            return { success: true };
          } catch (err: any) {
            return { success: false, error: err.message || 'Google OAuth failed' };
          }
        }

        // Local Fallback mode
        const cleanEmail = (email || '').trim().toLowerCase();
        if (!cleanEmail) {
          return { success: false, error: 'Email is required' };
        }
        const { accounts } = get();
        let account = accounts.find(a => a.email.toLowerCase() === cleanEmail);
        if (!account) {
          account = {
            id: `goog_${Date.now()}`,
            name: cleanEmail.split('@')[0],
            email: cleanEmail,
            provider: 'google',
            createdAt: new Date().toISOString(),
          };
          set({ accounts: [...accounts, account] });
        }

        const authUser: AuthUser = {
          id: account.id,
          name: account.name,
          email: account.email,
          avatarUrl: account.avatarUrl,
          provider: 'google',
        };

        set({ user: authUser, isAuthenticated: true });
        return { success: true };
      },

      logout: async () => {
        if (isSupabaseConfigured()) {
          try {
            await supabase.auth.signOut();
          } catch (e) {
            console.warn('[Supabase Auth] SignOut error:', e);
          }
        }
        set({ user: null, isAuthenticated: false });
      },
    }),
    { name: 'worklane_auth_store_v4' }
  )
);
