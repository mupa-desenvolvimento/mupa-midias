// deno-lint-ignore-file
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type StandardPriceResponse = {
  name: string
  price: number
  promo_price: number
  image: string
  barcode: string
  store: string
}

const getPathValue = (obj: any, path: string) => {
  if (!obj || !path) return undefined
  const parts = String(path)
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .map((p) => p.trim())
    .filter(Boolean)
  let cur: any = obj
  for (const part of parts) {
    if (cur == null) return undefined
    const key: any = /^\d+$/.test(part) ? Number(part) : part
    cur = cur[key]
  }
  return cur
}

const isCacheValid = (cache: any) => {
  const token = cache?.access_token
  const expiresAt = cache?.expires_at
  if (!token || !expiresAt) return false
  const ms = Date.parse(expiresAt)
  if (!Number.isFinite(ms)) return false
  return Date.now() < ms - 30_000
}

const buildUrl = (baseUrl: string | null | undefined, urlOrPath: string | null | undefined) => {
  const trimmed = String(urlOrPath || '').trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  const base = String(baseUrl || '').trim()
  if (!base) return trimmed
  return `${base.replace(/\/+$/, '')}/${trimmed.replace(/^\/+/, '')}`
}

const interpolateString = (value: string, context: Record<string, string>) => {
  return value.replace(/\{(\w+)\}/g, (_, key) => (context[key] ?? `{${key}}`))
}

const interpolateJson = (value: any, context: Record<string, string>): any => {
  if (value == null) return value
  if (typeof value === 'string') return interpolateString(value, context)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.map((v) => interpolateJson(v, context))
  if (typeof value === 'object') {
    const out: Record<string, any> = {}
    for (const [k, v] of Object.entries(value)) out[k] = interpolateJson(v, context)
    return out
  }
  return String(value)
}

const safeJsonParse = async (res: Response) => {
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) return await res.json()
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { _raw: text }
  }
}

const normalizeComparableValue = (value: unknown) => String(value ?? '').trim().toUpperCase()

const getStoreLookupCandidates = (store: { code?: string | null; metadata?: unknown }) => {
  const metadata = store.metadata && typeof store.metadata === 'object' ? (store.metadata as Record<string, unknown>) : {}
  return [
    store.code,
    metadata.external_id,
    metadata.externalId,
    metadata.num_filial,
    metadata.numFilial,
    metadata.store_number,
    metadata.storeNumber,
    metadata.branch_number,
    metadata.branchNumber,
  ]
    .map((value) => normalizeComparableValue(value))
    .filter(Boolean)
}

