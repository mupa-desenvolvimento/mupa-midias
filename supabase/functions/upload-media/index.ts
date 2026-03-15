import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1"
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.18"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Allowed file types - expanded to support more formats
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
  'image/svg+xml', 'image/bmp', 'image/tiff'
]
const ALLOWED_VIDEO_TYPES = [
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
  'video/x-matroska', 'video/ogg', 'video/3gpp'
]
const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac',
  'audio/flac', 'audio/x-m4a'
]
const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/json',
  'application/xml',
  'text/html',
  'text/markdown'
]

const ALLOWED_FONT_TYPES = [
  'font/ttf',
  'font/otf',
  'font/woff',
  'font/woff2',
  'application/font-woff',
  'application/font-woff2',
  'application/x-font-ttf',
  'application/x-font-opentype',
  'application/x-font-woff',
  'application/x-font-woff2',
  'application/vnd.ms-fontobject'
]

const ALL_ALLOWED_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_VIDEO_TYPES,
  ...ALLOWED_AUDIO_TYPES,
  ...ALLOWED_DOCUMENT_TYPES,
  ...ALLOWED_FONT_TYPES
]

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

// Thumbnail settings
const THUMBNAIL_WIDTH = 1280
const THUMBNAIL_HEIGHT = 720

// Helper to determine media type category
function getMediaType(mimeType: string): string {
  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) return 'image'
  if (ALLOWED_VIDEO_TYPES.includes(mimeType)) return 'video'
  if (ALLOWED_AUDIO_TYPES.includes(mimeType)) return 'audio'
  if (ALLOWED_FONT_TYPES.includes(mimeType)) return 'font'
  return 'document'
}

