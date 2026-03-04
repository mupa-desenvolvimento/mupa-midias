// deno-lint-ignore-file
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.87.1"

declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin",
}

type ModuleType =
  | "weather"
  | "news"
  | "quote"
  | "curiosity"
  | "birthday"
  | "nutrition"
  | "instagram"
  | "qr_campaign"

interface AutoContentSettingsRow {
  id: string
  tenant_id: string
  module_type: ModuleType
  enabled: boolean
  refresh_interval_minutes: number
  last_fetch_at: string | null
  weather_state?: string | null
  weather_city?: string | null
  weather_country?: string | null
}

interface AutoContentItemInsert {
  type: ModuleType
  category?: string | null
  title: string
  description?: string | null
  image_url?: string | null
  payload_json?: Record<string, unknown>
  source: "mock" | "api" | "upload" | "manual"
  status?: "active" | "inactive"
  expires_at?: string | null
}

interface SchedulerResult {
  tenantId: string
  processedModules: {
    moduleType: ModuleType
    generatedCount: number
  }[]
}

async function getSupabaseAdmin(): Promise<SupabaseClient> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function getAuthContext(req: Request): Promise<{
  adminClient: SupabaseClient
  userId: string
  tenantId: string
}> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) {
    throw new Response(
      JSON.stringify({ error: "Não autorizado" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser()

  if (authError || !user) {
    throw new Response(
      JSON.stringify({ error: "Token inválido" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }

  const adminClient = await getSupabaseAdmin()

  const { data: isTenantAdmin } = await adminClient.rpc("is_tenant_admin", {
    check_user_id: user.id,
  })

  if (!isTenantAdmin) {
    throw new Response(
      JSON.stringify({ error: "Permissão negada. Apenas admins podem gerenciar conteúdo automático." }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }

  const { data: tenantId } = await adminClient.rpc("get_user_tenant_id_strict", {
    check_user_id: user.id,
  })

  if (!tenantId) {
    throw new Response(
      JSON.stringify({ error: "Usuário não está vinculado a nenhum tenant." }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }

  return {
    adminClient,
    userId: user.id,
    tenantId,
  }
}

async function insertAutoContentItems(
  adminClient: SupabaseClient,
  tenantId: string,
  moduleType: ModuleType,
  items: AutoContentItemInsert[],
): Promise<number> {
  if (!items.length) return 0

  const enriched = items.map((item) => ({
    tenant_id: tenantId,
    type: moduleType,
    category: item.category ?? null,
    title: item.title,
    description: item.description ?? null,
    image_url: item.image_url ?? null,
    payload_json: item.payload_json ?? {},
    source: item.source,
    status: item.status ?? "active",
    expires_at: item.expires_at ?? null,
  }))

  const { error } = await adminClient.from("auto_content_items").insert(enriched)

  if (error) {
    console.error("[AutoContentEngine] Error inserting items:", error)
    throw new Error(error.message)
  }

  return enriched.length
}

function generateMockWeather(): AutoContentItemInsert[] {
  const now = new Date()
  const hour = now.getHours()

  const scenarios = [
    {
      category: "Hoje",
      title: "Clima agora: 26°C e ensolarado",
      description: "Sensação térmica de 28°C. Umidade em 60%.",
      payload: {
        temp: 26,
        feels_like: 28,
        condition: "sunny",
        location: "Loja Principal",
        humidity: 60,
      },
    },
    {
      category: "Hoje",
      title: "Possibilidade de chuva leve à tarde",
      description: "Leve queda de temperatura prevista para o fim do dia.",
      payload: {
        temp: 23,
        feels_like: 24,
        condition: "rain",
        rain_chance: 40,
        location: "Loja Principal",
      },
    },
  ]

  const scenario = scenarios[hour % scenarios.length]

  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString()

  return [
    {
      type: "weather",
      category: scenario.category,
      title: scenario.title,
      description: scenario.description,
      source: "mock",
      status: "active",
      payload_json: scenario.payload,
      expires_at: expiresAt,
    },
  ]
}

async function generateWeather(
  adminClient: SupabaseClient,
  setting: AutoContentSettingsRow,
): Promise<AutoContentItemInsert[] | null> {
  // 1. Try to fetch from weather_locations (New System)
  const { data: locations } = await adminClient
    .from("weather_locations")
    .select("*")
    .eq("tenant_id", setting.tenant_id)
    .eq("is_active", true)

  if (locations && locations.length > 0) {
    const items: AutoContentItemInsert[] = []
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString()

    for (const loc of locations) {
      // Skip if no temperature data (not updated yet)
      if (loc.current_temp === null || loc.current_temp === undefined) continue

      const temp = Math.round(Number(loc.current_temp))
      const desc = loc.weather_description || "Normal"
      const locationName = loc.city
      
      const title = `Agora em ${locationName}: ${temp}°C`
      
      const details: string[] = []
      if (loc.humidity) details.push(`Umidade: ${loc.humidity}%`)
      if (loc.wind_speed) details.push(`Vento: ${loc.wind_speed}km/h`)
      
      const fullDesc = `${desc.charAt(0).toUpperCase() + desc.slice(1)}. ${details.join(". ")}.`

      items.push({
        type: "weather",
        category: "Hoje",
        title,
        description: fullDesc,
        source: "api",
        status: "active",
        payload_json: {
          temp: loc.current_temp,
          condition: loc.weather_description,
          location: locationName,
          city: loc.city,
          state: loc.state,
          humidity: loc.humidity,
          wind_speed: loc.wind_speed,
          provider: "weather-proxy",
          raw: loc.raw_data
        },
        expires_at: expiresAt,
      })
    }
    
    if (items.length > 0) return items
  }

  // 2. Fallback to Legacy System (OpenWeather Direct)
  const apiKey = Deno.env.get("OPENWEATHER_API_KEY")

  if (!apiKey) {
    console.warn("[AutoContentEngine] OPENWEATHER_API_KEY not configured, using mock weather")
    return null
  }

  const city = setting.weather_city
  const state = setting.weather_state
  const country = setting.weather_country || "BR"

  if (!city) {
    // If no city configured and no locations found, return null (mock will be used by caller)
    return null
  }

  const queryParts = [city.trim()]
  if (state && state.trim().length > 0) {
    queryParts.push(state.trim())
  }
  if (country && country.trim().length > 0) {
    queryParts.push(country.trim())
  }

  const q = encodeURIComponent(queryParts.join(","))

  const url =
    `https://api.openweathermap.org/data/2.5/weather?q=${q}&appid=${apiKey}&units=metric&lang=pt_br`

  const response = await fetch(url)

  if (!response.ok) {
    const text = await response.text()
    console.error("[AutoContentEngine] OpenWeather error:", response.status, text)
    return null
  }

  const data = await response.json() as unknown as {
    name?: string
    main?: {
      temp?: number
      feels_like?: number
      humidity?: number
    }
    weather?: {
      main?: string
      description?: string
    }[]
  }

  const main = data?.main || {}
  const weatherInfo = Array.isArray(data?.weather) && data.weather.length > 0
    ? data.weather[0]
    : null

  const temp = typeof main.temp === "number" ? main.temp : null
  const feelsLike = typeof main.feels_like === "number" ? main.feels_like : null
  const humidity = typeof main.humidity === "number" ? main.humidity : null

  const condition = weatherInfo?.main || "Desconhecido"
  const description = weatherInfo?.description || "Condição não informada"

  const locationName = data?.name || city

  const now = new Date()
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString()

  const titleTemp = temp !== null ? `${Math.round(temp)}°C` : "Clima atualizado"

  const title = `Agora em ${locationName}: ${titleTemp}`

  const detailParts: string[] = []
  if (feelsLike !== null) {
    detailParts.push(`sensação de ${Math.round(feelsLike)}°C`)
  }
  if (humidity !== null) {
    detailParts.push(`umidade em ${humidity}%`)
  }

  const detailSuffix = detailParts.length > 0 ? `. ${detailParts.join(", ")}.` : "."

  const fullDescription = `${description.charAt(0).toUpperCase()}${description.slice(1)}${detailSuffix}`

  return [
    {
      type: "weather",
      category: "Hoje",
      title,
      description: fullDescription,
      source: "api",
      status: "active",
      payload_json: {
        temp,
        feels_like: feelsLike,
        humidity,
        condition,
        location: locationName,
        country,
        state,
        city,
        provider: "openweather",
        raw: data,
      },
      expires_at: expiresAt,
    },
  ]
}

function generateMockNews(): AutoContentItemInsert[] {
  const headlines = [
    {
      category: "Varejo",
      title: "Varejo físico e digital se integram para melhorar experiência do cliente",
      description: "Lojas adotam soluções omnichannel para reduzir filas e aumentar conversão.",
    },
    {
      category: "Tecnologia",
      title: "Inteligência artificial transforma gestão de ponto de venda",
      description: "Redes adotam análises em tempo real para otimizar mix de produtos.",
    },
    {
      category: "Mercado",
      title: "Consumidores valorizam experiências personalizadas em loja",
      description: "Pesquisa mostra aumento de 30% na satisfação com comunicação contextual.",
    },
  ]

  const now = new Date()
  const index = now.getMinutes() % headlines.length
  const h = headlines[index]

  return [
    {
      type: "news",
      category: h.category,
      title: h.title,
      description: h.description,
      source: "mock",
      status: "active",
      payload_json: {
        category: h.category,
        created_at: now.toISOString(),
      },
      expires_at: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(),
    },
  ]
}

function generateMockQuotes(): AutoContentItemInsert[] {
  const quotes = [
    {
      author: "Peter Drucker",
      text: "A melhor forma de prever o futuro é criá-lo.",
    },
    {
      author: "Steve Jobs",
      text: "Inovação é o que distingue um líder de um seguidor.",
    },
    {
      author: "Philip Kotler",
      text: "O melhor anúncio é um cliente satisfeito.",
    },
  ]

  const now = new Date()
  const index = now.getDay() % quotes.length
  const q = quotes[index]

  return [
    {
      type: "quote",
      category: "Motivacional",
      title: q.text,
      description: `— ${q.author}`,
      source: "mock",
      status: "active",
      payload_json: {
        author: q.author,
      },
    },
  ]
}

function generateMockCuriosities(): AutoContentItemInsert[] {
  const curiosities = [
    {
      title: "80% das decisões de compra acontecem dentro da loja",
      description: "Comunicação visual no PDV influencia diretamente a conversão.",
    },
    {
      title: "Vídeos em tela aumentam em até 70% a atenção do público",
      description: "Conteúdos dinâmicos se destacam em ambientes movimentados.",
    },
    {
      title: "Cores quentes estimulam decisões mais rápidas",
      description: "Paletas bem definidas podem aumentar a percepção de valor.",
    },
  ]

  const now = new Date()
  const index = now.getSeconds() % curiosities.length
  const c = curiosities[index]

  return [
    {
      type: "curiosity",
      category: "Varejo",
      title: c.title,
      description: c.description,
      source: "mock",
      status: "active",
      payload_json: {
        created_at: now.toISOString(),
      },
    },
  ]
}

function generateMockBirthdays(): AutoContentItemInsert[] {
  const today = new Date()
  const formattedDate = today.toLocaleDateString("pt-BR")

  const people = [
    { name: "Ana", store: "Loja Centro" },
    { name: "Bruno", store: "Loja Norte" },
    { name: "Carla", store: "Loja Sul" },
  ]

  return people.map((p) => ({
    type: "birthday",
    category: "Aniversariantes do dia",
    title: `Parabéns, ${p.name}!`,
    description: `${p.name} está comemorando hoje na ${p.store}.`,
    source: "mock",
    status: "active",
    payload_json: {
      name: p.name,
      store: p.store,
      date: formattedDate,
    },
    expires_at: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  }))
}

function generateMockNutritionTips(): AutoContentItemInsert[] {
  const tips = [
    {
      title: "Beba água ao longo do dia",
      description: "Manter-se hidratado melhora foco e disposição.",
    },
    {
      title: "Prefira alimentos naturais",
      description: "Reduza produtos ultraprocessados sempre que possível.",
    },
    {
      title: "Faça pequenas pausas para um lanche saudável",
      description: "Frutas e castanhas são boas aliadas da rotina.",
    },
  ]

  const now = new Date()
  const index = now.getMinutes() % tips.length
  const t = tips[index]

  return [
    {
      type: "nutrition",
      category: "Bem-estar",
      title: t.title,
      description: t.description,
      source: "mock",
      status: "active",
      payload_json: {
        created_at: now.toISOString(),
      },
    },
  ]
}

function generateMockInstagram(): AutoContentItemInsert[] {
  const posts = [
    {
      title: "Novidade na vitrine",
      description: "Confira a nova campanha de destaque nas lojas Mupa.",
    },
    {
      title: "Bastidores da operação",
      description: "Tecnologia e equipe conectadas para entregar mais resultado.",
    },
    {
      title: "Destaque da semana",
      description: "Produtos em evidência com comunicação dinâmica.",
    },
  ]

  const now = new Date()
  const index = now.getHours() % posts.length
  const p = posts[index]

  return [
    {
      type: "instagram",
      category: "Social",
      title: p.title,
      description: p.description,
      source: "mock",
      status: "active",
      payload_json: {
        username: "@mupa.app",
        published_at: now.toISOString(),
      },
    },
  ]
}

function generateMockQrCampaign(): AutoContentItemInsert[] {
  const campaigns = [
    {
      title: "Participe da nossa pesquisa relâmpago",
      description: "Aponte a câmera para o QR Code e responda em poucos segundos.",
      url: "https://mupa.app/qr/pesquisa",
    },
    {
      title: "Cadastre-se para receber novidades",
      description: "Descontos e novidades em primeira mão pelo QR Code na tela.",
      url: "https://mupa.app/qr/newsletter",
    },
    {
      title: "Conheça mais sobre a Mupa",
      description: "Use o QR Code para acessar o nosso site oficial.",
      url: "https://mupa.app",
    },
  ]

  const now = new Date()
  const index = now.getMinutes() % campaigns.length
  const c = campaigns[index]

  return [
    {
      type: "qr_campaign",
      category: "Campanha",
      title: c.title,
      description: c.description,
      source: "mock",
      status: "active",
      payload_json: {
        qr_url: c.url,
        created_at: now.toISOString(),
      },
    },
  ]
}

async function generateForModule(
  adminClient: SupabaseClient,
  tenantId: string,
  moduleType: ModuleType,
  setting?: AutoContentSettingsRow,
): Promise<number> {
  let items: AutoContentItemInsert[] = []

  switch (moduleType) {
    case "weather":
      if (setting) {
        const apiItems = await generateWeather(adminClient, setting)
        if (apiItems && apiItems.length > 0) {
          items = apiItems
          break
        }
      }
      items = generateMockWeather()
      break
    case "news":
      items = generateMockNews()
      break
    case "quote":
      items = generateMockQuotes()
      break
    case "curiosity":
      items = generateMockCuriosities()
      break
    case "birthday":
      items = generateMockBirthdays()
      break
    case "nutrition":
      items = generateMockNutritionTips()
      break
    case "instagram":
      items = generateMockInstagram()
      break
    case "qr_campaign":
      items = generateMockQrCampaign()
      break
    default:
      console.warn("[AutoContentEngine] Unsupported module type:", moduleType)
      return 0
  }

  return insertAutoContentItems(adminClient, tenantId, moduleType, items)
}

async function runTenantScheduler(
  adminClient: SupabaseClient,
  tenantId: string,
): Promise<SchedulerResult> {
  const now = new Date()

  const { data: settings, error } = await adminClient
    .from("auto_content_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("enabled", true)

  if (error) {
    console.error("[AutoContentEngine] Error loading settings:", error)
    throw new Error(error.message)
  }

  const typedSettings = (settings || []) as AutoContentSettingsRow[]
  const processedModules: SchedulerResult["processedModules"] = []

  for (const setting of typedSettings) {
    const lastFetch = setting.last_fetch_at ? new Date(setting.last_fetch_at) : null
    const intervalMs = setting.refresh_interval_minutes * 60 * 1000

    const shouldRun =
      !lastFetch ||
      now.getTime() - lastFetch.getTime() >= intervalMs

    if (!shouldRun) continue

    const count = await generateForModule(adminClient, tenantId, setting.module_type, setting)

    processedModules.push({
      moduleType: setting.module_type,
      generatedCount: count,
    })

    const { error: updateError } = await adminClient
      .from("auto_content_settings")
      .update({ last_fetch_at: now.toISOString() })
      .eq("id", setting.id)

    if (updateError) {
      console.error("[AutoContentEngine] Error updating last_fetch_at:", updateError)
    }
  }

  return {
    tenantId,
    processedModules,
  }
}

async function runGlobalScheduler(): Promise<SchedulerResult[]> {
  const adminClient = await getSupabaseAdmin()

  const { data: tenants, error } = await adminClient
    .from("tenants")
    .select("id")
    .eq("is_active", true)

  if (error) {
    console.error("[AutoContentEngine] Error loading tenants:", error)
    throw new Error(error.message)
  }

  const results: SchedulerResult[] = []

  for (const t of tenants || []) {
    results.push(await runTenantScheduler(adminClient, t.id as string))
  }

  return results
}

async function handleToggleModule(
  req: Request,
): Promise<Response> {
  const { adminClient, tenantId } = await getAuthContext(req)
  const body = await req.json()

  const moduleType = (body.module_type || body.type) as ModuleType | undefined
  const enabled = body.enabled as boolean | undefined
  const refreshInterval = body.refresh_interval_minutes as number | undefined
  const weatherState = body.weather_state as string | undefined
  const weatherCity = body.weather_city as string | undefined
  const weatherCountry = body.weather_country as string | undefined

  if (!moduleType || typeof enabled === "undefined") {
    return new Response(
      JSON.stringify({ error: "module_type e enabled são obrigatórios" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }

  const defaultInterval = moduleType === "weather" ? 60 : 30

  const { data, error } = await adminClient
    .from("auto_content_settings")
    .upsert(
      {
        tenant_id: tenantId,
        module_type: moduleType,
        enabled,
        refresh_interval_minutes: refreshInterval && refreshInterval > 0 ? refreshInterval : defaultInterval,
        weather_state: moduleType === "weather" ? weatherState ?? null : undefined,
        weather_city: moduleType === "weather" ? weatherCity ?? null : undefined,
        weather_country: moduleType === "weather" ? (weatherCountry || "BR") : undefined,
      },
      { onConflict: "tenant_id,module_type" },
    )
    .select()
    .single()

  if (error) {
    console.error("[AutoContentEngine] Error toggling module:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }

  return new Response(
    JSON.stringify({ setting: data }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  )
}

async function handleGenerateNow(req: Request): Promise<Response> {
  const { adminClient, tenantId } = await getAuthContext(req)
  const body = await req.json()

  const moduleType = (body.module_type || body.type) as ModuleType | undefined
  const weatherState = body.weather_state as string | undefined
  const weatherCity = body.weather_city as string | undefined
  const weatherCountry = body.weather_country as string | undefined

  if (!moduleType) {
    return new Response(
      JSON.stringify({ error: "module_type é obrigatório" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }

  let setting: AutoContentSettingsRow | undefined

  const { data: existingSetting } = await adminClient
    .from("auto_content_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("module_type", moduleType)
    .maybeSingle()

  if (existingSetting) {
    setting = existingSetting as AutoContentSettingsRow
  }

  const generatedCount = await generateForModule(adminClient, tenantId, moduleType, setting)

  const now = new Date().toISOString()

  const defaultInterval = moduleType === "weather" ? 60 : 30

  await adminClient
    .from("auto_content_settings")
    .upsert(
      {
        tenant_id: tenantId,
        module_type: moduleType,
        enabled: true,
        refresh_interval_minutes: body.refresh_interval_minutes && body.refresh_interval_minutes > 0
          ? body.refresh_interval_minutes
          : defaultInterval,
        last_fetch_at: now,
        weather_state: moduleType === "weather" ? weatherState ?? null : undefined,
        weather_city: moduleType === "weather" ? weatherCity ?? null : undefined,
        weather_country: moduleType === "weather" ? (weatherCountry || "BR") : undefined,
      },
      { onConflict: "tenant_id,module_type" },
    )

  return new Response(
    JSON.stringify({
      module_type: moduleType,
      generated: generatedCount,
      tenant_id: tenantId,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  )
}

async function handleUploadBirthdays(req: Request): Promise<Response> {
  const { adminClient, tenantId } = await getAuthContext(req)
  const body = await req.json()

  const csvContent = body.csv as string | undefined
  const fileName = (body.file_name as string | undefined) || "birthdays.csv"

  const fileUrl = csvContent
    ? `inline://${fileName}`
    : `mock://${fileName}`

  const { data: uploadRow, error } = await adminClient
    .from("birthday_uploads")
    .insert({
      tenant_id: tenantId,
      file_url: fileUrl,
      processed: !!csvContent,
    })
    .select()
    .single()

  if (error) {
    console.error("[AutoContentEngine] Error creating birthday_uploads row:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }

  const generatedCount = csvContent ? generateMockBirthdays().length : 0

  if (generatedCount > 0) {
    await insertAutoContentItems(adminClient, tenantId, "birthday", generateMockBirthdays())
  }

  return new Response(
    JSON.stringify({
      upload: uploadRow,
      generated: generatedCount,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  )
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const path = url.pathname.split("/").pop()

  try {
    if (req.method === "POST" && path === "run-scheduler") {
      const cronSecretHeader = req.headers.get("x-cron-secret")
      const cronSecretEnv = Deno.env.get("AUTO_CONTENT_CRON_SECRET")

      if (!cronSecretEnv || cronSecretHeader !== cronSecretEnv) {
        return new Response(
          JSON.stringify({ error: "Cron não autorizado" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        )
      }

      const results = await runGlobalScheduler()

      return new Response(
        JSON.stringify({ results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    if (req.method === "POST" && path === "toggle-module") {
      return await handleToggleModule(req)
    }

    if (req.method === "POST" && path === "generate") {
      return await handleGenerateNow(req)
    }

    if (req.method === "POST" && path === "upload-birthdays") {
      return await handleUploadBirthdays(req)
    }

    return new Response(
      JSON.stringify({ error: "Rota não encontrada" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (err) {
    if (err instanceof Response) {
      return err
    }

    console.error("[AutoContentEngine] Unexpected error:", err)

    return new Response(
      JSON.stringify({ error: "Erro interno ao processar Auto Content Engine" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})
