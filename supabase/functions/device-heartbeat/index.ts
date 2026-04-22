import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { device_id, device_token, device_code, status, app_version, last_content_played, metadata } = await req.json()

    if (!device_id && !device_token && !device_code) {
      return new Response(
        JSON.stringify({ error: 'device_id, device_token, or device_code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Identify device
    let query = supabase.from('devices').select('id, metadata')
    if (device_id) {
      query = query.eq('id', device_id)
    } else if (device_token) {
      query = query.eq('device_token', device_token)
    } else {
      query = query.eq('device_code', device_code)
    }


    const { data: device, error: deviceError } = await query.maybeSingle()

    if (deviceError || !device) {
      return new Response(
        JSON.stringify({ error: 'Device not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Detect IP
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'

    // Update device
    const newMetadata = {
      ...(device.metadata as any || {}),
      ...(metadata || {}),
      ip: clientIp,
      app_version: app_version || (device.metadata as any)?.app_version,
      last_content_played: last_content_played || (device.metadata as any)?.last_content_played,
    }

    const { error: updateError } = await supabase
      .from('devices')
      .update({
        last_seen_at: new Date().toISOString(),
        status: status || 'online',
        metadata: newMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', device.id)

    if (updateError) {
      throw updateError
    }

    return new Response(
      JSON.stringify({ success: true, timestamp: new Date().toISOString() }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[Heartbeat Error]:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
