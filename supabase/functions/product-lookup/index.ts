// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ProductLookupRequest {
  device_code: string;
  ean: string;
  // Dados demográficos opcionais (via detecção facial)
  demographics?: {
    gender?: string;
    age_group?: string;
    age_estimate?: number;
    emotion?: string;
    emotion_confidence?: number;
  };
}

interface ProductResponse {
  success: boolean;
  product?: {
    ean: string;
    name: string;
    unit: string;
    current_price: number;
    original_price: number | null;
    is_offer: boolean;
    savings_percent: number | null;
    image_url: string | null;
    store_code: string;
    description?: string; // Legacy support
  };
  error?: string;
}

// Função para validar e normalizar EAN
function validateEan(ean: string): { valid: boolean; normalized: string; error?: string } {
  const trimmed = ean.trim();
  
  if (!trimmed) {
    return { valid: false, normalized: '', error: 'EAN não pode estar vazio' };
  }
  
  if (!/^\d+$/.test(trimmed)) {
    return { valid: false, normalized: '', error: 'EAN deve conter apenas números' };
  }
  
  const validLengths = [8, 12, 13, 14];
  if (!validLengths.includes(trimmed.length)) {
    return { valid: false, normalized: '', error: `EAN deve ter 8, 12, 13 ou 14 dígitos (recebido: ${trimmed.length})` };
  }
  
  return { valid: true, normalized: trimmed };
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  const startTime = Date.now();
  
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    const body = await req.json() as ProductLookupRequest;
    const { device_code, ean, demographics } = body;
    
    console.log('[Request] device_code:', device_code, 'ean:', ean, 'demographics:', demographics);
    
    // Validar entrada
    if (!device_code) {
      return new Response(
        JSON.stringify({ success: false, error: 'device_code é obrigatório' } as ProductResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const eanValidation = validateEan(ean);
    if (!eanValidation.valid) {
      return new Response(
        JSON.stringify({ success: false, error: eanValidation.error } as ProductResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const normalizedEan = eanValidation.normalized;
    
    // Buscar dispositivo e sua empresa
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('id, company_id, store_id, store_code, price_integration_id, price_integration_enabled')
      .eq('device_code', device_code)
      .single();
    
    if (deviceError || !device) {
      console.error('[Device] Não encontrado:', device_code, deviceError);
      return new Response(
        JSON.stringify({ success: false, error: 'Dispositivo não encontrado' } as ProductResponse),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('[Device] Encontrado:', device.id, 'company:', device.company_id, 'store_code:', device.store_code);

    if (!device.company_id) {
      console.error('[Device] Sem empresa vinculada:', device_code);
      return new Response(
        JSON.stringify({ success: false, error: 'Dispositivo não vinculado a uma empresa' } as ProductResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const storeCode = device.store_code || '1';
    const priceIntegrationEnabled = (device as any)?.price_integration_enabled !== false;

    // 1. Verificar cache local primeiro (Product Cache)
    const { data: cached } = await supabase
      .from('product_cache')
      .select('product_data, image_url')
      .eq('company_id', device.company_id)
      .eq('ean', normalizedEan)
      .eq('store_code', storeCode)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (cached) {
      console.log('[Cache] Hit para EAN:', normalizedEan);
      
      // Log success (async)
      supabase.from('product_lookup_logs').insert({
        device_id: device.id,
        company_id: device.company_id,
        ean: normalizedEan,
        store_code: storeCode,
        status: 'success',
        latency_ms: Date.now() - startTime
      }).then();
      
      const productData = cached.product_data as any;
      
      return new Response(
        JSON.stringify({
          success: true,
          product: {
            ean: normalizedEan,
            name: productData.name,
            unit: productData.unit,
            current_price: productData.current_price,
            original_price: productData.original_price,
            is_offer: productData.is_offer,
            savings_percent: productData.savings_percent,
            image_url: cached.image_url,
            store_code: storeCode,
            description: productData.name // Legacy
          }
        } as ProductResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Resolver Integração
    let integrationId = priceIntegrationEnabled ? device.price_integration_id : null;

    // Se não houver no dispositivo, busca na empresa (integração ativa padrão)
    if (!integrationId && priceIntegrationEnabled) {
      // Prioridade: Integração marcada como "active" para a empresa
      const { data: companyInt } = await supabase
        .from('price_check_integrations')
        .select('id')
        .eq('company_id', device.company_id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      
      if (companyInt) {
        integrationId = companyInt.id;
        console.log('[Lookup] Usando integração da empresa:', integrationId);
      }
    }

    // 3. Executar Consulta via Proxy
    if (integrationId) {
      console.log('[Lookup] Executando proxy com integração:', integrationId);
      
      const { data: proxyData, error: proxyError } = await supabase.functions.invoke('price-check-proxy', {
        body: {
          integration_id: integrationId,
          device_id: device.id,
          barcode: normalizedEan,
          store_code: storeCode
        }
      });

      if (proxyError) {
        console.error('[Proxy] Erro na chamada:', proxyError);
        // Não retorna erro imediatamente, tenta fallback local
      } else if (proxyData && proxyData.success) {
        const p = proxyData.product;
        
        // Calculate savings
        const currentPrice = p.price_current || (p.prices && p.prices.length > 0 ? p.prices[0].value : 0);
        const originalPrice = p.price_original || null;
        let savingsPercent = null;
        let isOffer = false;

        if (originalPrice && originalPrice > currentPrice) {
          isOffer = true;
          savingsPercent = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
        }

        const productData = {
          ean: p.barcode,
          name: p.description,
          unit: p.unit || 'UN',
          current_price: currentPrice,
          original_price: originalPrice,
          is_offer: isOffer,
          savings_percent: savingsPercent,
          image_url: p.image,
          store_code: storeCode,
          description: p.description // Legacy
        };

        // Salvar em cache (15 minutos)
        const cacheTtl = 15;
        const expiresAt = new Date(Date.now() + cacheTtl * 60 * 1000);
        
        await supabase
          .from('product_cache')
          .upsert({
            company_id: device.company_id,
            ean: normalizedEan,
            store_code: storeCode,
            product_data: productData,
            image_url: p.image,
            expires_at: expiresAt.toISOString()
          }, {
            onConflict: 'company_id,ean,store_code'
          });
        
        // Log success
        await supabase.from('product_lookup_logs').insert({
          device_id: device.id,
          company_id: device.company_id,
          ean: normalizedEan,
          store_code: storeCode,
          status: 'success',
          latency_ms: Date.now() - startTime
        });

        // Registrar analytics
        const analyticsData = {
          device_id: device.id,
          company_id: device.company_id,
          store_code: storeCode,
          ean: normalizedEan,
          product_name: productData.name,
          product_data: productData,
          demographics: demographics
        };
        
        // Fire and forget analytics
        supabase.functions.invoke('analytics-ingest', { body: { type: 'price_check', data: analyticsData } }).then();

        return new Response(
          JSON.stringify({
            success: true,
            product: productData
          } as ProductResponse),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        console.warn('[Proxy] Resposta sem sucesso:', proxyData?.error);
      }
    } else {
      console.log('[Lookup] Nenhuma integração configurada. Tentando fallback local.');
    }

    // 4. Fallback: Tabela Local de Produtos
    // Se chegou aqui, ou não tem integração, ou a integração falhou/não encontrou
    const { data: localProduct, error: localError } = await supabase
      .from('products')
      .select('*')
      .eq('company_id', device.company_id)
      .eq('ean', normalizedEan) // Assumindo que a tabela products tem coluna 'ean' ou 'barcode'
      // .eq('store_code', storeCode) // Se produtos forem por loja
      .maybeSingle();

    if (localProduct) {
        console.log('[Lookup] Produto encontrado na base local');
        
        // Mapear localProduct para ProductResponse...
        // Assumindo estrutura genérica, ajustar conforme tabela real
        const productData = {
            ean: normalizedEan,
            name: localProduct.name || localProduct.description,
            unit: localProduct.unit || 'UN',
            current_price: localProduct.price || 0,
            original_price: localProduct.original_price || null,
            is_offer: false, // Calcular se necessário
            savings_percent: null,
            image_url: localProduct.image_url,
            store_code: storeCode,
            description: localProduct.name || localProduct.description
        };

        return new Response(
            JSON.stringify({
                success: true,
                product: productData
            } as ProductResponse),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // 5. Produto Não Encontrado
    await supabase.from('product_lookup_logs').insert({
      device_id: device.id,
      company_id: device.company_id,
      ean: normalizedEan,
      store_code: storeCode,
      status: 'not_found',
      latency_ms: Date.now() - startTime,
      error_message: 'Produto não encontrado em nenhuma fonte'
    });

    return new Response(
      JSON.stringify({ success: false, error: 'Produto não encontrado' } as ProductResponse),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[Lookup] Erro fatal:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro ao consultar produto. Tente novamente.' } as ProductResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
