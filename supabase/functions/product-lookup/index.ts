// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

const MUPA_IMAGE_API = "http://srv-mupa.ddns.net:5050/produto-imagem";

/**
 * Build a proxied image URL that goes through our edge function to avoid CORS.
 */
interface MupaImageResult {
  image_url: string | null;
  colors: {
    cor_assinatura_produto: string;
    fundo_legibilidade: string;
    cor_dominante_claro: string;
    cor_dominante_escuro: string;
  } | null;
}

function getProxiedImageUrl(ean: string): string {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  return `${supabaseUrl}/functions/v1/product-image-proxy?ean=${ean}`;
}

/**
 * Fetch product image URL + colors from Mupa API and persist to lite_products.
 * Returns proxied URL for browser compatibility + color palette.
 */
async function resolveProductImage(ean: string, supabase: any, companyId: string): Promise<MupaImageResult> {
  try {
    const nullResult: MupaImageResult = { image_url: null, colors: null };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    let res: Response;
    try {
      res = await fetch(`${MUPA_IMAGE_API}/${ean}`, { signal: controller.signal });
      clearTimeout(timeout);
    } catch (fetchErr) {
      clearTimeout(timeout);
      console.error(`[Image] Network error for ${ean}:`, fetchErr);
      return nullResult;
    }

    if (!res.ok) {
      console.warn(`[Image] Mupa API returned ${res.status} for ${ean}`);
      return nullResult;
    }
    
    const contentType = res.headers.get('content-type') || '';
    
    // If it returned an image directly, the proxy URL will work but no colors
    if (contentType.startsWith('image/')) {
      try { await res.arrayBuffer(); } catch {}
      const proxiedUrl = getProxiedImageUrl(ean);
      console.log(`[Image] Direct image found for ${ean}, using proxy: ${proxiedUrl}`);
      supabase
        .from('lite_products')
        .update({ image_url: proxiedUrl })
        .eq('ean', ean)
        .eq('company_id', companyId)
        .then(() => console.log(`[Image] Saved proxied URL to lite_products for ${ean}`));
      return { image_url: proxiedUrl, colors: null };
    }
    
    // JSON response with image URL + colors
    let data: any;
    try {
      data = await res.json();
    } catch {
      console.error(`[Image] Failed to parse JSON for ${ean}`);
      return nullResult;
    }
    
    const imageUrl = data.imagem_url || data.image_url || null;
    
    // Extract color palette from Mupa API response
    const colors = (data.cor_assinatura_produto || data.cor_dominante_claro || data.cor_dominante_escuro || data.fundo_legibilidade)
      ? {
          cor_assinatura_produto: data.cor_assinatura_produto || '#333333',
          fundo_legibilidade: data.fundo_legibilidade || '#000000',
          cor_dominante_claro: data.cor_dominante_claro || '#FFFFFF',
          cor_dominante_escuro: data.cor_dominante_escuro || '#000000',
        }
      : null;

    if (colors) {
      console.log(`[Image] Colors extracted for ${ean}:`, colors);
    }
    
    if (imageUrl) {
      const proxiedUrl = getProxiedImageUrl(ean);
      console.log(`[Image] Resolved for ${ean}: ${imageUrl}, proxied: ${proxiedUrl}`);
      supabase
        .from('lite_products')
        .update({ image_url: proxiedUrl })
        .eq('ean', ean)
        .eq('company_id', companyId)
        .then(() => console.log(`[Image] Saved proxied URL to lite_products for ${ean}`));
      return { image_url: proxiedUrl, colors };
    }
    
    console.warn(`[Image] No image URL found in response for ${ean}`);
    return nullResult;
  } catch (e) {
    console.error(`[Image] Unexpected error for ${ean}:`, e);
    return { image_url: null, colors: null };
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ProductLookupRequest {
  device_code: string;
  ean: string;
  integration?: string;
  id_product?: number;
  id_store?: number;
  product_description?: string;
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
    offer_quantity?: number | null;
    offer_type?: string | null;
    description?: string;
    packs?: Array<{
      id_product: number;
      id_store: number;
      unit_pack: number;
      price_pack: number;
      price_prom_pack: number;
      stock_avaliable: number;
    }>;
    api_colors?: {
      cor_assinatura_produto: string;
      fundo_legibilidade: string;
      cor_dominante_claro: string;
      cor_dominante_escuro: string;
    } | null;
  };
  error?: string;
}

// Função para validar e normalizar EAN
const AMERICANAS_COMPANY_ID = "510a683a-db10-466f-8890-dc8629a36390";
const AMERICANAS_INTEGRATION_NAME = "API Americanas";
const AMERICANAS_IMAGE_URL_BASE = "https://produtos-imgs.onrender.com/produto-imagem";
const GRUPO_ASSAI_TENANT_ID = "687b2692-dab7-4934-8ed1-eee6eb02dbb8";

function pickGrupoAssaiPrimaryPack(
  packs: Array<{ unit_pack: number; price_pack: number; price_prom_pack: number; stock_avaliable: number }>,
) {
  const unit = packs.find((p) => Number(p.unit_pack) === 1);
  if (unit) return unit;
  const sorted = [...packs].sort((a, b) => Number(a.unit_pack) - Number(b.unit_pack));
  return sorted[0] ?? null;
}

async function ensureAmericanasIntegration(supabase: any, companyId: string): Promise<string> {
  const { data: company } = await supabase
    .from("companies")
    .select("tenant_id")
    .eq("id", companyId)
    .maybeSingle();

  const desiredMapping = {
    fields: {
      barcode: "items[0].product.ean",
      internal_code: "items[0].product.sapId",
      description: "items[0].product.description",
      image: "",
      unit: "items[0].product.commercialUnit",
      price_current: "items[0].regularPrice",
      price_original: "",
      prices: [
        { label: "regularPrice", path: "items[0].regularPrice" },
        { label: "promotionalPrice", path: "items[0].promotional.price" },
        { label: "promotionalDiscountPercent", path: "items[0].promotional.discountPercent" },
        { label: "takeWinUnitPriceWithDiscount", path: "items[0].takeWin.unitPriceWithDiscount" },
        { label: "takeWinTotalPriceWithDiscount", path: "items[0].takeWin.totalPriceWithDiscount" },
        { label: "takeWinQuantity", path: "items[0].takeWin.quantity" },
        { label: "takeWinDiscountValue", path: "items[0].takeWin.discountValue" },
      ],
    },
  };

  const desiredUpdate = {
    status: "active",
    environment: "production",
    auth_type: "none",
    auth_config: {},
    request_url: "https://pricing-query.azr.internal.americanas.io/price?storeId={store}&ean={ean}",
    request_method: "GET",
    request_headers_json: { Accept: "application/json" },
    request_query_params_json: {},
    request_body_json: {},
    request_variables_json: [
      { name: "store", description: "Código da filial (storeId)" },
      { name: "ean", description: "EAN/GTIN do produto" },
    ],
    endpoint_url: "",
    method: "GET",
    barcode_param_type: "query_param",
    headers: {},
    mapping_config: desiredMapping,
    tenant_id: company?.tenant_id ?? null,
  };

  const { data: existing, error: findError } = await supabase
    .from("price_check_integrations")
    .select("id")
    .eq("company_id", companyId)
    .eq("name", AMERICANAS_INTEGRATION_NAME)
    .limit(1)
    .maybeSingle();

  if (findError) {
    console.error("[Americanas] Falha ao buscar integração:", findError);
  }

  if (existing?.id) {
    await supabase.from("price_check_integrations").update(desiredUpdate).eq("id", existing.id);
    return existing.id;
  }

  const { data: created, error: createError } = await supabase
    .from("price_check_integrations")
    .insert({
      name: AMERICANAS_INTEGRATION_NAME,
      company_id: companyId,
      ...desiredUpdate,
    })
    .select("id")
    .single();

  if (createError || !created?.id) {
    console.error("[Americanas] Falha ao criar integração:", createError);
    throw new Error("Não foi possível criar a integração da Americanas");
  }

  return created.id;
}

function validateEan(ean: string): { valid: boolean; normalized: string; error?: string } {
  const trimmed = ean.trim();
  
  
  if (!trimmed) {
    return { valid: false, normalized: '', error: 'EAN não pode estar vazio' };
  }
  
  if (!/^\d+$/.test(trimmed)) {
    return { valid: false, normalized: '', error: 'EAN deve conter apenas números' };
  }
  
  if (trimmed.length < 1 || trimmed.length > 20) {
    return { valid: false, normalized: '', error: `EAN inválido (recebido: ${trimmed.length} dígitos)` };
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
    const { device_code, ean, demographics, integration, id_product, product_description } = body;
    
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
      .select('id, company_id, store_id, store_code, price_integration_id, api_integration_id, price_integration_enabled')
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

    const integrationSlug = String(integration || '').toLowerCase();
    const storeCode = (integrationSlug === 'grupo-assai' && body.id_store != null)
      ? String(body.id_store)
      : (device.store_code || '1');
    const priceIntegrationEnabled = (device as any)?.price_integration_enabled !== false;
    const isAmericanasCompany = device.company_id === AMERICANAS_COMPANY_ID;
    const americanasIntegrationId = isAmericanasCompany ? await ensureAmericanasIntegration(supabase, device.company_id) : null;

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
            offer_quantity: productData.offer_quantity ?? null,
            offer_type: productData.offer_type ?? null,
            description: productData.description || productData.name,
            packs: Array.isArray(productData.packs) ? productData.packs : undefined,
            api_colors: productData.api_colors ?? null,
          }
        } as ProductResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: company } = await supabase
      .from("companies")
      .select("tenant_id")
      .eq("id", device.company_id)
      .maybeSingle();

    const isGrupoAssaiTenant = company?.tenant_id === GRUPO_ASSAI_TENANT_ID;
    const isGrupoAssai = String(integration || "").toLowerCase() === "grupo-assai" || isGrupoAssaiTenant;

    if (isGrupoAssai && priceIntegrationEnabled) {
      let mutableIdProduct = id_product;
      if (!mutableIdProduct || !Number.isFinite(Number(mutableIdProduct))) {
        try {
          const url = new URL('http://srv-mupa.ddns.net:5050/api/ean/seqproduto');
          url.searchParams.set('codbar', normalizedEan);
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          const res = await fetch(url.toString(), { method: 'GET', signal: controller.signal });
          clearTimeout(timeout);
          const json = await res.json().catch(() => null);
          const resolvedId = Number(json?.id_product) || 0;
          if (resolvedId > 0) {
            mutableIdProduct = resolvedId;
            if (json?.descricao && (!product_description || String(product_description).trim().length === 0)) {
              (body as any).product_description = String(json.descricao);
            }
          } else {
            await supabase.from('product_lookup_logs').insert({
              device_id: device.id,
              company_id: device.company_id,
              ean: normalizedEan,
              store_code: storeCode,
              status: 'error',
              latency_ms: Date.now() - startTime,
              error_message: 'Grupo Assai: id_product ausente/ inválido e falha ao resolver via seqproduto'
            });
    
            return new Response(
              JSON.stringify({ success: false, error: 'Grupo Assai: id_product é obrigatório' } as ProductResponse),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } catch (e) {
          await supabase.from('product_lookup_logs').insert({
            device_id: device.id,
            company_id: device.company_id,
            ean: normalizedEan,
            store_code: storeCode,
            status: 'error',
            latency_ms: Date.now() - startTime,
            error_message: 'Grupo Assai: falha ao resolver id_product via seqproduto'
          });
  
          return new Response(
            JSON.stringify({ success: false, error: 'Grupo Assai: id_product é obrigatório' } as ProductResponse),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      const idStore = Number(storeCode);
      if (!Number.isFinite(idStore)) {
        await supabase.from('product_lookup_logs').insert({
          device_id: device.id,
          company_id: device.company_id,
          ean: normalizedEan,
          store_code: storeCode,
          status: 'error',
          latency_ms: Date.now() - startTime,
          error_message: 'Grupo Assai: store_code inválido para id_store'
        });

        return new Response(
          JSON.stringify({ success: false, error: 'Grupo Assai: store_code deve ser numérico (id_store)' } as ProductResponse),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        const stockUrl = new URL('https://marketplace.assai.com.br/stock');
        stockUrl.searchParams.set('id_product', String(mutableIdProduct));
        stockUrl.searchParams.set('id_store', String(idStore));

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(stockUrl.toString(), {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });

        clearTimeout(timeout);

        const rawText = await res.text();
        const json = (() => {
          try { return JSON.parse(rawText); } catch { return null; }
        })();

        if (!res.ok || !Array.isArray(json)) {
          await supabase.from('product_lookup_logs').insert({
            device_id: device.id,
            company_id: device.company_id,
            ean: normalizedEan,
            store_code: storeCode,
            status: 'error',
            latency_ms: Date.now() - startTime,
            error_message: `Grupo Assai: resposta inválida (${res.status})`
          });

          return new Response(
            JSON.stringify({ success: false, error: 'Grupo Assai: erro ao consultar estoque/preço' } as ProductResponse),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const packs = (json as any[]).map((r) => ({
          id_product: Number(r?.id_product) || Number(id_product),
          id_store: Number(r?.id_store) || idStore,
          unit_pack: Number(r?.unit_pack) || 0,
          price_pack: Number(r?.price_pack) || 0,
          price_prom_pack: Number(r?.price_prom_pack) || 0,
          stock_avaliable: Number(r?.stock_avaliable) || 0,
        })).filter((p) => p.unit_pack > 0);

        if (packs.length === 0) {
          await supabase.from('product_lookup_logs').insert({
            device_id: device.id,
            company_id: device.company_id,
            ean: normalizedEan,
            store_code: storeCode,
            status: 'not_found',
            latency_ms: Date.now() - startTime,
            error_message: 'Grupo Assai: nenhum pack retornado'
          });

          return new Response(
            JSON.stringify({ success: false, error: 'Produto não encontrado' } as ProductResponse),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const primaryPack = pickGrupoAssaiPrimaryPack(packs);
        const originalPrice = Number(primaryPack?.price_pack) || 0;
        const promoPrice = Number(primaryPack?.price_prom_pack) || 0;
        const currentPrice = promoPrice > 0 ? promoPrice : originalPrice;

        let savingsPercent: number | null = null;
        let isOffer = false;
        if (promoPrice > 0 && originalPrice > promoPrice) {
          isOffer = true;
          savingsPercent = Math.round(((originalPrice - promoPrice) / originalPrice) * 100);
        }

        const productName = (product_description && String(product_description).trim()) ? String(product_description).trim() : `Produto ${id_product}`;
        const resolvedImage = await resolveProductImage(normalizedEan, supabase, device.company_id);

        const productData = {
          ean: normalizedEan,
          name: productName,
          unit: 'UN',
          current_price: currentPrice,
          original_price: isOffer ? originalPrice : null,
          is_offer: isOffer,
          savings_percent: savingsPercent,
          image_url: resolvedImage.image_url,
          store_code: storeCode,
          description: productName,
          packs: packs,
          api_colors: resolvedImage.colors,
        };

        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        await supabase
          .from('product_cache')
          .upsert(
            {
              company_id: device.company_id,
              ean: normalizedEan,
              store_code: storeCode,
              product_data: productData,
              image_url: productData.image_url,
              expires_at: expiresAt.toISOString(),
            },
            { onConflict: 'company_id,ean,store_code' },
          );

        await supabase.from('product_lookup_logs').insert({
          device_id: device.id,
          company_id: device.company_id,
          ean: normalizedEan,
          store_code: storeCode,
          status: 'success',
          latency_ms: Date.now() - startTime,
        });

        return new Response(JSON.stringify({ success: true, product: productData } as ProductResponse), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        console.error('[GrupoAssai] Erro na chamada:', e);

        await supabase.from('product_lookup_logs').insert({
          device_id: device.id,
          company_id: device.company_id,
          ean: normalizedEan,
          store_code: storeCode,
          status: 'error',
          latency_ms: Date.now() - startTime,
          error_message: 'Grupo Assai: erro inesperado na chamada'
        });

        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao consultar produto. Tente novamente.' } as ProductResponse),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 2. Consulta via Integração API (api_integrations)
    const apiIntegrationId = !isAmericanasCompany && priceIntegrationEnabled ? (device as any)?.api_integration_id : null;
    if (apiIntegrationId) {
      console.log('[Lookup] Executando API integration:', apiIntegrationId);

      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const deviceApiUrl = new URL(`${supabaseUrl}/functions/v1/device-api/price`);
        deviceApiUrl.searchParams.set('integration_id', String(apiIntegrationId));
        deviceApiUrl.searchParams.set('barcode', normalizedEan);
        deviceApiUrl.searchParams.set('store', storeCode);

        const res = await fetch(deviceApiUrl.toString(), { method: 'GET' });
        const apiJson = await res.json().catch(() => null);

        if (apiJson && (apiJson as any).error) {
          console.warn('[API] Resposta de erro:', (apiJson as any)?.message);
        } else if (apiJson && typeof apiJson === 'object') {
          const p = apiJson as any;

          const originalPrice = Number(p.price || 0) || 0;
          const promoPrice = Number(p.promo_price || 0) || 0;
          const currentPrice = promoPrice > 0 ? promoPrice : originalPrice;

          let savingsPercent = null;
          let isOffer = false;
          if (promoPrice > 0 && originalPrice > promoPrice) {
            isOffer = true;
            savingsPercent = Math.round(((originalPrice - promoPrice) / originalPrice) * 100);
          }

          const resolvedImage = p.image
            ? { image_url: p.image, colors: null as any }
            : await resolveProductImage(normalizedEan, supabase, device.company_id);

          const productData = {
            ean: normalizedEan,
            name: p.name || '',
            unit: 'UN',
            current_price: currentPrice,
            original_price: isOffer ? originalPrice : null,
            is_offer: isOffer,
            savings_percent: savingsPercent,
            image_url: resolvedImage.image_url || p.image || null,
            store_code: storeCode,
            description: p.name || '',
            api_colors: resolvedImage.colors,
          };

          const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
          await supabase
            .from('product_cache')
            .upsert(
              {
                company_id: device.company_id,
                ean: normalizedEan,
                store_code: storeCode,
                product_data: productData,
                image_url: productData.image_url,
                expires_at: expiresAt.toISOString(),
              },
              { onConflict: 'company_id,ean,store_code' },
            );

          await supabase.from('product_lookup_logs').insert({
            device_id: device.id,
            company_id: device.company_id,
            ean: normalizedEan,
            store_code: storeCode,
            status: 'success',
            latency_ms: Date.now() - startTime,
          });

          supabase.functions
            .invoke('analytics-ingest', {
              body: {
                type: 'price_check',
                data: {
                  device_id: device.id,
                  company_id: device.company_id,
                  store_code: storeCode,
                  ean: normalizedEan,
                  product_name: productData.name,
                  product_data: productData,
                  demographics: demographics,
                },
              },
            })
            .then();

          return new Response(JSON.stringify({ success: true, product: productData } as ProductResponse), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (e) {
        console.error('[API] Erro na chamada:', e);
      }
    }

    // 2. Resolver Integração
    let integrationId = priceIntegrationEnabled ? device.price_integration_id : null;
    if (isAmericanasCompany && priceIntegrationEnabled) {
      integrationId = americanasIntegrationId;
    }

    // Se não houver no dispositivo, busca na empresa (integração ativa padrão)
    if (!integrationId && priceIntegrationEnabled && !isAmericanasCompany) {
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
        
        const pricesArr = Array.isArray(p?.prices) ? p.prices : [];
        const priceByLabel = (label: string) => {
          const hit = pricesArr.find((x: any) => x?.label === label);
          return Number(hit?.value) || 0;
        };

        const regularPrice = priceByLabel("regularPrice") || Number(p.price_current || 0) || 0;
        const promotionalPrice = priceByLabel("promotionalPrice");
        const promotionalDiscountPercent = priceByLabel("promotionalDiscountPercent");
        const takeWinUnitPriceWithDiscount = priceByLabel("takeWinUnitPriceWithDiscount");
        const takeWinQuantity = priceByLabel("takeWinQuantity");

        let currentPrice = p.price_current || (pricesArr.length > 0 ? Number(pricesArr[0]?.value) || 0 : 0);
        let originalPrice = p.price_original || null;
        let offerQuantity: number | null = null;
        let offerType: string | null = null;

        if (isAmericanasCompany) {
          const qty = takeWinQuantity ? Math.max(0, Math.round(takeWinQuantity)) : 0;
          if (takeWinUnitPriceWithDiscount > 0 && qty > 1 && regularPrice > 0 && takeWinUnitPriceWithDiscount < regularPrice) {
            currentPrice = takeWinUnitPriceWithDiscount;
            originalPrice = regularPrice;
            offerQuantity = qty;
            offerType = "take_win";
          } else if (promotionalPrice > 0 && regularPrice > 0 && promotionalPrice < regularPrice) {
            currentPrice = promotionalPrice;
            originalPrice = regularPrice;
            offerType = "promotional";
          } else {
            currentPrice = regularPrice || promotionalPrice || takeWinUnitPriceWithDiscount || Number(p.price_current || 0) || 0;
            originalPrice = null;
            offerType = null;
          }
        } else {
          currentPrice = p.price_current || (pricesArr.length > 0 ? Number(pricesArr[0]?.value) || 0 : 0);
          originalPrice = p.price_original || null;
        }

        let savingsPercent: number | null = null;
        let isOffer = false;
        if (originalPrice && originalPrice > currentPrice && currentPrice > 0) {
          isOffer = true;
          savingsPercent = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
        } else if (isAmericanasCompany && offerType === "promotional" && promotionalDiscountPercent > 0) {
          savingsPercent = Math.round(promotionalDiscountPercent);
          isOffer = !!originalPrice && originalPrice > currentPrice;
        }

        const imageCandidate = (p.image && String(p.image).trim())
          ? String(p.image)
          : (isAmericanasCompany ? `${AMERICANAS_IMAGE_URL_BASE}/${normalizedEan}` : "");

        let resolvedImage = imageCandidate
          ? { image_url: imageCandidate, colors: null as any }
          : await resolveProductImage(normalizedEan, supabase, device.company_id);
        // If we have the image but no colors yet, try fetching colors from Mupa
        if (imageCandidate && !resolvedImage.colors) {
          const mupaResult = await resolveProductImage(normalizedEan, supabase, device.company_id);
          if (mupaResult.colors) resolvedImage.colors = mupaResult.colors;
        }

        const productData = {
          ean: p.barcode,
          name: p.description,
          unit: p.unit || 'UN',
          current_price: currentPrice,
          original_price: originalPrice,
          is_offer: isOffer,
          savings_percent: savingsPercent,
          image_url: resolvedImage.image_url || imageCandidate || p.image,
          store_code: storeCode,
          description: p.description,
          api_colors: resolvedImage.colors,
          offer_quantity: offerQuantity,
          offer_type: offerType,
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
            image_url: productData.image_url,
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

    // 4. Fallback: Tabela lite_products (plano Lite)
    const { data: liteProduct } = await supabase
      .from('lite_products')
      .select('*')
      .eq('company_id', device.company_id)
      .eq('ean', normalizedEan)
      .eq('is_active', true)
      .maybeSingle();

    if (liteProduct) {
        console.log('[Lookup] Produto encontrado em lite_products');
        
        // Determinar preços: promo_price ou de_por_price são ofertas
        const normalPrice = Number(liteProduct.normal_price) || 0;
        const promoPrice = liteProduct.promo_price ? Number(liteProduct.promo_price) : null;
        const dePorPrice = liteProduct.de_por_price ? Number(liteProduct.de_por_price) : null;
        const clubPrice = liteProduct.club_price ? Number(liteProduct.club_price) : null;
        
        // Prioridade: promo > de_por > normal
        let currentPrice = normalPrice;
        let originalPrice: number | null = null;
        let isOffer = false;
        let savingsPercent: number | null = null;

        if (dePorPrice && dePorPrice < normalPrice) {
          currentPrice = dePorPrice;
          originalPrice = normalPrice;
          isOffer = true;
          savingsPercent = Math.round(((normalPrice - dePorPrice) / normalPrice) * 100);
        } else if (promoPrice && promoPrice < normalPrice) {
          currentPrice = promoPrice;
          originalPrice = normalPrice;
          isOffer = true;
          savingsPercent = Math.round(((normalPrice - promoPrice) / normalPrice) * 100);
        }

        // Buscar URL de imagem + cores se não existir ou converter URL direta para proxy
        let imageUrl = liteProduct.image_url;
        let apiColors: MupaImageResult['colors'] = null;
        
        if (imageUrl && imageUrl.includes('srv-mupa.ddns.net')) {
          imageUrl = getProxiedImageUrl(normalizedEan);
        }
        
        // Always try to get colors from Mupa API
        const mupaResult = await resolveProductImage(normalizedEan, supabase, device.company_id);
        apiColors = mupaResult.colors;
        if (!imageUrl) {
          imageUrl = mupaResult.image_url;
        }

        const productData = {
            ean: normalizedEan,
            name: liteProduct.description,
            unit: 'UN',
            current_price: currentPrice,
            original_price: originalPrice,
            is_offer: isOffer,
            savings_percent: savingsPercent,
            image_url: imageUrl,
            store_code: storeCode,
            description: liteProduct.description,
            api_colors: apiColors
        };

        // Cache for 15 min
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        supabase.from('product_cache').upsert({
          company_id: device.company_id,
          ean: normalizedEan,
          store_code: storeCode,
          product_data: productData,
          image_url: imageUrl,
          expires_at: expiresAt.toISOString()
        }, { onConflict: 'company_id,ean,store_code' }).then();

        // Log success
        supabase.from('product_lookup_logs').insert({
          device_id: device.id,
          company_id: device.company_id,
          ean: normalizedEan,
          store_code: storeCode,
          status: 'success',
          latency_ms: Date.now() - startTime
        }).then();

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
