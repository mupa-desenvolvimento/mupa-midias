import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ParsedRow {
  codigo: string
  nome: string
  regional: string
  cnpj: string
  endereco: string
  bairro: string
  cep: string
  cidade: string
  estado: string
}

interface ImportRequest {
  rows: ParsedRow[]
  import_log_id: string
}

const BATCH_SIZE = 50

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify user token
    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = userData.user.id

    // Check if user is tenant admin or super admin
    const { data: isTenantAdmin } = await supabase.rpc('is_tenant_admin', { check_user_id: userId })
    
    if (!isTenantAdmin) {
      return new Response(
        JSON.stringify({ error: 'Permissão negada. Apenas administradores do tenant podem importar lojas.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user's tenant_id
    const { data: tenantId } = await supabase.rpc('get_user_tenant_id_strict', { check_user_id: userId })
    
    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'Usuário não está vinculado a nenhum tenant.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`User ${userId} importing stores for tenant ${tenantId}`)

    const { rows, import_log_id }: ImportRequest = await req.json()

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhum dado para importar' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Starting import of ${rows.length} stores for log ${import_log_id}`)

    // Update import log to processing
    await supabase
      .from('import_logs')
      .update({ 
        status: 'processing',
        total_rows: rows.length 
      })
      .eq('id', import_log_id)

    // Get or create Brazil country for this tenant
    let { data: country } = await supabase
      .from('countries')
      .select('id')
      .eq('code', 'BR')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!country) {
      // Try to insert - constraint countries_code_tenant_unique will handle duplicates
      const { data: newCountry, error: countryError } = await supabase
        .from('countries')
        .insert({ code: 'BR', name: 'Brasil', tenant_id: tenantId })
        .select('id')
        .single()
      
      if (countryError) {
        // If duplicate key error, fetch the existing record
        if (countryError.code === '23505') {
          const { data: existingCountry } = await supabase
            .from('countries')
            .select('id')
            .eq('code', 'BR')
            .eq('tenant_id', tenantId)
            .single()
          
          if (existingCountry) {
            country = existingCountry
          } else {
            console.error('Error fetching existing country:', countryError)
            await updateImportLogError(supabase, import_log_id, 'Erro ao buscar país Brasil')
            return new Response(
              JSON.stringify({ error: 'Erro ao buscar país Brasil' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        } else {
          console.error('Error creating country:', countryError)
          await updateImportLogError(supabase, import_log_id, 'Erro ao criar país Brasil')
          return new Response(
            JSON.stringify({ error: 'Erro ao criar país Brasil' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      } else {
        country = newCountry
      }
    }

    // Cache for created entities
    const createdRegions: Record<string, { id: string }> = {}
    const createdStates: Record<string, { id: string }> = {}
    const createdCities: Record<string, { id: string }> = {}

    // Fetch existing data for this tenant
    const { data: existingRegions } = await supabase
      .from('regions')
      .select('id, name, code')
      .eq('tenant_id', tenantId)
    
    const { data: existingStates } = await supabase
      .from('states')
      .select('id, name, code, region_id')
      .eq('tenant_id', tenantId)
    
    const { data: existingCities } = await supabase
      .from('cities')
      .select('id, name, state_id')
      .eq('tenant_id', tenantId)
    
    const { data: existingStores } = await supabase
      .from('stores')
      .select('code')
      .eq('tenant_id', tenantId)

    const existingStoreCodes = new Set(
      existingStores?.map((s: { code: string }) => s.code.toLowerCase()) || []
    )

    let successCount = 0
    let errorCount = 0
    const errors: string[] = []

    // Process in batches
    const totalBatches = Math.ceil(rows.length / BATCH_SIZE)
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStart = batchIndex * BATCH_SIZE
      const batchEnd = Math.min(batchStart + BATCH_SIZE, rows.length)
      const batch = rows.slice(batchStart, batchEnd)
      
      console.log(`Processing batch ${batchIndex + 1}/${totalBatches} (rows ${batchStart + 1}-${batchEnd})`)

      for (let i = 0; i < batch.length; i++) {
        const row = batch[i]
        const rowNumber = batchStart + i + 2 // +2 for header and 0-index

        try {
          // Skip if code already exists
          if (existingStoreCodes.has(row.codigo.toLowerCase())) {
            errors.push(`Linha ${rowNumber}: Código "${row.codigo}" já existe`)
            errorCount++
            continue
          }

          // Normalize state code
          const stateCode = row.estado.toUpperCase().trim().substring(0, 2)
          const stateName = row.estado.length > 2 ? row.estado : stateCode
          const regionName = `Região ${stateCode}`
          const regionKey = regionName.toLowerCase()

          // Find or create region
          let region = existingRegions?.find(r => r.name.toLowerCase() === regionKey) || createdRegions[regionKey]
          
          if (!region) {
            const { data: newRegion, error: regionError } = await supabase
              .from('regions')
              .insert({ 
                country_id: country.id, 
                name: regionName, 
                code: stateCode,
                tenant_id: tenantId 
              })
              .select('id')
              .single()
            
            if (regionError) {
              errors.push(`Linha ${rowNumber}: Erro ao criar região "${regionName}"`)
              errorCount++
              continue
            }
            region = newRegion
            createdRegions[regionKey] = newRegion
          }

          // Find or create state
          const stateKey = `${stateCode.toLowerCase()}-${region.id}`
          let state = existingStates?.find((s: { code: string; name: string; region_id: string }) => 
            (s.code.toLowerCase() === stateCode.toLowerCase() || s.name.toLowerCase() === stateName.toLowerCase()) &&
            s.region_id === region.id
          ) || createdStates[stateKey]

          if (!state) {
            const { data: newState, error: stateError } = await supabase
              .from('states')
              .insert({ 
                region_id: region.id, 
                name: stateName, 
                code: stateCode,
                tenant_id: tenantId 
              })
              .select('id')
              .single()
            
            if (stateError) {
              errors.push(`Linha ${rowNumber}: Erro ao criar estado "${stateName}"`)
              errorCount++
              continue
            }
            state = newState
            createdStates[stateKey] = newState
          }

          // Find or create city
          const cityKey = `${row.cidade.toLowerCase()}-${state.id}`
          let city = existingCities?.find((c: { name: string; state_id: string }) => 
            c.name.toLowerCase() === row.cidade.toLowerCase() &&
            c.state_id === state.id
          ) || createdCities[cityKey]

          if (!city) {
            const { data: newCity, error: cityError } = await supabase
              .from('cities')
              .insert({ 
                state_id: state.id, 
                name: row.cidade,
                tenant_id: tenantId 
              })
              .select('id')
              .single()
            
            if (cityError) {
              errors.push(`Linha ${rowNumber}: Erro ao criar cidade "${row.cidade}"`)
              errorCount++
              continue
            }
            city = newCity
            createdCities[cityKey] = newCity
          }

          // Create store with tenant_id
          const { error: storeError } = await supabase
            .from('stores')
            .insert({
              code: row.codigo,
              name: row.nome,
              city_id: city.id,
              address: row.endereco || null,
              cnpj: row.cnpj || null,
              bairro: row.bairro || null,
              cep: row.cep || null,
              regional_responsavel: row.regional || null,
              is_active: true,
              metadata: {},
              tenant_id: tenantId,
            })

          if (storeError) {
            if (storeError.code === '23505') {
              errors.push(`Linha ${rowNumber}: Código "${row.codigo}" já existe`)
            } else {
              errors.push(`Linha ${rowNumber}: ${storeError.message}`)
            }
            errorCount++
          } else {
            successCount++
            existingStoreCodes.add(row.codigo.toLowerCase())
          }
        } catch (error) {
          console.error(`Error processing row ${rowNumber}:`, error)
          errors.push(`Linha ${rowNumber}: Erro inesperado`)
          errorCount++
        }
      }

      // Update progress after each batch
      const progress = Math.round(((batchEnd) / rows.length) * 100)
      await supabase
        .from('import_logs')
        .update({ 
          success_rows: successCount,
          error_rows: errorCount,
          errors: errors.slice(-50), // Keep last 50 errors
          status: progress === 100 ? 'completed' : 'processing'
        })
        .eq('id', import_log_id)
      
      console.log(`Batch ${batchIndex + 1} complete. Success: ${successCount}, Errors: ${errorCount}`)
    }

    // Final update
    await supabase
      .from('import_logs')
      .update({ 
        status: 'completed',
        success_rows: successCount,
        error_rows: errorCount,
        errors: errors.slice(-100), // Keep last 100 errors
        completed_at: new Date().toISOString()
      })
      .eq('id', import_log_id)

    console.log(`Import completed. Total: ${rows.length}, Success: ${successCount}, Errors: ${errorCount}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        total: rows.length,
        success_count: successCount, 
        error_count: errorCount,
        errors: errors.slice(0, 20) // Return first 20 errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Import error:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function updateImportLogError(supabase: SupabaseClient, logId: string, errorMessage: string) {
  await supabase
    .from('import_logs')
    .update({ 
      status: 'error',
      errors: [errorMessage],
      completed_at: new Date().toISOString()
    })
    .eq('id', logId)
}
