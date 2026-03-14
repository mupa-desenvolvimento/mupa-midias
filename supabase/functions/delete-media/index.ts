import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1"
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.18"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  console.log('=== delete-media function called ===')
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    
    if (authError || !user) {
      console.error('Auth error:', authError?.message)
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Authenticated user:', user.email)

    // Get media ID from request body
    const { mediaId } = await req.json()
    
    if (!mediaId) {
      return new Response(
        JSON.stringify({ error: 'Missing mediaId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get R2 credentials
    const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID')
    const accessKeyId = Deno.env.get('CLOUDFLARE_R2_ACCESS_KEY_ID')
    const secretAccessKey = Deno.env.get('CLOUDFLARE_R2_SECRET_ACCESS_KEY')
    const bucketName = Deno.env.get('CLOUDFLARE_R2_BUCKET_NAME')

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      console.error('Missing R2 credentials')
      return new Response(
        JSON.stringify({ error: 'R2 credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get media item from database
    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data: mediaItem, error: fetchError } = await supabaseAdmin
      .from('media_items')
      .select('*')
      .eq('id', mediaId)
      .single()

    if (fetchError || !mediaItem) {
      console.error('Media not found:', fetchError?.message)
      return new Response(
        JSON.stringify({ error: 'Media not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Deleting media:', mediaItem.name)

    // Create R2 client
    const r2 = new AwsClient({
      accessKeyId,
      secretAccessKey,
      service: 's3',
      region: 'auto',
    })

    const r2Endpoint = `https://${accountId}.r2.cloudflarestorage.com`

    // Delete file from R2 if r2_key exists in metadata
    const metadata = mediaItem.metadata as { r2_key?: string; thumbnail_key?: string } | null
    if (metadata?.r2_key) {
      const deleteUrl = `${r2Endpoint}/${bucketName}/${metadata.r2_key}`
      console.log('Deleting from R2:', metadata.r2_key)
      
      try {
        const deleteResponse = await r2.fetch(deleteUrl, { method: 'DELETE' })
        if (!deleteResponse.ok) {
          console.warn('R2 delete failed:', deleteResponse.status)
        } else {
          console.log('File deleted from R2')
        }
      } catch (r2Error) {
        console.warn('R2 delete error:', r2Error)
        // Continue with database deletion even if R2 fails
      }

      // Also delete thumbnail if exists
      if (metadata?.thumbnail_key) {
        const thumbnailDeleteUrl = `${r2Endpoint}/${bucketName}/${metadata.thumbnail_key}`
        try {
          await r2.fetch(thumbnailDeleteUrl, { method: 'DELETE' })
          console.log('Thumbnail deleted from R2')
        } catch (thumbError) {
          console.warn('Thumbnail delete error:', thumbError)
        }
      }
    }

    // Delete from database
    const { error: deleteError } = await supabaseAdmin
      .from('media_items')
      .delete()
      .eq('id', mediaId)

    if (deleteError) {
      console.error('Database delete error:', deleteError)
      return new Response(
        JSON.stringify({ error: 'Failed to delete media record', details: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Media deleted successfully:', mediaId)

    return new Response(
      JSON.stringify({ success: true, deletedId: mediaId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

 } catch (error: unknown) {
    console.error('Delete error:', error)
    return new Response(
      JSON.stringify({ error: 'Erro ao excluir mídia. Tente novamente.' }),
       { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     )
  }
})
