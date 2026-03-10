import { supabase } from './supabase';
import type { User, Session as AppSession, Organisation } from '../types/database';

// ============================================================
// Auth Service — stateless functions for authentication
// ============================================================

/** Synthetic email domain used for Supabase Auth internals. */
const SYNTHETIC_DOMAIN = 'cheklistr.app';

/**
 * Convert a User ID + org slug to a synthetic email
 * for Supabase Auth, which requires an email address.
 * The user never sees this — they only interact via User ID.
 *
 * Format: {loginId}.{orgSlug}@cheklistr.app
 * e.g. x123456.greythorn@cheklistr.app
 */
export function toSyntheticEmail(loginId: string, orgSlug: string): string {
  return `${loginId.toLowerCase().trim()}.${orgSlug.toLowerCase().trim()}@${SYNTHETIC_DOMAIN}`;
}

/**
 * Look up an organisation by its slug.
 * Called before authentication to validate the org exists and is active.
 * Uses the anon key (no auth required) — RLS allows public reads on active orgs.
 * Note: We use a service-level approach here by querying without auth;
 * the org lookup happens pre-login so there's no authenticated user yet.
 * The RLS policy allows any authenticated user to read their own org,
 * but for the login flow we need a function that works pre-auth.
 * We use supabase.rpc or a direct REST call for this.
 */
export async function lookupOrganisation(slug: string): Promise<{ data: Organisation | null; error: unknown }> {
  // Query organisations table — the anon key can reach this
  // because we'll add a public SELECT policy for active orgs by slug
  const { data, error } = await supabase
    .from('organisations')
    .select('*')
    .eq('slug', slug.toLowerCase().trim())
    .eq('is_active', true)
    .single();

  if (error) {
    return { data: null, error };
  }

  return { data: data as Organisation, error: null };
}

/**
 * Sign in with org slug + User ID + password via Supabase Auth.
 * Converts the User ID and org slug to a synthetic email internally.
 */
export async function signIn(loginId: string, orgSlug: string, password: string) {
  const email = toSyntheticEmail(loginId, orgSlug);
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
 * Fetch the organisation for the current user.
 */
export async function fetchOrganisation(orgId: string): Promise<{ data: Organisation | null; error: unknown }> {
  const { data, error } = await supabase
    .from('organisations')
    .select('*')
    .eq('id', orgId)
    .single();

  if (error) {
    console.error('Error fetching organisation:', error);
    return { data: null, error };
  }

  return { data: data as Organisation, error: null };
}

/**
 * Create an app-level session in the sessions table.
 * The DB trigger `terminate_existing_sessions` will automatically
 * terminate any previous active sessions for this user.
 */
export async function createAppSession(userId: string, orgId: string): Promise<{ data: AppSession | null; error: unknown }> {
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
      org_id: orgId,
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

/**
 * Create a signed URL for a file in a private storage bucket.
 * Returns null if signing fails.
 */
export async function createSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    console.error('Error creating signed URL:', error);
    return null;
  }

  return data.signedUrl;
}
