import { create } from 'zustand';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { User, Session, Organisation } from '../types/database';

interface AuthState {
  // Supabase auth user
  authUser: SupabaseUser | null;
  // Application user profile
  profile: User | null;
  // Current organisation context
  organisation: Organisation | null;
  // Current app session (2-hour expiry)
  appSession: Session | null;
  // Whether the app session has expired (triggers re-auth overlay)
  isSessionExpired: boolean;
  // Loading state
  isLoading: boolean;
  // Whether initial auth check has completed
  isInitialised: boolean;
  // When true, the auth state change listener should ignore events
  // (set during admin user creation to prevent session interference)
  suppressAuthEvents: boolean;

  // Actions
  setAuthUser: (user: SupabaseUser | null) => void;
  setProfile: (profile: User | null) => void;
  setOrganisation: (organisation: Organisation | null) => void;
  setAppSession: (session: Session | null) => void;
  setSessionExpired: (expired: boolean) => void;
  setLoading: (loading: boolean) => void;
  setInitialised: (initialised: boolean) => void;
  setSuppressAuthEvents: (suppress: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  authUser: null,
  profile: null,
  organisation: null,
  appSession: null,
  isSessionExpired: false,
  isLoading: true,
  isInitialised: false,
  suppressAuthEvents: false,

  setAuthUser: (authUser) => set({ authUser }),
  setProfile: (profile) => set({ profile }),
  setOrganisation: (organisation) => set({ organisation }),
  setAppSession: (appSession) => set({ appSession }),
  setSessionExpired: (isSessionExpired) => set({ isSessionExpired }),
  setLoading: (isLoading) => set({ isLoading }),
  setInitialised: (isInitialised) => set({ isInitialised }),
  setSuppressAuthEvents: (suppressAuthEvents) => set({ suppressAuthEvents }),
  reset: () => set({
    authUser: null,
    profile: null,
    organisation: null,
    appSession: null,
    isSessionExpired: false,
    isLoading: false,
    suppressAuthEvents: false,
  }),
}));