Deno.serve(async (req) => {
  console.log('=== upload-media function called ===')
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    if (req.method === 'GET' || req.method === 'HEAD') {
      const mediaId = url.searchParams.get('mediaId') || url.searchParams.get('id')
      if (!mediaId) {
        return new Response(
          JSON.stringify({ error: 'Missing mediaId' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      if (!serviceRole) {
        return new Response(
          JSON.stringify({ error: 'Service role not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
        auth: { autoRefreshToken: false, persistSession: false }
      })

      const { data: mediaItem, error: mediaError } = await supabaseAdmin
        .from('media_items')
        .select('id,type,file_url,metadata')
        .eq('id', mediaId)
        .single()

      if (mediaError || !mediaItem?.file_url) {
        return new Response(
          JSON.stringify({ error: 'Media not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (mediaItem.type !== 'font') {
        return new Response(
          JSON.stringify({ error: 'Unsupported media type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const range = req.headers.get('Range')
      const upstream = await fetch(mediaItem.file_url, {
        method: req.method,
        headers: range ? { Range: range } : undefined,
      })

      const headers = new Headers(corsHeaders)
      const meta = (mediaItem as any)?.metadata as any
      const contentType =
        (typeof meta?.content_type === 'string' && meta.content_type.trim()) ||
        upstream.headers.get('content-type') ||
        'application/octet-stream'

      headers.set('Content-Type', contentType)
      headers.set('Cache-Control', 'public, max-age=31536000, immutable')

      const passthrough = ['accept-ranges', 'content-range', 'content-length', 'etag', 'last-modified']
      for (const h of passthrough) {
        const v = upstream.headers.get(h)
        if (v) headers.set(h, v)
      }

      return new Response(upstream.body, { status: upstream.status, headers })
    }
    
    // Step 1: Verify authentication
    console.log('Step 1: Verifying authentication...')
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

    // Get Cloudflare R2 credentials
    const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID')
    const accessKeyId = Deno.env.get('CLOUDFLARE_R2_ACCESS_KEY_ID')
    const secretAccessKey = Deno.env.get('CLOUDFLARE_R2_SECRET_ACCESS_KEY')
    const bucketName = Deno.env.get('CLOUDFLARE_R2_BUCKET_NAME')

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      console.error('Missing R2 credentials:', { accountId: !!accountId, accessKeyId: !!accessKeyId, secretAccessKey: !!secretAccessKey, bucketName: !!bucketName })
      return new Response(
        JSON.stringify({ error: 'R2 credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse multipart form data
    const formData = await req.formData()
    const file = formData.get('file') as File
    const fileName = formData.get('fileName') as string || file.name
    const fileType = formData.get('fileType') as string || file.type
    const folderId = formData.get('folderId') as string || null
    const fontFamily = (formData.get('fontFamily') as string | null)?.trim() || null

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 2: Validate file
    console.log('Step 2: Validating file...')
    console.log('File details:', { name: fileName, type: fileType, size: file.size })

    const inferMimeFromName = (name: string): string | null => {
      const ext = name.split('.').pop()?.toLowerCase() || ''
      if (ext === 'ttf') return 'font/ttf'
      if (ext === 'otf') return 'font/otf'
      if (ext === 'woff') return 'font/woff'
      if (ext === 'woff2') return 'font/woff2'
      if (ext === 'eot') return 'application/vnd.ms-fontobject'
      return null
    }

    // Validate file type
    const receivedTypeLower = (fileType || '').toLowerCase()
    const normalizedTypeLower = receivedTypeLower.split(';')[0].trim()
    const inferredTypeLower = inferMimeFromName(fileName)?.toLowerCase() || null

    const shouldInfer =
      !normalizedTypeLower ||
      normalizedTypeLower === 'application/octet-stream' ||
      normalizedTypeLower === 'binary/octet-stream'

    const effectiveTypeLower = shouldInfer && inferredTypeLower ? inferredTypeLower : normalizedTypeLower

    const isImage = ALLOWED_IMAGE_TYPES.includes(effectiveTypeLower)
    const isVideo = ALLOWED_VIDEO_TYPES.includes(effectiveTypeLower)
    const isAudio = ALLOWED_AUDIO_TYPES.includes(effectiveTypeLower)
    const isDocument = ALLOWED_DOCUMENT_TYPES.includes(effectiveTypeLower)
    const isFont = ALLOWED_FONT_TYPES.includes(effectiveTypeLower)
    const isAllowed = ALL_ALLOWED_TYPES.includes(effectiveTypeLower)
    
    if (!isAllowed) {
      console.error('Invalid file type:', fileType)
      return new Response(
        JSON.stringify({ 
          error: 'Tipo de arquivo não permitido', 
          details: 'Formatos aceitos: imagens, vídeos, áudios, PDFs, documentos, planilhas e fontes',
          received: fileType,
          normalized: normalizedTypeLower,
          inferred: inferredTypeLower
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      console.error('File too large:', file.size)
      return new Response(
        JSON.stringify({ 
          error: 'Arquivo muito grande', 
          details: `Tamanho máximo: ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
          received: `${(file.size / (1024 * 1024)).toFixed(2)}MB`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const mediaType = getMediaType(effectiveTypeLower)
    console.log('File validation passed:', { isImage, isVideo, isAudio, isDocument, mediaType })

    // Generate unique file keys
    const timestamp = Date.now()
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const basePrefix = mediaType === 'font' ? 'fonts' : 'media'
    const fileKey = `${basePrefix}/${timestamp}-${sanitizedName}`
    const thumbnailKey = `thumbnails/${timestamp}-${sanitizedName.replace(/\.[^.]+$/, '.jpg')}`

    // Create AWS client for R2 using aws4fetch
    const r2 = new AwsClient({
      accessKeyId,
      secretAccessKey,
      service: 's3',
      region: 'auto',
    })

    const r2Endpoint = `https://${accountId}.r2.cloudflarestorage.com`
    const uploadUrl = `${r2Endpoint}/${bucketName}/${fileKey}`
    const thumbnailUploadUrl = `${r2Endpoint}/${bucketName}/${thumbnailKey}`

    // Step 3: Upload original file to R2
    console.log('Step 3: Uploading original file to R2...')
    const fileBuffer = await file.arrayBuffer()
    const uploadResponse = await r2.fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': effectiveTypeLower || fileType,
        'Content-Length': file.size.toString(),
      },
      body: fileBuffer,
    })

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      console.error('R2 upload failed:', uploadResponse.status, errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to upload to R2', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Original file uploaded successfully:', fileKey)

    // Step 4: Build public URLs
    console.log('Step 4: Building public URLs...')
    
    // Get public URL from environment - REQUIRED for proper access
    const publicBaseUrl = Deno.env.get('CLOUDFLARE_R2_PUBLIC_URL')
    
    if (!publicBaseUrl) {
      console.error('CLOUDFLARE_R2_PUBLIC_URL not configured')
      return new Response(
        JSON.stringify({ error: 'Storage public URL not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const publicFileUrl = `${publicBaseUrl}/${fileKey}`
    // For images, use the main file as thumbnail; for others, null
    const publicThumbnailUrl = isImage ? publicFileUrl : null
    const thumbnailGenerated = isImage
    const resolution: string | null = null
    const duration: number | null = null
    
    // Default duration based on type
    const defaultDuration = isImage ? 10 : (isDocument ? 30 : null) // 10s images, 30s documents
    
    console.log('Public file URL:', publicFileUrl)
    console.log('Public thumbnail URL:', publicThumbnailUrl)
    
    // Step 5: Verify public access
    console.log('Step 5: Verifying public access...')
    try {
      const accessCheck = await fetch(publicFileUrl, { method: 'HEAD' })
      if (accessCheck.ok) {
        console.log('Public access verified successfully')
      } else {
        console.warn('Public access check returned:', accessCheck.status)
      }
    } catch (accessError) {
      console.warn('Access verification skipped:', accessError)
    }

    // Step 6: Save to database
    console.log('Step 6: Saving media record to database...')

    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data: mediaItem, error: insertError } = await supabaseAdmin
      .from('media_items')
      .insert({
        name: mediaType === 'font' && fontFamily ? fontFamily : fileName,
        type: mediaType,
        file_url: publicFileUrl,
        file_size: file.size,
        duration: duration || defaultDuration,
        resolution: resolution,
        status: 'active', // Always active once uploaded successfully
        thumbnail_url: publicThumbnailUrl,
        folder_id: folderId,
        metadata: {
          r2_key: fileKey,
          thumbnail_key: thumbnailKey,
          content_type: effectiveTypeLower || fileType,
          uploaded_by: user.email,
          thumbnail_generated: thumbnailGenerated,
          validated_at: new Date().toISOString(),
          thumbnail_size: { width: THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT },
          original_signed_url: uploadUrl,
          font_family: fontFamily,
          original_file_name: fileName
        }
      })
      .select()
      .single()

    if (insertError) {
      console.error('Database insert error:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to save media record', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Media item created successfully:', mediaItem.id)
    console.log('=== Upload completed successfully ===')

    return new Response(
      JSON.stringify({ 
        success: true, 
        mediaItem,
        fileUrl: publicFileUrl,
        thumbnailUrl: publicThumbnailUrl,
        r2Key: fileKey,
        thumbnailGenerated,
        validation: {
          type: mediaType,
          size: file.size,
          contentType: fileType,
          validatedAt: new Date().toISOString()
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

 } catch (error: unknown) {
    console.error('Upload error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ 
        error: 'Erro ao processar upload. Tente novamente.',
        code: 'UPLOAD_FAILED'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
