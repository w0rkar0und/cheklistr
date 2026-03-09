import { SUPABASE_URL, SUPABASE_ANON_KEY, getAccessTokenFromStorage } from './supabase';

export interface VehicleLookupResult {
  found: boolean;
  make: string | null;
  model: string | null;
  colour: string | null;
  error?: string;
}

/**
 * Look up vehicle make, model and colour from VRM
 * via the server-side UKVD Edge Function.
 *
 * Uses raw fetch with an explicit auth token because
 * supabase.functions.invoke() can fail to attach the session
 * token in Capacitor WebView environments, and can also hang
 * when the JS client's auth session is mid-refresh.
 */
export async function lookupVehicle(vrm: string): Promise<VehicleLookupResult> {
  try {
    const accessToken = getAccessTokenFromStorage();
    if (!accessToken) {
      return { found: false, make: null, model: null, colour: null, error: 'Not authenticated — please log out and log back in.' };
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/vehicle-lookup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ vrm }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error('[VRM] Edge function error:', res.status, errBody);
      try {
        const parsed = JSON.parse(errBody);
        return { found: false, make: null, model: null, colour: null, error: parsed.error ?? `Lookup failed (${res.status})` };
      } catch {
        return { found: false, make: null, model: null, colour: null, error: `Lookup failed (${res.status})` };
      }
    }

    const data = await res.json();
    return data as VehicleLookupResult;
  } catch (err) {
    console.error('[VRM] Lookup exception:', err);
    return {
      found: false,
      make: null,
      model: null,
      colour: null,
      error: err instanceof Error ? err.message : 'Lookup failed',
    };
  }
}
