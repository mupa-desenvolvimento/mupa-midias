// deno-lint-ignore-file
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HEARTBEAT_TIMEOUT_SECONDS = 45; // Consider device offline if no heartbeat for 45s

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { action, device_code, session_id } = await req.json();

    if (!device_code) {
      return new Response(
        JSON.stringify({ error: 'device_code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find device
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('id, name, status, last_seen_at, metadata')
      .eq('device_code', device_code)
      .single();

    if (deviceError || !device) {
      return new Response(
        JSON.stringify({ error: 'Device not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'claim') {
      // Check if device is currently active (recent heartbeat)
      const isCurrentlyActive = device.status === 'online' && device.last_seen_at &&
        ((Date.now() - new Date(device.last_seen_at).getTime()) / 1000) < HEARTBEAT_TIMEOUT_SECONDS;

      // Check if the same session is trying to reclaim
      const existingSessionId = device.metadata?.session_id;
      const isSameSession = session_id && existingSessionId === session_id;

      if (isCurrentlyActive && !isSameSession) {
        return new Response(
          JSON.stringify({
            success: false,
            blocked: true,
            message: 'Este dispositivo já está reproduzindo conteúdo em outra sessão.',
            device_name: device.name,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Claim the device
      const newSessionId = session_id || crypto.randomUUID();
      await supabase
        .from('devices')
        .update({
          status: 'online',
          last_seen_at: new Date().toISOString(),
          metadata: { ...(device.metadata || {}), session_id: newSessionId },
        })
        .eq('id', device.id);

      return new Response(
        JSON.stringify({ success: true, session_id: newSessionId, device_name: device.name }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'heartbeat') {
      // Only allow heartbeat from the session owner
      const existingSessionId = device.metadata?.session_id;
      if (session_id && existingSessionId && existingSessionId !== session_id) {
        return new Response(
          JSON.stringify({ success: false, blocked: true, message: 'Sessão inválida' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await supabase
        .from('devices')
        .update({ last_seen_at: new Date().toISOString(), status: 'online' })
        .eq('id', device.id);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'release') {
      // Only release if same session
      const existingSessionId = device.metadata?.session_id;
      if (!session_id || existingSessionId === session_id) {
        const newMetadata = { ...(device.metadata || {}) };
        delete newMetadata.session_id;

        await supabase
          .from('devices')
          .update({
            status: 'offline',
            metadata: newMetadata,
          })
          .eq('id', device.id);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use: claim, heartbeat, release' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
