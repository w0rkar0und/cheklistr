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

/**
 * Read the current access token directly from localStorage.
 * This bypasses supabase.auth.getSession() which can hang during token refresh.
 * The Supabase JS client stores the session under `sb-{projectRef}-auth-token`.
 */
export function getAccessTokenFromStorage(): string | null {
  try {
    // Extract project ref from the URL (subdomain)
    const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
    const storageKey = `sb-${projectRef}-auth-token`;
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const session = JSON.parse(raw);
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}
