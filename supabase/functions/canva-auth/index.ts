 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
 };
 
 const CANVA_AUTH_URL = 'https://www.canva.com/api/oauth/authorize';
 const CANVA_TOKEN_URL = 'https://api.canva.com/rest/v1/oauth/token';
 const CANVA_API_BASE = 'https://api.canva.com/rest/v1';
 
 // Generate code verifier for PKCE
 function generateCodeVerifier(): string {
   const array = new Uint8Array(32);
   crypto.getRandomValues(array);
   return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
 }
 
 // Generate code challenge from verifier (S256)
 async function generateCodeChallenge(verifier: string): Promise<string> {
   const encoder = new TextEncoder();
   const data = encoder.encode(verifier);
   const digest = await crypto.subtle.digest('SHA-256', data);
   const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
   return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
 }

 // FIX #2 & #3 & #6: Extracted token refresh helper — eliminates 3x duplication,
 // checks for null refresh_token, and provides a single place for future locking logic.
 async function getValidCanvaToken(
   supabase: ReturnType<typeof createClient>,
   userId: string,
   clientId: string,
   clientSecret: string,
 ): Promise<{ accessToken: string } | { error: string; status: number }> {
   const { data: connection, error: connError } = await supabase
     .from('canva_connections')
     .select('access_token, refresh_token, expires_at')
     .eq('user_id', userId)
     .single();

   if (connError || !connection) {
     return { error: 'Not connected to Canva', status: 401 };
   }

   let accessToken = connection.access_token;

   // Check if token needs refresh (with 60s buffer to avoid edge-case expiry)
   const expiresAt = new Date(connection.expires_at);
   if (expiresAt.getTime() <= Date.now() + 60_000) {
     // FIX #3: Check for null refresh_token before attempting refresh
     if (!connection.refresh_token) {
       console.error('[Canva Auth] No refresh token available for user:', userId);
       await supabase.from('canva_connections').delete().eq('user_id', userId);
       return { error: 'Refresh token missing, please reconnect', status: 401 };
     }

     console.log('[Canva Auth] Token expired, refreshing for user:', userId);

     const refreshResponse = await fetch(CANVA_TOKEN_URL, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/x-www-form-urlencoded',
         'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
       },
       body: new URLSearchParams({
         grant_type: 'refresh_token',
         refresh_token: connection.refresh_token,
       }).toString(),
     });

     const refreshData = await refreshResponse.json();

     if (!refreshResponse.ok) {
       console.error('[Canva Auth] Token refresh failed:', refreshData);
       await supabase.from('canva_connections').delete().eq('user_id', userId);
       return { error: 'Token expired, please reconnect', status: 401 };
     }

     accessToken = refreshData.access_token;
     const newExpiresAt = new Date(Date.now() + (refreshData.expires_in || 3600) * 1000).toISOString();

     await supabase.from('canva_connections').update({
       access_token: accessToken,
       refresh_token: refreshData.refresh_token || connection.refresh_token,
       expires_at: newExpiresAt,
     }).eq('user_id', userId);
   }

   return { accessToken };
 }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const clientId = Deno.env.get('CANVA_CLIENT_ID');
    const clientSecret = Deno.env.get('CANVA_CLIENT_SECRET');
    
    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: 'Canva credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- AUTH CHECK: Verify JWT and enforce user_id match ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: authedUser }, error: authError } = await anonClient.auth.getUser();
    if (authError || !authedUser) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // --- END AUTH CHECK ---

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
     // Action: Get authorization URL
    if (action === 'get_auth_url') {
        const body = await req.json();
        const { redirect_uri } = body;
        const user_id = authedUser.id;
        
        if (!redirect_uri) {
          return new Response(
            JSON.stringify({ error: 'redirect_uri is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
       }
       
       const codeVerifier = generateCodeVerifier();
       const codeChallenge = await generateCodeChallenge(codeVerifier);
       const state = crypto.randomUUID();
       
       // Store verifier and state temporarily (expires in 10 min)
       const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
       
       // FIX #5: Check upsert result — if it fails, don't generate a broken auth URL
       const { error: upsertError } = await supabase.from('canva_auth_states').upsert({
        user_id,
        state,
        code_verifier: codeVerifier,
        expires_at: expiresAt,
      });

      if (upsertError) {
        console.error('[Canva Auth] Failed to store auth state:', upsertError);
        return new Response(
          JSON.stringify({ error: 'Failed to initialize auth flow' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const scopes = 'design:meta:read design:content:read folder:read asset:read profile:read';
      
      const authUrl = `${CANVA_AUTH_URL}?` +
        `client_id=${encodeURIComponent(clientId)}&` +
         `response_type=code&` +
         `redirect_uri=${encodeURIComponent(redirect_uri)}&` +
         `scope=${encodeURIComponent(scopes)}&` +
         `state=${encodeURIComponent(state)}&` +
         `code_challenge=${encodeURIComponent(codeChallenge)}&` +
         `code_challenge_method=S256`;
       
       console.log('[Canva Auth] Generated auth URL for user:', user_id);
       
       return new Response(
         JSON.stringify({ auth_url: authUrl, state }),
         { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
     
     // Action: Exchange code for tokens
    if (action === 'exchange_code') {
        const body = await req.json();
        const { code, state, redirect_uri } = body;
        const user_id = authedUser.id;
        
        if (!code || !state || !redirect_uri) {
          return new Response(
            JSON.stringify({ error: 'code, state, and redirect_uri are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
       }
       
       // Get stored verifier
       const { data: authState, error: stateError } = await supabase
         .from('canva_auth_states')
         .select('code_verifier, expires_at')
         .eq('user_id', user_id)
         .eq('state', state)
         .single();
       
       if (stateError || !authState) {
         console.error('[Canva Auth] State not found:', stateError);
         return new Response(
           JSON.stringify({ error: 'Invalid or expired state' }),
           { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
         );
       }
       
       if (new Date(authState.expires_at) < new Date()) {
         return new Response(
           JSON.stringify({ error: 'State expired' }),
           { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
         );
       }
       
       // Exchange code for tokens
       const tokenResponse = await fetch(CANVA_TOKEN_URL, {
         method: 'POST',
         headers: {
           'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
         },
         body: new URLSearchParams({
           grant_type: 'authorization_code',
           code,
           redirect_uri,
           code_verifier: authState.code_verifier,
         }).toString(),
       });
       
       const tokenData = await tokenResponse.json();
       
       if (!tokenResponse.ok) {
         console.error('[Canva Auth] Token exchange failed:', tokenData);
         return new Response(
           JSON.stringify({ error: 'Failed to exchange code', details: tokenData }),
           { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
         );
       }
       
       console.log('[Canva Auth] Token exchange successful for user:', user_id);
       
       // Store tokens
       const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();
       
       await supabase.from('canva_connections').upsert({
         user_id,
         access_token: tokenData.access_token,
         refresh_token: tokenData.refresh_token,
         expires_at: expiresAt,
         scopes: tokenData.scope,
       }, { onConflict: 'user_id' });
       
       // Clean up auth state
       await supabase.from('canva_auth_states').delete().eq('user_id', user_id);
       
       return new Response(
         JSON.stringify({ success: true }),
         { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
     
     // Action: List designs
    if (action === 'list_designs') {
        const body = await req.json();
        const { continuation, folder_id } = body;
        const user_id = authedUser.id;
       
       // FIX #2: Use extracted helper instead of duplicated logic
       const tokenResult = await getValidCanvaToken(supabase, user_id, clientId, clientSecret);
       if ('error' in tokenResult) {
         return new Response(
           JSON.stringify({ error: tokenResult.error, connected: false }),
           { status: tokenResult.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
         );
       }
       const { accessToken } = tokenResult;
       
       // Fetch designs from Canva
       let designsUrl = `${CANVA_API_BASE}/designs?limit=20`;
       if (continuation) {
         designsUrl += `&continuation=${encodeURIComponent(continuation)}`;
       }
       if (folder_id) {
         designsUrl += `&folder_id=${encodeURIComponent(folder_id)}`;
       }
       
       const designsResponse = await fetch(designsUrl, {
         headers: { 'Authorization': `Bearer ${accessToken}` },
       });
       
       if (!designsResponse.ok) {
         const errorData = await designsResponse.text();
         console.error('[Canva API] Failed to list designs:', designsResponse.status, errorData);
         return new Response(
           JSON.stringify({ error: 'Failed to fetch designs from Canva' }),
           { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
         );
       }
       
       const designsData = await designsResponse.json();
       
       return new Response(
         JSON.stringify({ 
           success: true, 
           designs: designsData.items || designsData.designs || [],
           continuation: designsData.continuation,
           connected: true,
         }),
         { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
     
      // Action: List folder items (use folder_id='root' for root folder)
      if (action === 'list_folder_items') {
         const body = await req.json();
         const { folder_id = 'root', continuation } = body;
         const user_id = authedUser.id;
        
        // FIX #2: Use extracted helper instead of duplicated logic
        const tokenResult = await getValidCanvaToken(supabase, user_id, clientId, clientSecret);
        if ('error' in tokenResult) {
          return new Response(
            JSON.stringify({ error: tokenResult.error, connected: false }),
            { status: tokenResult.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const { accessToken } = tokenResult;
        
        let itemsUrl = `${CANVA_API_BASE}/folders/${folder_id}/items?limit=50`;
        if (continuation) {
          itemsUrl += `&continuation=${encodeURIComponent(continuation)}`;
        }
        
        console.log('[Canva API] Fetching folder items:', itemsUrl);
        
        const itemsResponse = await fetch(itemsUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        
        if (!itemsResponse.ok) {
          const errorData = await itemsResponse.text();
          console.error('[Canva API] Failed to list folder items:', itemsResponse.status, errorData);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch folder items from Canva' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const itemsData = await itemsResponse.json();
        
        // Separate folders and designs from items
        const folders = (itemsData.items || []).filter((item: any) => item.type === 'folder');
        const designs = (itemsData.items || []).filter((item: any) => item.type === 'design');
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            items: itemsData.items || [],
            folders: folders.map((f: any) => ({ id: f.folder?.id, name: f.folder?.name })),
            designs: designs.map((d: any) => ({
              id: d.design?.id,
              title: d.design?.title,
              thumbnail: d.design?.thumbnail,
              created_at: d.design?.created_at,
              updated_at: d.design?.updated_at,
            })),
            continuation: itemsData.continuation,
            connected: true,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
     
     // Action: Export design
    if (action === 'export_design') {
        const body = await req.json();
        const { design_id, format = 'png' } = body;
        const user_id = authedUser.id;
        
        if (!design_id) {
          return new Response(
            JSON.stringify({ error: 'design_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
       }
       
       // FIX #2: Use extracted helper instead of duplicated logic
       const tokenResult = await getValidCanvaToken(supabase, user_id, clientId, clientSecret);
       if ('error' in tokenResult) {
         return new Response(
           JSON.stringify({ error: tokenResult.error, connected: false }),
           { status: tokenResult.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
         );
       }
       const { accessToken } = tokenResult;
       
       // Create export job
       console.log('[Canva API] Creating export job for design:', design_id);
       
       const exportResponse = await fetch(`${CANVA_API_BASE}/exports`, {
         method: 'POST',
         headers: {
           'Authorization': `Bearer ${accessToken}`,
           'Content-Type': 'application/json',
         },
         body: JSON.stringify({
           design_id,
           format: { type: format },
         }),
       });
       
       if (!exportResponse.ok) {
         const errorData = await exportResponse.text();
         console.error('[Canva API] Export job failed:', exportResponse.status, errorData);
         return new Response(
           JSON.stringify({ error: 'Failed to create export job' }),
           { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
         );
       }
       
       const exportData = await exportResponse.json();
       const jobId = exportData.job?.id || exportData.id;
       
       console.log('[Canva API] Export job created:', jobId);
       
       // Poll for completion (max 30 seconds)
       let attempts = 0;
       const maxAttempts = 15;
       
       while (attempts < maxAttempts) {
         await new Promise(r => setTimeout(r, 2000));
         
         const statusResponse = await fetch(`${CANVA_API_BASE}/exports/${jobId}`, {
           headers: { 'Authorization': `Bearer ${accessToken}` },
         });
         
         if (!statusResponse.ok) {
           attempts++;
           continue;
         }
         
         const statusData = await statusResponse.json();
         const job = statusData?.job ?? statusData;
         const jobStatus = job?.status ?? statusData?.status;
         console.log('[Canva API] Export status:', jobStatus);

         // Canva returns success/in_progress/failed (not completed)
         if (jobStatus === 'success' || jobStatus === 'completed') {
           const urls = job?.urls || job?.result?.urls || statusData?.urls || [];

           if (!Array.isArray(urls) || urls.length === 0) {
             return new Response(
               JSON.stringify({ error: 'Export succeeded but no download URL was returned' }),
               { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
             );
           }

           return new Response(
             JSON.stringify({ 
               success: true, 
               export_urls: urls,
               status: 'completed',
             }),
             { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
           );
         }
         
         if (jobStatus === 'failed') {
           return new Response(
             JSON.stringify({ error: 'Export failed' }),
             { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
           );
         }
         
         attempts++;
       }
       
       return new Response(
         JSON.stringify({ error: 'Export timeout' }),
         { status: 408, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
     
     // Action: Get connection status
    if (action === 'status') {
        const user_id = authedUser.id;
        
        const { data: connection } = await supabase
          .from('canva_connections')
          .select('expires_at, scopes')
          .eq('user_id', user_id)
          .single();
       
       return new Response(
         JSON.stringify({ 
           connected: !!connection,
           expires_at: connection?.expires_at,
           scopes: connection?.scopes,
         }),
         { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
     
     // Action: Disconnect
    if (action === 'disconnect') {
        const user_id = authedUser.id;
        
        await supabase.from('canva_connections').delete().eq('user_id', user_id);
       
       return new Response(
         JSON.stringify({ success: true }),
         { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
     
     return new Response(
       JSON.stringify({ error: 'Invalid action' }),
       { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
     
   } catch (error: unknown) {
     // FIX #1: Don't expose internal error details to client
     console.error('[Canva Auth] Error:', error);
     return new Response(
       JSON.stringify({ error: 'Internal server error' }),
       { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   }
 });
