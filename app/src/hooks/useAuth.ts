import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { fetchUserProfile, checkSessionValidity } from '../lib/auth';
import { useAuthStore } from '../stores/authStore';

// Session validity check interval (5 minutes)
const SESSION_CHECK_INTERVAL = 5 * 60 * 1000;

/**
 * Read the full Supabase session object from localStorage.
 * The Supabase JS client stores it under `sb-{projectRef}-auth-token`.
 * This avoids calling supabase.auth.getSession() which can hang.
 */
function getSessionFromStorage() {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL as string;
    const projectRef = new URL(url).hostname.split('.')[0];
    const storageKey = `sb-${projectRef}-auth-token`;
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Hook that initialises and manages authentication state.
 * Call this ONCE in the root App component — never in child components.
 */
export function useAuth() {
  const store = useAuthStore();
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const initialise = async () => {
      store.setLoading(true);
      try {
        // Read auth session directly from localStorage (instant, never hangs).
        // supabase.auth.getSession() can hang indefinitely during token refresh.
        const session = getSessionFromStorage();
        if (session?.user) {
          store.setAuthUser(session.user);
          const { data: profile } = await fetchUserProfile(session.user.id);
          if (profile) {
            store.setProfile(profile);
          }
          // Note: we don't recreate an app session on page reload —
          // the user must re-authenticate if the session expired
        }
      } catch (error) {
        console.error('Auth initialisation error:', error);
      } finally {
        store.setLoading(false);
        store.setInitialised(true);
      }
    };

    initialise();

    // Listen for Supabase auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Skip processing when admin is creating a new user
        // (signUp + setSession fire rapid auth events that would
        //  blow out the admin's profile)
        if (useAuthStore.getState().suppressAuthEvents) {
          return;
        }

        if (event === 'SIGNED_IN' && session?.user) {
          store.setAuthUser(session.user);
          const { data: profile } = await fetchUserProfile(session.user.id);
          if (profile) {
            store.setProfile(profile);
          }
        } else if (event === 'SIGNED_OUT') {
          stopSessionChecks();
          store.reset();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
      stopSessionChecks();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start periodic session validity checks
  const startSessionChecks = (sessionId: string) => {
    stopSessionChecks();
    checkIntervalRef.current = setInterval(async () => {
      const isValid = await checkSessionValidity(sessionId);
      if (!isValid) {
        store.setSessionExpired(true);
        stopSessionChecks();
      }
    }, SESSION_CHECK_INTERVAL);
  };

  const stopSessionChecks = () => {
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
  };

  return { startSessionChecks };
}
