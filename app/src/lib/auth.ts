import { supabase } from './supabase';
import type { User, Session as AppSession } from '../types/database';

// ============================================================
// Auth Service — stateless functions for authentication
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
  return { data, error };
}

/**
 * Sign out of Supabase Auth and terminate the app session.
 */
export async function signOut(appSessionId?: string) {
  // Terminate the app session in the database
  if (appSessionId) {
    await supabase
      .from('sessions')
      .update({
        terminated_at: new Date().toISOString(),
        termination_reason: 'logout',
      })
      .eq('id', appSessionId);
  }

  const { error } = await supabase.auth.signOut();
  return { error };
}

/**
 * Fetch the user profile from the public.users table.
 */
export async function fetchUserProfile(userId: string): Promise<{ data: User | null; error: unknown }> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching user profile:', error);
    return { data: null, error };
  }

  return { data: data as User, error: null };
}

/**
 * Create an app-level session in the sessions table.
 * The DB trigger `terminate_existing_sessions` will automatically
 * terminate any previous active sessions for this user.
 */
export async function createAppSession(userId: string): Promise<{ data: AppSession | null; error: unknown }> {
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

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      user_id: userId,
      expires_at: expiresAt.toISOString(),
      device_info: deviceInfo,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating app session:', error);
    return { data: null, error };
  }

  return { data: data as AppSession, error: null };
}

/**
 * Check if the current app session is still valid (not expired, not terminated).
 */
export async function checkSessionValidity(sessionId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('sessions')
    .select('expires_at, terminated_at')
    .eq('id', sessionId)
    .single();

  if (error || !data) return false;
  if (data.terminated_at) return false;

  const expiresAt = new Date(data.expires_at);
  return expiresAt > new Date();
}

/**
 * Extend the current app session by another 2 hours.
 * Called after successful re-authentication.
 */
export async function extendSession(sessionId: string): Promise<boolean> {
  const newExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000);

  const { error } = await supabase
    .from('sessions')
    .update({ expires_at: newExpiry.toISOString() })
    .eq('id', sessionId);

  return !error;
}
