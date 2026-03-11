import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Export raw config for direct PostgREST calls that bypass the JS client
export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseAnonKey;

/** Storage key for the Supabase auth session in localStorage. */
const PROJECT_REF = new URL(supabaseUrl).hostname.split('.')[0];
const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;

/**
 * Read the current access token directly from localStorage (synchronous).
 * This bypasses supabase.auth.getSession() which can hang during token refresh.
 */
export function getAccessTokenFromStorage(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Get a fresh access token, refreshing if expired or expiring within 60s.
 * Use this for non-critical API calls (VRM lookup, etc.) where a short
 * async wait is acceptable. Falls back to the stored token if refresh fails.
 */
export async function getFreshAccessToken(): Promise<string | null> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    const accessToken = session?.access_token ?? null;
    if (!accessToken) return null;

    // If token is still valid for >60s, use it as-is
    const expiresAt = session?.expires_at;
    if (expiresAt && expiresAt - Math.floor(Date.now() / 1000) > 60) {
      return accessToken;
    }

    // Token is expired or expiring soon — try to refresh
    console.log('[AUTH] Token expiring, attempting refresh…');
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data?.session?.access_token) {
      console.log('[AUTH] Token refreshed successfully');
      return data.session.access_token;
    }

    // Refresh failed — return the stale token as fallback
    console.warn('[AUTH] Token refresh failed, using stored token');
    return accessToken;
  } catch {
    return null;
  }
}