const toStandardResponse = (raw: any, mapping: any, barcode: string, store: string): StandardPriceResponse => {
  const m = mapping && typeof mapping === 'object' ? mapping : {}
  const name = typeof m.name === 'string' ? getPathValue(raw, m.name) : undefined
  const price = typeof m.price === 'string' ? getPathValue(raw, m.price) : undefined
  const promo = typeof m.promo_price === 'string' ? getPathValue(raw, m.promo_price) : undefined
  const image = typeof m.image === 'string' ? getPathValue(raw, m.image) : undefined

  return {
    name: typeof name === 'string' ? name : '',
    price: typeof price === 'number' ? price : Number(price || 0) || 0,
    promo_price: typeof promo === 'number' ? promo : Number(promo || 0) || 0,
    image: typeof image === 'string' ? image : '',
    barcode,
    store,
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const url = new URL(req.url)
  const path = url.pathname.split('/').pop() // Get last segment

  try {
    // ─── POST /device-api/cadastro ───
    // Rota pública de autocadastro de dispositivo via app Android
    if (path === 'cadastro' && req.method === 'POST') {
      const rawBody = await req.text()
      let body: Record<string, any> = {}

      if (rawBody.trim()) {
        try {
          body = JSON.parse(rawBody) as Record<string, any>
        } catch {
          return new Response(
            JSON.stringify({ error: 'JSON inválido no corpo da requisição' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }
      }

      const codigoEmpresa = String(body.codigo_empresa || '').trim().toUpperCase()
      const apelidoDispositivo = String(body.apelido_dispositivo || '').trim()
      const numFilial = String(body.num_filial || '').trim()
      const deviceName = String(body.device_name || '').trim()
      const androidId = String(body.android_id || '').trim()
      const serialNumber = String(body.serial_number || '').trim()

      // Validação (num_filial e serial_number são opcionais)
      const missing: string[] = []
      if (!codigoEmpresa) missing.push('codigo_empresa')
      if (!apelidoDispositivo) missing.push('apelido_dispositivo')
      if (!deviceName) missing.push('device_name')
      if (!androidId) missing.push('android_id')
      if (missing.length > 0) {
        return new Response(
          JSON.stringify({ error: `Campos obrigatórios ausentes: ${missing.join(', ')}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      // 1. Buscar empresa pelo código
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('id, name, tenant_id')
        .eq('code', codigoEmpresa)
        .eq('is_active', true)
        .maybeSingle()

      if (companyError || !company) {
        return new Response(
          JSON.stringify({ error: `Empresa com código "${codigoEmpresa}" não encontrada ou inativa` }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      // 2. Buscar grupo padrão do tenant
      const { data: defaultGroup } = await supabase
        .from('device_groups')
        .select('id')
        .eq('tenant_id', company.tenant_id)
        .eq('is_default', true)
        .maybeSingle()

      // 3. Registrar dispositivo via RPC
      const deviceCode = serialNumber || androidId
      const { data: registerResult, error: registerError } = await supabase.rpc('register_device', {
        p_device_code: deviceCode,
        p_name: apelidoDispositivo,
        p_store_id: null,
        p_company_id: company.id,
        p_group_id: defaultGroup?.id || null,
        p_store_code: numFilial || null,
      })

      if (registerError) {
        return new Response(
          JSON.stringify({ error: registerError.message || 'Erro ao registrar dispositivo' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const result = registerResult as any

      // 4. Salvar android_id, device_name e num_filial no metadata
      if (result?.device_id) {
        await supabase
          .from('devices')
          .update({
            metadata: { android_id: androidId, device_name: deviceName, num_filial: numFilial || null } as any,
          })
          .eq('id', result.device_id)
      }

      return new Response(
        JSON.stringify({
          device_id: result.device_id,
          device_token: result.device_token,
          device_code: deviceCode,
          group_id: result.group_id || null,
          company_name: company.name,
          num_filial: numFilial || null,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ─── GET /device-api/dispositivo?android_id=XXX ou ?serial_number=XXX ───
    if (path === 'dispositivo' && req.method === 'GET') {
      const androidId = (url.searchParams.get('android_id') || '').trim()
      const serialNumber = (url.searchParams.get('serial_number') || '').trim()

      if (!androidId && !serialNumber) {
        return new Response(
          JSON.stringify({ error: 'Informe android_id ou serial_number como query parameter' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      // Buscar pelo device_code (serial_number tem prioridade) ou pelo android_id no metadata
      let device: any = null

      if (serialNumber) {
        const { data } = await supabase
          .from('devices')
          .select('id, device_code, name, store_id, store_code, company_id, group_id, status, is_active, is_blocked, blocked_message, metadata, device_token, camera_enabled, last_seen_at, created_at, updated_at')
          .eq('device_code', serialNumber)
          .maybeSingle()
        device = data
      }

      if (!device && androidId) {
        // Buscar pelo android_id salvo no metadata
        const { data } = await supabase
          .from('devices')
          .select('id, device_code, name, store_id, store_code, company_id, group_id, status, is_active, is_blocked, blocked_message, metadata, device_token, camera_enabled, last_seen_at, created_at, updated_at')
          .filter('metadata->>android_id', 'eq', androidId)
          .maybeSingle()
        device = data
      }

      if (!device) {
        return new Response(
          JSON.stringify({ error: 'Dispositivo não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      // Buscar nome da empresa
      let companyName: string | null = null
      if (device.company_id) {
        const { data: company } = await supabase
          .from('companies')
          .select('name')
          .eq('id', device.company_id)
          .maybeSingle()
        companyName = company?.name || null
      }

      // Buscar nome do grupo
      let groupName: string | null = null
      if (device.group_id) {
        const { data: group } = await supabase
          .from('device_groups')
          .select('name')
          .eq('id', device.group_id)
          .maybeSingle()
        groupName = group?.name || null
      }

      const meta = device.metadata && typeof device.metadata === 'object' ? device.metadata : {}

      return new Response(
        JSON.stringify({
          device_id: device.id,
          device_code: device.device_code,
          device_token: device.device_token,
          apelido_dispositivo: device.name,
          device_name: meta.device_name || null,
          android_id: meta.android_id || null,
          serial_number: device.device_code !== (meta.android_id || '') ? device.device_code : null,
          num_filial: device.store_code || meta.num_filial || null,
          company_id: device.company_id,
          company_name: companyName,
          group_id: device.group_id,
          group_name: groupName,
          status: device.status,
          is_active: device.is_active,
          is_blocked: device.is_blocked,
          blocked_message: device.blocked_message,
          camera_enabled: device.camera_enabled,
          last_seen_at: device.last_seen_at,
          created_at: device.created_at,
          updated_at: device.updated_at,
          metadata: meta,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (path === 'price') {
      const queryBarcode = url.searchParams.get('barcode') || ''
      const queryStore = url.searchParams.get('store') || ''
      const queryIntegrationId = url.searchParams.get('integration_id') || ''

      const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}

      const barcode = String((body as any).barcode || queryBarcode || '').trim()
      const store = String((body as any).store || queryStore || '').trim()
      const integrationId = String((body as any).integration_id || queryIntegrationId || '').trim()

      if (!barcode || !store || !integrationId) {
        return new Response(JSON.stringify({ error: true, message: 'Missing: integration_id, barcode, store' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: integration, error: integrationError } = await supabase
        .from('api_integrations')
        .select(
          'id, base_url, auth_url, auth_method, auth_body_json, auth_token_path, token_expiration_seconds, token_cache, request_url, request_method, request_headers_json, request_params_json, barcode_param_name, store_param_name, response_mapping_json, is_active',
        )
        .eq('id', integrationId)
        .maybeSingle()

      if (integrationError || !integration) {
        return new Response(JSON.stringify({ error: true, message: 'Integration not found' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (!integration.is_active) {
        return new Response(JSON.stringify({ error: true, message: 'Integration is inactive' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      let token = ''

      const authUrl = String((integration as any).auth_url || '').trim()
      if (authUrl) {
        const cache = (integration as any).token_cache as any
        if (isCacheValid(cache)) {
          token = String(cache.access_token || '')
        } else {
          const method = String((integration as any).auth_method || 'POST').toUpperCase()
          const bodyJson = (integration as any).auth_body_json && typeof (integration as any).auth_body_json === 'object' ? (integration as any).auth_body_json : {}

          let finalAuthUrl = authUrl
          const headers: Record<string, string> = {}
          let requestBody: string | undefined

          if (method === 'GET') {
            const u = new URL(authUrl)
            for (const [k, v] of Object.entries(bodyJson)) u.searchParams.set(k, String(v ?? ''))
            finalAuthUrl = u.toString()
          } else {
            headers['Content-Type'] = 'application/json'
            requestBody = JSON.stringify(bodyJson)
          }

          const authRes = await fetch(finalAuthUrl, { method: method === 'GET' ? 'GET' : 'POST', headers, body: requestBody })
          const authJson = await safeJsonParse(authRes)

          const tokenPath = String((integration as any).auth_token_path || '').trim()
          const extracted =
            (tokenPath ? getPathValue(authJson, tokenPath) : undefined) ??
            (authJson?.token ?? authJson?.access_token ?? authJson?.data?.token)

          if (!extracted || typeof extracted !== 'string') {
            return new Response(JSON.stringify({ error: true, message: 'Token não encontrado' }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }

          token = extracted

          const ttlSeconds = (integration as any).token_expiration_seconds ? Number((integration as any).token_expiration_seconds) : 0
          const expiresAt = ttlSeconds > 0 ? new Date(Date.now() + ttlSeconds * 1000).toISOString() : new Date(Date.now() + 55 * 60 * 1000).toISOString()

          await supabase
            .from('api_integrations')
            .update({ token_cache: { access_token: token, expires_at: expiresAt } as any, token_expires_at: expiresAt })
            .eq('id', integration.id)
        }
      }

      const requestUrl = buildUrl((integration as any).base_url, (integration as any).request_url)
      if (!requestUrl) {
        return new Response(JSON.stringify({ error: true, message: 'request_url não configurada' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const requestMethod = String((integration as any).request_method || 'GET').toUpperCase()
      const context = { token, barcode, store }

      const headersJson = (integration as any).request_headers_json && typeof (integration as any).request_headers_json === 'object' ? (integration as any).request_headers_json : {}
      const interpolatedHeaders = interpolateJson(headersJson, context)
      const reqHeaders: Record<string, string> = {}
      for (const [k, v] of Object.entries(interpolatedHeaders || {})) {
        const name = String(k).trim()
        if (!name) continue
        reqHeaders[name] = String(v ?? '')
      }

      const paramsJson = (integration as any).request_params_json && typeof (integration as any).request_params_json === 'object' ? (integration as any).request_params_json : {}
      let params: any = interpolateJson(paramsJson, context)
      if (!params || typeof params !== 'object' || Array.isArray(params)) params = {}

      const barcodeName = String((integration as any).barcode_param_name || '').trim()
      const storeName = String((integration as any).store_param_name || '').trim()
      if (barcodeName && params[barcodeName] == null) params[barcodeName] = barcode
      if (storeName && params[storeName] == null) params[storeName] = store

      let finalUrl = requestUrl
      let requestBody: string | undefined

      if (requestMethod === 'GET') {
        const u = new URL(requestUrl)
        for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v ?? ''))
        finalUrl = u.toString()
      } else {
        if (!reqHeaders['Content-Type']) reqHeaders['Content-Type'] = 'application/json'
        requestBody = JSON.stringify(params)
      }

      try {
        const res = await fetch(finalUrl, { method: requestMethod === 'POST' ? 'POST' : 'GET', headers: reqHeaders, body: requestBody })
        const raw = await safeJsonParse(res)
        const mapped = toStandardResponse(raw, (integration as any).response_mapping_json, barcode, store)

        return new Response(JSON.stringify(mapped), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } catch (e: any) {
        return new Response(JSON.stringify({ error: true, message: e?.message || 'Product not found' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // ─── GET /device-api/content?device_code=XXXXX ───
    // Rota pública: retorna toda a programação do dispositivo pelo device_code
    if (path === 'content' && req.method === 'GET') {
      const deviceCode = url.searchParams.get('device_code') || ''
      if (!deviceCode) {
        return new Response(
          JSON.stringify({ error: 'device_code é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      // 1. Busca device info via RPC (SECURITY DEFINER)
      const { data: deviceRows, error: deviceError } = await supabase.rpc('get_public_device_info', {
        p_device_code: deviceCode,
      })

      if (deviceError) throw deviceError

      const device = Array.isArray(deviceRows) ? deviceRows[0] : deviceRows
      if (!device) {
        return new Response(
          JSON.stringify({ error: `Dispositivo "${deviceCode}" não encontrado` }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      // 2. Override media
      let overrideMedia: any = null
      const overrideData: any = device.override_media_data
      if (overrideData && device.override_media_expires_at) {
        const expiresAt = new Date(device.override_media_expires_at as string)
        if (expiresAt > new Date()) {
          overrideMedia = {
            id: overrideData.id,
            name: overrideData.name,
            type: overrideData.type,
            file_url: overrideData.file_url,
            duration: overrideData.duration ?? 10,
            expires_at: device.override_media_expires_at,
          }
        }
      }

      // 3. Busca playlist IDs e channel IDs vinculados ao dispositivo
      const relevantPlaylistIds: string[] = []
      let relevantChannelIds: string[] = []

      if (device.current_playlist_id) {
        relevantPlaylistIds.push(device.current_playlist_id)
      }

      const { data: groupMembers } = await supabase
        .from('device_group_members')
        .select('group_id')
        .eq('device_id', device.id)

      if (groupMembers && groupMembers.length > 0) {
        const groupIds = groupMembers.map((g: any) => g.group_id)
        const { data: groupChannels } = await supabase
          .from('device_group_channels')
          .select('distribution_channel_id')
          .in('group_id', groupIds)

        if (groupChannels) {
          relevantChannelIds = groupChannels.map((c: any) => c.distribution_channel_id)
        }
      }

      // 4. Busca playlists completas via RPC
      let playlistsData: any[] = []
      if (relevantPlaylistIds.length > 0 || relevantChannelIds.length > 0) {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_public_playlists_data', {
          p_playlist_ids: relevantPlaylistIds.length > 0 ? relevantPlaylistIds : null,
          p_channel_ids: relevantChannelIds.length > 0 ? relevantChannelIds : null,
        })
        if (!rpcError && rpcData) {
          playlistsData = Array.isArray(rpcData) ? rpcData : []
        }
      }

      // 5. Formata response
      const mapItem = (item: any) => ({
        id: item.id,
        media_id: item.media_id,
        position: item.position,
        duration_override: item.duration_override,
        start_date: item.start_date ?? null,
        end_date: item.end_date ?? null,
        start_time: item.start_time ?? null,
        end_time: item.end_time ?? null,
        days_of_week: item.days_of_week ?? null,
        media: item.media ? {
          id: item.media.id,
          name: item.media.name,
          type: item.media.type,
          file_url: item.media.file_url,
          duration: item.media.duration ?? 10,
          metadata: item.media.metadata ?? null,
        } : null,
      })

      const playlists = playlistsData.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description ?? null,
        is_active: p.is_active,
        has_channels: p.has_channels ?? false,
        start_date: p.start_date ?? null,
        end_date: p.end_date ?? null,
        days_of_week: p.days_of_week ?? null,
        start_time: p.start_time ?? null,
        end_time: p.end_time ?? null,
        priority: p.priority ?? 0,
        content_scale: p.content_scale ?? null,
        items: (p.playlist_items || []).map(mapItem),
        channels: (p.playlist_channels || []).map((ch: any) => ({
          id: ch.id,
          name: ch.name,
          is_active: ch.is_active,
          is_fallback: ch.is_fallback ?? false,
          position: ch.position,
          start_date: ch.start_date ?? null,
          end_date: ch.end_date ?? null,
          start_time: ch.start_time,
          end_time: ch.end_time,
          days_of_week: ch.days_of_week ?? null,
          items: (ch.playlist_channel_items || []).map(mapItem),
        })),
      }))

      const response = {
        version: 1,
        generated_at: new Date().toISOString(),
        device: {
          id: device.id,
          device_code: deviceCode,
          name: device.name,
          store_id: device.store_id,
          company_id: device.company_id,
          company_slug: device.company_slug ?? null,
          store_code: device.store_code ?? null,
          camera_enabled: device.camera_enabled ?? false,
          is_blocked: device.is_blocked ?? false,
          blocked_message: device.blocked_message ?? null,
          last_sync_requested_at: device.last_sync_requested_at ?? null,
        },
        override_media: overrideMedia,
        playlists,
      }

      // Heartbeat automático
      const savedToken = url.searchParams.get('token')
      if (savedToken) {
        Promise.resolve(supabase.rpc('device_heartbeat', {
          p_device_token: savedToken,
          p_status: 'online',
          p_current_playlist_id: device.current_playlist_id || null,
        })).then(() => {}).catch(() => {})
      }

      return new Response(
        JSON.stringify(response),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 1. Validate Company
    if (path === 'validate-company' && req.method === 'POST') {
      const { cod_user } = await req.json()
      
      const { data: company, error } = await supabase
        .from('companies')
        .select('id, name')
        .eq('code', cod_user)
        .eq('is_active', true)
        .single()

      if (error || !company) {
        return new Response(
          JSON.stringify({ error: 'Empresa não encontrada ou inativa' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ company_id: company.id, company_name: company.name }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1b. List Stores
    if (path === 'stores' && req.method === 'GET') {
        const company_id = url.searchParams.get('company_id')
        if (!company_id) throw new Error('company_id required')

        // Assuming company_id links to tenant_id or direct relationship. 
        // Need to check schema. Often stores have tenant_id. 
        // Let's assume we filter by tenant_id of the company if that's the link, 
        // OR we need to find the company first. 
        // Based on previous code: fetchStores used tenant_id.
        // Let's get the company's tenant_id first.
        const { data: company } = await supabase.from('companies').select('tenant_id').eq('id', company_id).single()
        
        const { data: stores, error } = await supabase
            .from('stores')
            .select('id, name, code')
            .eq('tenant_id', company?.tenant_id) // Or use company_id if column exists
            .eq('is_active', true)
            .order('name')
        
        if (error) throw error
        return new Response(JSON.stringify(stores), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 1c. List Groups
    if (path === 'groups' && req.method === 'GET') {
        const store_id = url.searchParams.get('store_id')
        if (!store_id) throw new Error('store_id required')

        const { data: groups, error } = await supabase
            .from('device_groups')
            .select('id, name, type:screen_type') // Mapping screen_type to type
            .or(`store_id.eq.${store_id},store_id.is.null`)
            .order('name')

        if (error) throw error
        return new Response(JSON.stringify(groups), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 2. Register Device
    if (path === 'register' && req.method === 'POST') {
      const { company_id, store_id, group_id, device_serial, device_name } = await req.json()

      // A. Get Region via Store -> City -> State -> Region
      // Note: This assumes the full chain exists. If simplified schema used, might be direct.
      // Based on types.ts: stores -> cities -> states -> regions
      const { data: storeData } = await supabase
        .from('stores')
        .select(`
          city:cities (
            state:states (
              region_id
            )
          )
        `)
        .eq('id', store_id)
        .single()

      // Safe navigation for region_id
      const cityData = storeData?.city as any
      const region_id = cityData?.state?.region_id || null

      // B. Get Channel via Group
      const { data: groupData } = await supabase
        .from('device_groups')
        .select('channel_id')
        .eq('id', group_id)
        .single()
      
      const channel_id = groupData?.channel_id || null

      // C. Generate Token
      const device_token = crypto.randomUUID()
      const device_code = device_serial || crypto.randomUUID().substring(0, 8).toUpperCase()

      // D. Create/Update Device
      // Check if device exists by serial/code
      const { data: existing } = await supabase
        .from('devices')
        .select('id')
        .eq('device_code', device_code)
        .single()

      let deviceResult
      if (existing) {
        // Update
        deviceResult = await supabase
          .from('devices')
          .update({
            company_id,
            store_id,
            group_id,
            channel_id,
            region_id,
            device_token,
            status: 'active', // Auto-activate for now as per flow "Inicia sincronização"
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single()
      } else {
        // Insert
        deviceResult = await supabase
          .from('devices')
          .insert({
            device_code,
            name: device_name || `Device ${device_code}`,
            company_id,
            store_id,
            group_id,
            channel_id,
            region_id,
            device_token,
            status: 'active',
            camera_enabled: false,
            is_active: true
          })
          .select()
          .single()
      }

      if (deviceResult.error) throw deviceResult.error

      // Add to group members if not already
      if (group_id) {
          await supabase.from('device_group_members').upsert({
              device_id: deviceResult.data.id,
              group_id: group_id
          }, { onConflict: 'device_id,group_id' })
      }

      return new Response(
        JSON.stringify({
          device_token,
          channel_version: 1, // Placeholder
          sync_interval: 300
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Get Config (Protected)
    if (path === 'config' && req.method === 'GET') {
        const authHeader = req.headers.get('Authorization')
        const token = authHeader?.replace('Bearer ', '')
        
        if (!token) {
             return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
        }

        const { data: device, error } = await supabase
            .from('devices')
            .select('*, channel:distribution_channels(*)')
            .eq('device_token', token)
            .single()

        if (error || !device) {
             return new Response(JSON.stringify({ error: 'Device not found' }), { status: 401, headers: corsHeaders })
        }

        // Fetch Playlists for this channel
        // Logic: Device -> Channel -> Playlists (via playlist_channels?)
        // Assuming relationship: playlist_channels (channel_id, playlist_id)
        // Or using existing logic from memory: "Buscar playlists vinculadas ao channel"
        let playlists: unknown[] = []
        if (device.channel_id) {
            const { data: plData } = await supabase
                .from('playlist_channels')
                .select(`
                    position,
                    playlist:playlists (*)
                `)
                .eq('channel_id', device.channel_id)
                .order('position')
            
            playlists = (plData ?? []).map((p: { playlist: unknown }) => p.playlist)
        }

        return new Response(
            JSON.stringify({
                channel: device.channel,
                playlists,
                rules: device.channel?.rules || {},
                version: device.channel?.version || 1
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // 4. Manifest: retorna toda a programação do dispositivo em um único payload
    if (path === 'manifest' && req.method === 'GET') {
      const authHeader = req.headers.get('Authorization')
      const token = authHeader?.replace('Bearer ', '')

      if (!token) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      // Busca device pelo token
      const { data: device, error: deviceError } = await supabase
        .from('devices')
        .select(`
          id, device_code, name, store_id, company_id, current_playlist_id,
          is_blocked, blocked_message, camera_enabled,
          override_media_id, override_media_expires_at,
          last_sync_requested_at, store_code,
          companies(id, slug),
          override_media:media_items!devices_override_media_id_fkey(id, name, type, file_url, duration, metadata)
        `)
        .eq('device_token', token)
        .maybeSingle()

      if (deviceError || !device) {
        return new Response(
          JSON.stringify({ error: 'Device not found' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      // Override media (mídia avulsa/promocional)
      let overrideMedia: any = null
      const overrideMediaData: any = device.override_media

      if (overrideMediaData && device.override_media_expires_at) {
        const expiresAt = new Date(device.override_media_expires_at as string)
        if (expiresAt > new Date()) {
          overrideMedia = {
            id: overrideMediaData.id,
            name: overrideMediaData.name,
            type: overrideMediaData.type,
            file_url: overrideMediaData.file_url,
            duration: overrideMediaData.duration ?? 10,
            expires_at: device.override_media_expires_at,
            metadata: overrideMediaData.metadata || null,
          }
        }
      }

      // Playlists relevantes (diretas + canais/grupos)
      let relevantPlaylistIds: string[] = []
      let relevantChannelIds: string[] = []

      if (device.current_playlist_id) {
        relevantPlaylistIds.push(device.current_playlist_id)
      }

      const { data: groupMembers, error: groupError } = await supabase
        .from('device_group_members')
        .select('group_id')
        .eq('device_id', device.id)

      if (groupError) throw groupError

      if (groupMembers && groupMembers.length > 0) {
        const groupIds = groupMembers.map((g: any) => g.group_id)
        const { data: groupChannels, error: channelsError } = await supabase
          .from('device_group_channels')
          .select('distribution_channel_id')
          .in('group_id', groupIds)

        if (channelsError) throw channelsError

        if (groupChannels) {
          relevantChannelIds = groupChannels.map((c: any) => c.distribution_channel_id)
        }
      }

      // Busca playlists + itens + mídias via RPC (bypass RLS) ou fallback select
      let playlistsData: any[] = []

      if (relevantPlaylistIds.length > 0 || relevantChannelIds.length > 0) {
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          'get_public_playlists_data',
          {
            p_playlist_ids: relevantPlaylistIds.length > 0 ? relevantPlaylistIds : null,
            p_channel_ids: relevantChannelIds.length > 0 ? relevantChannelIds : null,
          },
        )

        if (!rpcError) {
          playlistsData = Array.isArray(rpcData) ? (rpcData as any[]) : []
        } else {
          const orConditions: string[] = []

          if (relevantPlaylistIds.length > 0) {
            orConditions.push(`id.in.(${relevantPlaylistIds.join(',')})`)
          }

          if (relevantChannelIds.length > 0) {
            orConditions.push(`channel_id.in.(${relevantChannelIds.join(',')})`)
          }

          if (orConditions.length > 0) {
            const { data, error: playlistError } = await supabase
              .from('playlists')
              .select(`
                id, name, description, is_active, has_channels, channel_id,
                start_date, end_date, days_of_week, start_time, end_time, priority, content_scale,
                playlist_items(
                  id, media_id, position, duration_override,
                  start_date, end_date, start_time, end_time, days_of_week,
                  media:media_items(id, name, type, file_url, duration, metadata)
                ),
                playlist_channels(
                  id, name, is_active, is_fallback, position,
                  start_date, end_date, start_time, end_time, days_of_week,
                  playlist_channel_items(
                    id, media_id, position, duration_override,
                    start_date, end_date, start_time, end_time, days_of_week,
                    media:media_items(id, name, type, file_url, duration, metadata)
                  )
                )
              `)
              .eq('is_active', true)
              .or(orConditions.join(','))

            if (playlistError) throw playlistError
            playlistsData = data || []
          }
        }
      }

      // Monta manifest enxuto (sem download de arquivos)
      const playlists = playlistsData.map((playlist: any) => {
        const items =
          (playlist.playlist_items || []).map((item: any) => ({
            id: item.id,
            media_id: item.media_id,
            position: item.position,
            duration_override: item.duration_override,
            start_date: item.start_date,
            end_date: item.end_date,
            start_time: item.start_time,
            end_time: item.end_time,
            days_of_week: item.days_of_week,
            media: item.media
              ? {
                  id: item.media.id,
                  name: item.media.name,
                  type: item.media.type,
                  file_url: item.media.file_url,
                  duration: item.media.duration,
                  metadata: item.media.metadata || null,
                }
              : null,
          })) || []

        const channels =
          (playlist.playlist_channels || []).map((channel: any) => {
            const channelItems =
              (channel.playlist_channel_items || []).map((item: any) => ({
                id: item.id,
                media_id: item.media_id,
                position: item.position,
                duration_override: item.duration_override,
                start_date: item.start_date,
                end_date: item.end_date,
                start_time: item.start_time,
                end_time: item.end_time,
                days_of_week: item.days_of_week,
                media: item.media
                  ? {
                      id: item.media.id,
                      name: item.media.name,
                      type: item.media.type,
                      file_url: item.media.file_url,
                      duration: item.media.duration,
                      metadata: item.media.metadata || null,
                    }
                  : null,
              })) || []

            return {
              id: channel.id,
              name: channel.name,
              is_active: channel.is_active,
              is_fallback: channel.is_fallback,
              position: channel.position,
              start_date: channel.start_date,
              end_date: channel.end_date,
              start_time: channel.start_time,
              end_time: channel.end_time,
              days_of_week: channel.days_of_week,
              items: channelItems,
            }
          }) || []

        return {
          id: playlist.id,
          name: playlist.name,
          description: playlist.description,
          is_active: playlist.is_active,
          has_channels: playlist.has_channels,
          channel_id: playlist.channel_id,
          start_date: playlist.start_date,
          end_date: playlist.end_date,
          days_of_week: playlist.days_of_week,
          start_time: playlist.start_time,
          end_time: playlist.end_time,
          priority: playlist.priority,
          content_scale: playlist.content_scale,
          items,
          channels,
        }
      })

      const manifest = {
        version: 1,
        generated_at: new Date().toISOString(),
        device: {
          id: device.id,
          device_code: device.device_code,
          name: device.name,
          store_id: device.store_id,
          company_id: device.company_id,
          company_slug: Array.isArray(device.companies) ? device.companies[0]?.slug ?? null : (device.companies as any)?.slug ?? null,
          store_code: device.store_code,
          camera_enabled: device.camera_enabled ?? false,
          is_blocked: device.is_blocked ?? false,
          blocked_message: device.blocked_message,
          last_sync_requested_at: device.last_sync_requested_at,
        },
        override_media: overrideMedia,
        playlists,
      }

      return new Response(
        JSON.stringify(manifest),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 5. Heartbeat
    if (path === 'heartbeat' && req.method === 'POST') {
        const authHeader = req.headers.get('Authorization')
        const token = authHeader?.replace('Bearer ', '')

        if (!token) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

        const { error } = await supabase
            .from('devices')
            .update({ 
                last_seen_at: new Date().toISOString(),
                status: 'online'
            })
            .eq('device_token', token)

        if (error) throw error

        return new Response(
            JSON.stringify({ success: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // 6. Proof of Play
    if (path === 'proof' && req.method === 'POST') {
        const authHeader = req.headers.get('Authorization')
        const token = authHeader?.replace('Bearer ', '')

        if (!token) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
        
        // Get device_id from token
        const { data: device } = await supabase.from('devices').select('id').eq('device_token', token).single()
        if (!device) return new Response(JSON.stringify({ error: 'Device not found' }), { status: 401, headers: corsHeaders })

        const { media_id, played_at, duration } = await req.json()

        // Insert into analytics/logs table
         const { error } = await supabase.from('media_play_logs').insert({
             device_id: device.id,
             media_id: media_id || null, // handle null if passed
             played_at: played_at || new Date().toISOString(),
             duration: duration || 0
         })

         if (error) {
            console.error('Proof of play error:', error)
            // Don't fail the request if log fails? Or return error?
            // Usually logging is best effort.
         }

         return new Response(
            JSON.stringify({ success: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    return new Response(
      JSON.stringify({ error: 'Not Found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
