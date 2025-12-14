/**
 * Zustand store for authentication state management.
 * Supports both Supabase auth and legacy cookie-based auth.
 */

import { create } from "zustand";
import { supabase, isSupabaseConfigured, getAccessToken } from "@/lib/supabase";
import { auth as authApi } from "@/lib/api";
import type { User, Session, AuthError } from "@supabase/supabase-js";

interface AuthState {
  /** Supabase user object (null if using legacy auth or not authenticated) */
  user: User | null;

  /** Supabase session (null if using legacy auth or not authenticated) */
  session: Session | null;

  /** Legacy user ID (for cookie-based auth) */
  legacyUserId: string | null;

  /** User role (from backend) */
  role: string;

  /** Whether auth is loading */
  loading: boolean;

  /** Whether initial auth check is complete */
  initialized: boolean;

  /** Last auth error */
  error: string | null;

  /** Initialize auth state (call on app mount) */
  initialize: () => Promise<void>;

  /** Sign in with email and password */
  signInWithEmail: (email: string, password: string) => Promise<{ error: AuthError | null }>;

  /** Sign up with email and password */
  signUpWithEmail: (email: string, password: string) => Promise<{ error: AuthError | null }>;

  /** Sign in with Google OAuth */
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;

  /** Sign in with legacy user ID (cookie-based) */
  signInLegacy: (userId: string) => Promise<void>;

  /** Sign out */
  signOut: () => Promise<void>;

  /** Check if user is authenticated */
  isAuthenticated: () => boolean;

  /** Get current user ID (works for both auth methods) */
  getUserId: () => string | null;

  /** Get access token for API calls */
  getToken: () => Promise<string | null>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  legacyUserId: null,
  role: "user",
  loading: true,
  initialized: false,
  error: null,

  initialize: async () => {
    set({ loading: true, error: null });

    try {
      if (isSupabaseConfigured() && supabase) {
        // Set up auth state change listener
        supabase.auth.onAuthStateChange(async (event, session) => {
          set({
            session,
            user: session?.user ?? null,
            loading: false,
          });

          // Sync with backend when user signs in
          if (session?.user) {
            try {
              const response = await authApi.me();
              set({ role: response.role || "user" });
            } catch {
              // Backend might not be ready yet
            }
          }
        });

        // Get initial session with timeout to prevent hanging
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) => {
          setTimeout(() => resolve({ data: { session: null } }), 5000);
        });
        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);

        set({
          session,
          user: session?.user ?? null,
        });

        // Get role from backend
        if (session?.user) {
          try {
            const response = await authApi.me();
            set({ role: response.role || "user" });
          } catch {
            // Backend might not be ready
          }
        }
      } else {
        // Legacy auth - check cookie via backend
        try {
          const response = await authApi.me();
          if (response.authenticated && response.user_id) {
            set({
              legacyUserId: response.user_id,
              role: response.role || "user",
            });
          }
        } catch {
          // Not authenticated
        }
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Auth initialization failed" });
    } finally {
      set({ loading: false, initialized: true });
    }
  },

  signInWithEmail: async (email, password) => {
    if (!supabase) {
      return { error: { message: "Supabase not configured" } as AuthError };
    }

    set({ loading: true, error: null });
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      set({ error: error.message, loading: false });
    } else {
      set({ loading: false });
    }

    return { error };
  },

  signUpWithEmail: async (email, password) => {
    if (!supabase) {
      return { error: { message: "Supabase not configured" } as AuthError };
    }

    set({ loading: true, error: null });
    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      set({ error: error.message, loading: false });
    } else {
      set({ loading: false });
    }

    return { error };
  },

  signInWithGoogle: async () => {
    if (!supabase) {
      return { error: { message: "Supabase not configured" } as AuthError };
    }

    set({ loading: true, error: null });
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      set({ error: error.message, loading: false });
    }

    return { error };
  },

  signInLegacy: async (userId) => {
    set({ loading: true, error: null });

    try {
      await authApi.login(userId);
      const response = await authApi.me();
      set({
        legacyUserId: userId,
        role: response.role || "user",
        loading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Login failed",
        loading: false,
      });
    }
  },

  signOut: async () => {
    set({ loading: true, error: null });

    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
      await authApi.logout();
      set({
        user: null,
        session: null,
        legacyUserId: null,
        role: "user",
        loading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Logout failed",
        loading: false,
      });
    }
  },

  isAuthenticated: () => {
    const state = get();
    return !!(state.user || state.legacyUserId);
  },

  getUserId: () => {
    const state = get();
    return state.user?.id || state.legacyUserId;
  },

  getToken: async () => {
    return getAccessToken();
  },
}));
