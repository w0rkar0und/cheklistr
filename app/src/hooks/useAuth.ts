import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { fetchUserProfile, checkSessionValidity } from '../lib/auth';
import { useAuthStore } from '../stores/authStore';

// Session validity check interval (5 minutes)
const SESSION_CHECK_INTERVAL = 5 * 60 * 1000;

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
        const { data: { session } } = await supabase.auth.getSession();
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
