// ============================================================
// Supabase Edge Function: vehicle-lookup
// Proxies VRM lookups to UKVD (UK Vehicle Data) API
// keeping the API key server-side.
// ============================================================

// Correct UKVD endpoint (uk1.ukvehicledata.co.uk)
const UKVD_BASE = 'https://uk1.ukvehicledata.co.uk/api/datapackage/VehicleData';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Verify the caller is authenticated via direct Auth API call.
    //    We bypass the Supabase JS client entirely because getUser()
    //    fails intermittently from Capacitor and mobile origins.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No Authorization header');
      return jsonResponse({ error: 'Missing authorisation header' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': authHeader,
        'apikey': supabaseAnonKey,
      },
    });

    if (!authRes.ok) {
      const authBody = await authRes.text();
      console.error('Auth verification failed:', authRes.status, authBody);
      return jsonResponse({ error: 'Unauthorised' }, 401);
    }

    const user = await authRes.json();
    console.log('Authenticated user:', user.id);

    // 2. Parse the VRM from the request body
    const body = await req.json();
    const vrm = body?.vrm;

    if (!vrm || typeof vrm !== 'string') {
      return jsonResponse({ error: 'VRM is required' }, 400);
    }

    // Clean the VRM (remove spaces, uppercase)
    const cleanVrm = vrm.replace(/\s+/g, '').toUpperCase();
    console.log('Looking up VRM:', cleanVrm);

    // 3. Read the API key — trim any whitespace that secrets CLI may add
    const UKVD_API_KEY = (Deno.env.get('UKVD_API_KEY') ?? '').trim();
    if (!UKVD_API_KEY) {
      console.error('UKVD_API_KEY is not set');
      return jsonResponse({ error: 'UKVD API key not configured' }, 500);
    }

    console.log('UKVD key length:', UKVD_API_KEY.length, 'first4:', UKVD_API_KEY.substring(0, 4));

    // 4. Call UKVD API — correct parameter names for uk1.ukvehicledata.co.uk
    const url = `${UKVD_BASE}?v=2&api_nullitems=1&auth_apikey=${encodeURIComponent(UKVD_API_KEY)}&user_tag=cheklistr&key_VRM=${encodeURIComponent(cleanVrm)}`;

    console.log('Calling UKVD:', url.replace(UKVD_API_KEY, '***'));

    const ukvdResponse = await fetch(url);
    const ukvdText = await ukvdResponse.text();

    console.log('UKVD HTTP status:', ukvdResponse.status);
    console.log('UKVD raw response (first 500):', ukvdText.substring(0, 500));

    // 5. Parse the response
    let ukvdData: Record<string, unknown>;
    try {
      ukvdData = JSON.parse(ukvdText);
    } catch {
      console.error('Failed to parse UKVD response as JSON');
      return jsonResponse({ error: 'Invalid response from vehicle lookup service', found: false });
    }

    // 6. Check response status
    const response = ukvdData?.Response as Record<string, unknown> | undefined;
    const statusCode = response?.StatusCode as string | undefined;
    const statusMessage = response?.StatusMessage as string | undefined;

    console.log('UKVD StatusCode:', statusCode, 'StatusMessage:', statusMessage);

    if (statusCode !== 'Success') {
      return jsonResponse({
        error: statusMessage ?? 'Vehicle not found',
        found: false,
      });
    }

    // 7. Extract vehicle data from DataItems
    const dataItems = response?.DataItems as Record<string, unknown> | undefined;
    console.log('DataItems keys:', dataItems ? Object.keys(dataItems) : 'none');

    // Log to discover exact structure
    if (dataItems) {
      console.log('DataItems content (first 800):', JSON.stringify(dataItems).substring(0, 800));
    }

    // VehicleData package typically nests under ClassificationDetails / VehicleRegistration
    const classDetails = dataItems?.ClassificationDetails as Record<string, unknown> | undefined;
    const vehReg = dataItems?.VehicleRegistration as Record<string, unknown> | undefined;
    const smmt = dataItems?.SmmtDetails as Record<string, unknown> | undefined;

    // Try multiple possible field locations
    const make = (
      classDetails?.Make ?? vehReg?.Make ?? smmt?.Make ??
      dataItems?.Make ?? null
    ) as string | null;

    const model = (
      classDetails?.Model ?? vehReg?.Model ?? smmt?.Model ??
      dataItems?.Model ?? null
    ) as string | null;

    const colour = (
      vehReg?.Colour ?? classDetails?.Colour ??
      dataItems?.Colour ?? null
    ) as string | null;

    const result = { found: true, make, model, colour };
    console.log('Returning:', JSON.stringify(result));

    return jsonResponse(result);

  } catch (err) {
    console.error('Vehicle lookup error:', err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
