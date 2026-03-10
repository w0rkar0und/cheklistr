import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { fetchUserProfile, fetchOrganisation, checkSessionValidity } from '../lib/auth';
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
 * Load user profile and organisation context into the store.
 * Reused by both initial load and auth state change handler.
 */
async function loadProfileAndOrg(userId: string) {
  const store = useAuthStore.getState();
  const { data: profile } = await fetchUserProfile(userId);
  if (profile) {
    store.setProfile(profile);
    // Load organisation context
    const { data: org } = await fetchOrganisation(profile.org_id);
    if (org) {
      store.setOrganisation(org);
    }
  }
}

/**
 * Hook that initialises and manages authentication state.
 * Call this ONCE in the root App component — never in child components.
 *
 * IMPORTANT: We avoid supabase.auth.getSession() entirely because it
 * hangs indefinitely during token refresh on the Supabase JS client.
 * Instead we read the session from localStorage directly.
 *
 * We also defer the onAuthStateChange subscription so it doesn't
 * block initialisation (it internally calls getSession() too).
 */
export function useAuth() {
  const store = useAuthStore();
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);

  useEffect(() => {
    const initialise = async () => {
      store.setLoading(true);
      try {
        // Read auth session directly from localStorage (instant, never hangs).
        const session = getSessionFromStorage();
        if (session?.user) {
          store.setAuthUser(session.user);
          await loadProfileAndOrg(session.user.id);
        }
      } catch (error) {
        console.error('Auth initialisation error:', error);
      } finally {
        store.setLoading(false);
        store.setInitialised(true);
      }

      // Defer the auth state change listener so it doesn't block init.
      // onAuthStateChange internally calls getSession() which can hang,
      // but by this point the UI is already rendered and interactive.
      // We wrap it in setTimeout to yield to the event loop first.
      setTimeout(() => {
        try {
          const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
              const state = useAuthStore.getState();

              // Skip events when suppressed (during admin user creation)
              if (state.suppressAuthEvents) {
                console.log('[AUTH] Event suppressed:', event);
                return;
              }

              // NEVER set isLoading back to true from the listener.
              // The initial load is the only time isLoading should be true.
              // This prevents race conditions from leaving the UI stuck.

              if (event === 'SIGNED_IN' && session?.user) {
                store.setAuthUser(session.user);
                await loadProfileAndOrg(session.user.id);
              } else if (event === 'SIGNED_OUT') {
                stopSessionChecks();
                store.reset();
              } else if (event === 'TOKEN_REFRESHED' && session?.user) {
                // Token refresh — update auth user but don't touch loading
                store.setAuthUser(session.user);
              }
            }
          );
          subscriptionRef.current = subscription;
        } catch (err) {
          console.error('Failed to subscribe to auth state changes:', err);
        }
      }, 0);
    };

    initialise();

    return () => {
      subscriptionRef.current?.unsubscribe();
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
