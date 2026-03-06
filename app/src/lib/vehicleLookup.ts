import { supabase } from './supabase';

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
 */
export async function lookupVehicle(vrm: string): Promise<VehicleLookupResult> {
  try {
    const { data, error } = await supabase.functions.invoke('vehicle-lookup', {
      body: { vrm },
    });

    if (error) {
      return { found: false, make: null, model: null, colour: null, error: error.message };
    }

    return data as VehicleLookupResult;
  } catch (err) {
    return {
      found: false,
      make: null,
      model: null,
      colour: null,
      error: err instanceof Error ? err.message : 'Lookup failed',
    };
  }
}
