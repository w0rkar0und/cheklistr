import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY, getAccessTokenFromStorage } from './supabase';
import type { User, Session as AppSession } from '../types/database';
import { isNativePlatform } from './capacitorPlatform';
import { saveAuthTokens, getAuthTokens, clearAuthTokens } from './secureStorage';

// ============================================================
// Auth Service — stateless functions for authentication
//
// IMPORTANT: All PostgREST calls use raw fetch() with explicit auth
// tokens rather than supabase.from() because the Supabase JS client
// can hang in Capacitor WebView when its internal session is stale.
// The supabase.auth.* methods are still used since they're explicit
// auth API calls that don't depend on the internal session state.
// ============================================================

/** Synthetic email domain used for Supabase Auth internals. */
const SYNTHETIC_DOMAIN = 'cheklistr.app';

/**
 * Convert a User ID (e.g. "X123456") to a synthetic email
 * for Supabase Auth, which requires an email address.
 * The user never sees this — they only interact via User ID.
 */
export function toSyntheticEmail(loginId: string): string {
  return `${loginId.toLowerCase().trim()}@${SYNTHETIC_DOMAIN}`;
}

/**
 * Sign in with User ID + password via Supabase Auth.
 * Converts the User ID to a synthetic email internally.
 */
export async function signIn(loginId: string, password: string) {
  const email = toSyntheticEmail(loginId);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  // On native: persist tokens to secure storage for biometric unlock
  if (!error && data.session && isNativePlatform()) {
    await saveAuthTokens(data.session.access_token, data.session.refresh_token);
  }

  return { data, error };
}

/**
 * Sign out of Supabase Auth and terminate the app session.
 */
export async function signOut(appSessionId?: string) {
  // Terminate the app session in the database (raw fetch)
  if (appSessionId) {
    try {
      const accessToken = getAccessTokenFromStorage();
      if (accessToken) {
        await fetch(
          `${SUPABASE_URL}/rest/v1/sessions?id=eq.${encodeURIComponent(appSessionId)}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify({
              terminated_at: new Date().toISOString(),
              termination_reason: 'logout',
            }),
          },
        );
      }
    } catch (err) {
      console.error('Failed to terminate app session:', err);
    }
  }

  // Clear secure storage tokens on native
  if (isNativePlatform()) {
    await clearAuthTokens();
  }

  const { error } = await supabase.auth.signOut();
  return { error };
}

/**
 * Attempt to restore a Supabase session from securely stored tokens.
 * Used after biometric unlock on native to resume without credentials.
 */
export async function restoreSessionFromTokens(): Promise<{
  success: boolean;
  userId?: string;
}> {
  const { accessToken, refreshToken } = await getAuthTokens();

  if (!refreshToken) {
    return { success: false };
  }

  // Use the refresh token to get a new session
  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken ?? '',
    refresh_token: refreshToken,
  });

  if (error || !data.session) {
    // Token expired or invalid — clear stored tokens
    await clearAuthTokens();
    return { success: false };
  }

  // Update stored tokens with the refreshed ones
  await saveAuthTokens(data.session.access_token, data.session.refresh_token);

  return { success: true, userId: data.session.user.id };
}

/**
 * Fetch the user profile from the public.users table.
 * Uses raw PostgREST fetch to avoid Capacitor WebView session hangs.
 */
export async function fetchUserProfile(userId: string): Promise<{ data: User | null; error: unknown }> {
  try {
    const accessToken = getAccessTokenFromStorage();
    if (!accessToken) {
      return { data: null, error: 'Not authenticated' };
    }

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(userId)}&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.pgrst.object+json',
        },
      },
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error('Error fetching user profile:', res.status, errText);
      return { data: null, error: `Failed to fetch profile (${res.status})` };
    }

    const data = await res.json();
    return { data: data as User, error: null };
  } catch (err) {
    console.error('Error fetching user profile:', err);
    return { data: null, error: err };
  }
}

/**
 * Create an app-level session in the sessions table.
 * The DB trigger `terminate_existing_sessions` will automatically
 * terminate any previous active sessions for this user.
 * Uses raw PostgREST fetch to avoid Capacitor WebView session hangs.
 */
export async function createAppSession(userId: string): Promise<{ data: AppSession | null; error: unknown }> {
  try {
    const accessToken = getAccessTokenFromStorage();
    if (!accessToken) {
      return { data: null, error: 'Not authenticated' };
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours

    // Collect basic device info (non-fingerprinting)
    const deviceInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      timestamp: now.toISOString(),
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/sessions`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        'Accept': 'application/vnd.pgrst.object+json',
      },
      body: JSON.stringify({
        user_id: userId,
        expires_at: expiresAt.toISOString(),
        device_info: deviceInfo,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Error creating app session:', res.status, errText);
      return { data: null, error: `Session creation failed (${res.status})` };
    }

    const data = await res.json();
    return { data: data as AppSession, error: null };
  } catch (err) {
    console.error('Error creating app session:', err);
    return { data: null, error: err };
  }
}

/**
 * Check if the current app session is still valid (not expired, not terminated).
 * Uses raw PostgREST fetch to avoid Capacitor WebView session hangs.
 */
export async function checkSessionValidity(sessionId: string): Promise<boolean> {
  try {
    const accessToken = getAccessTokenFromStorage();
    if (!accessToken) return false;

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/sessions?id=eq.${encodeURIComponent(sessionId)}&select=expires_at,terminated_at&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.pgrst.object+json',
        },
      },
    );

    if (!res.ok) return false;

    const data = await res.json();
    if (!data || data.terminated_at) return false;

    const expiresAt = new Date(data.expires_at);
    return expiresAt > new Date();
  } catch {
    return false;
  }
}

/**
 * Extend the current app session by another 2 hours.
 * Called after successful re-authentication.
 * Uses raw PostgREST fetch to avoid Capacitor WebView session hangs.
 */
export async function extendSession(sessionId: string): Promise<boolean> {
  try {
    const accessToken = getAccessTokenFromStorage();
    if (!accessToken) return false;

    const newExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000);

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/sessions?id=eq.${encodeURIComponent(sessionId)}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ expires_at: newExpiry.toISOString() }),
      },
    );

    return res.ok;
  } catch {
    return false;
  }
}
