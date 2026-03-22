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
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const url = new URL(req.url)
    const path = url.pathname.split('/').pop()

    // ─── GET /campaign-engine/playlist?device_code=XXX ───
    // Generates dynamic playlist based on active campaigns + targeting
    if (path === 'playlist' && req.method === 'GET') {
      const deviceCode = url.searchParams.get('device_code') || ''
      if (!deviceCode) {
        return new Response(
          JSON.stringify({ error: 'device_code é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // 1. Get device with full hierarchy context
      const { data: deviceData, error: deviceError } = await supabase
        .from('devices')
        .select(`
          id, device_code, name, store_id, company_id, 
          sector_id, zone_id, device_type_id,
          stores!devices_store_id_fkey(id, city_id, tenant_id, cities!stores_city_id_fkey(id, state_id, states!cities_state_id_fkey(id, region_id)))
        `)
        .eq('device_code', deviceCode)
        .eq('is_active', true)
        .maybeSingle()

      if (deviceError || !deviceData) {
        return new Response(
          JSON.stringify({ error: 'Dispositivo não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const device = deviceData as any
      const store = device.stores
      const city = store?.cities
      const state = city?.states
      const tenantId = store?.tenant_id

      // 2. Get device tags
      const { data: deviceTags } = await supabase
        .from('device_tags')
        .select('tag_id')
        .eq('device_id', device.id)

      const deviceTagIds = (deviceTags || []).map((t: any) => t.tag_id)

      // Get store tags too
      if (device.store_id) {
        const { data: storeTags } = await supabase
          .from('store_tags')
          .select('tag_id')
          .eq('store_id', device.store_id)
        const storeTagIds = (storeTags || []).map((t: any) => t.tag_id)
        deviceTagIds.push(...storeTagIds)
      }

      const uniqueTagIds = [...new Set(deviceTagIds)]

      // 3. Get all active campaigns for this tenant
      const now = new Date()
      const today = now.toISOString().split('T')[0]
      const currentTime = now.toTimeString().slice(0, 5)
      const dayOfWeek = now.getDay() // 0=Sun, 1=Mon...

      let campaignQuery = supabase
        .from('campaigns')
        .select(`
          id, name, campaign_type, priority, weight, status,
          start_date, end_date, start_time, end_time, days_of_week,
          advertiser_id, max_impressions, current_impressions,
          campaign_contents(
            id, media_id, position, duration_override, weight, is_active,
            media:media_items(id, name, type, file_url, duration, metadata)
          ),
          campaign_targets(
            id, target_type, company_id, state_id, region_id, city_id,
            store_id, sector_id, zone_id, device_type_id, device_id, tag_id, include
          )
        `)
        .eq('is_active', true)
        .eq('status', 'active')

      if (tenantId) {
        campaignQuery = campaignQuery.eq('tenant_id', tenantId)
      }

      const { data: campaigns, error: campaignsError } = await campaignQuery
        .order('priority', { ascending: false })

      if (campaignsError) throw campaignsError

      // 4. Filter campaigns by date, time, day of week
      const filteredCampaigns = (campaigns || []).filter((c: any) => {
        // Date filter
        if (c.start_date && today < c.start_date) return false
        if (c.end_date && today > c.end_date) return false

        // Time filter
        if (c.start_time && currentTime < c.start_time) return false
        if (c.end_time && currentTime > c.end_time) return false

        // Day of week filter
        if (c.days_of_week && c.days_of_week.length > 0) {
          if (!c.days_of_week.includes(dayOfWeek)) return false
        }

        // Max impressions check
        if (c.max_impressions && c.current_impressions >= c.max_impressions) return false

        return true
      })

      // 5. Filter by targeting
      const targetedCampaigns = filteredCampaigns.filter((c: any) => {
        const targets = c.campaign_targets || []
        if (targets.length === 0) return true // No targets = all devices

        const includeTargets = targets.filter((t: any) => t.include !== false)
        const excludeTargets = targets.filter((t: any) => t.include === false)

        // Check excludes first
        for (const t of excludeTargets) {
          if (matchesTarget(t, device, store, city, state, uniqueTagIds)) return false
        }

        // If no include targets, pass
        if (includeTargets.length === 0) return true

        // Must match at least one include target
        return includeTargets.some((t: any) =>
          matchesTarget(t, device, store, city, state, uniqueTagIds)
        )
      })

      // 6. Sort by priority, then weight
      targetedCampaigns.sort((a: any, b: any) => {
        if (b.priority !== a.priority) return b.priority - a.priority
        return b.weight - a.weight
      })

      // 7. Build playlist from campaign contents
      const playlistItems: any[] = []
      let position = 0

      for (const campaign of targetedCampaigns) {
        const contents = (campaign.campaign_contents || [])
          .filter((c: any) => c.is_active && c.media)
          .sort((a: any, b: any) => a.position - b.position)

        for (const content of contents) {
          playlistItems.push({
            id: content.id,
            campaign_id: campaign.id,
            campaign_name: campaign.name,
            campaign_type: campaign.campaign_type,
            advertiser_id: campaign.advertiser_id,
            priority: campaign.priority,
            weight: content.weight || campaign.weight || 1,
            position: position++,
            media: {
              id: content.media.id,
              name: content.media.name,
              type: content.media.type,
              file_url: content.media.file_url,
              duration: content.duration_override || content.media.duration || 10,
              metadata: content.media.metadata || null,
            },
          })
        }
      }

      // 8. Apply weighted shuffle within same priority
      const finalPlaylist = applyWeightedOrder(playlistItems)

      return new Response(
        JSON.stringify({
          version: 2,
          generated_at: new Date().toISOString(),
          device_code: deviceCode,
          device_id: device.id,
          total_campaigns: targetedCampaigns.length,
          total_items: finalPlaylist.length,
          items: finalPlaylist,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Route not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function matchesTarget(
  target: any,
  device: any,
  store: any,
  city: any,
  state: any,
  tagIds: string[]
): boolean {
  // Direct device match
  if (target.device_id && target.device_id === device.id) return true

  // Device type match
  if (target.device_type_id && target.device_type_id === device.device_type_id) return true

  // Zone match
  if (target.zone_id && target.zone_id === device.zone_id) return true

  // Sector match
  if (target.sector_id && target.sector_id === device.sector_id) return true

  // Store match
  if (target.store_id && target.store_id === device.store_id) return true

  // City match
  if (target.city_id && city && target.city_id === city.id) return true

  // Region match
  if (target.region_id && state && target.region_id === state.region_id) return true

  // State match
  if (target.state_id && state && target.state_id === state.id) return true

  // Company match
  if (target.company_id && target.company_id === device.company_id) return true

  // Tag match
  if (target.tag_id && tagIds.includes(target.tag_id)) return true

  return false
}

function applyWeightedOrder(items: any[]): any[] {
  // Group by priority
  const groups = new Map<number, any[]>()
  for (const item of items) {
    const p = item.priority || 0
    if (!groups.has(p)) groups.set(p, [])
    groups.get(p)!.push(item)
  }

  const result: any[] = []
  const sortedPriorities = [...groups.keys()].sort((a, b) => b - a)

  for (const priority of sortedPriorities) {
    const group = groups.get(priority)!
    // Weighted shuffle within same priority
    const shuffled = weightedShuffle(group)
    result.push(...shuffled)
  }

  return result.map((item, idx) => ({ ...item, position: idx }))
}

function weightedShuffle(items: any[]): any[] {
  const pool = [...items]
  const result: any[] = []

  while (pool.length > 0) {
    const totalWeight = pool.reduce((sum, item) => sum + (item.weight || 1), 0)
    let random = Math.random() * totalWeight
    let selectedIndex = 0

    for (let i = 0; i < pool.length; i++) {
      random -= (pool[i].weight || 1)
      if (random <= 0) {
        selectedIndex = i
        break
      }
    }

    result.push(pool.splice(selectedIndex, 1)[0])
  }

  return result
}
