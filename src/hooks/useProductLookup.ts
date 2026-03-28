import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { analyticsService } from "@/modules/analytics-engine";

interface ProductData {
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
}

interface ProductLookupState {
  product: ProductData | null;
  isLoading: boolean;
  error: string | null;
}

interface Demographics {
  gender?: string;
  age_group?: string;
  age_estimate?: number;
  emotion?: string;
  emotion_confidence?: number;
}

interface UseProductLookupOptions {
  deviceCode: string;
  deviceId?: string;
  companySlug?: string | null;
  storeCode?: string | null;
  onLookupStart?: () => void;
  onLookupEnd?: () => void;
}

// Cache local para respostas rápidas
const localCache = new Map<string, { product: ProductData; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

export const useProductLookup = ({ deviceCode, deviceId, companySlug, storeCode, onLookupStart, onLookupEnd }: UseProductLookupOptions) => {
  const [state, setState] = useState<ProductLookupState>({
    product: null,
    isLoading: false,
    error: null
  });
  
  // Previne lookups duplicados
  const pendingLookupRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const lookupProduct = useCallback(async (ean: string, demographics?: Demographics) => {
    const trimmedEan = ean.trim();
    
    if (!deviceCode) {
      console.error("[useProductLookup] deviceCode não definido");
      setState({ product: null, isLoading: false, error: "Dispositivo não configurado" });
      return;
    }

    // Evita lookup duplicado para mesmo EAN
    if (pendingLookupRef.current === trimmedEan) {
      console.log("[useProductLookup] Lookup duplicado ignorado:", trimmedEan);
      return;
    }

    // Cancela lookup anterior se houver
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Verifica cache local primeiro (resposta instantânea)
    // Inclui storeCode para evitar colisões quando a loja muda (ex: Grupo Assaí / id_store)
    const cacheKey = `${deviceCode}:${storeCode ?? ""}:${trimmedEan}`;
    const cached = localCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log("[useProductLookup] Cache hit:", trimmedEan);
      
      // Log cache hit if deviceId is available
      if (deviceId) {
        analyticsService.logPriceCheck({
          device_id: deviceId,
          barcode: trimmedEan,
          status_code: 200,
          response_time_ms: 0,
          request_payload: { source: 'local_cache' },
          created_at: new Date().toISOString()
        });
      }

      setState({ product: cached.product, isLoading: false, error: null });
      onLookupStart?.();
      // Delay mínimo para UX
      setTimeout(() => onLookupEnd?.(), 100);
      return;
    }

    console.log("[useProductLookup] Iniciando consulta para EAN:", trimmedEan, "demographics:", demographics);
    
    pendingLookupRef.current = trimmedEan;
    abortControllerRef.current = new AbortController();
    
    setState({ product: null, isLoading: true, error: null });
    onLookupStart?.();

    const startTime = performance.now();

    try {
      const isGrupoAssai = String(companySlug || "").toLowerCase().includes("grupo-assai");
      let groupAssaiPayload: { integration: string; id_product: number; product_description: string; id_store: number } | null = null;

      if (isGrupoAssai) {
        const storeCodeNumber = storeCode != null ? Number(storeCode) : NaN;
        if (!Number.isFinite(storeCodeNumber) || storeCodeNumber <= 0) {
          const elapsed = Math.round(performance.now() - startTime);

          if (deviceId) {
            analyticsService.logPriceCheck({
              device_id: deviceId,
              barcode: trimmedEan,
              status_code: 400,
              response_time_ms: elapsed,
              error_message: "Código da loja (id_store) obrigatório para Grupo Assaí",
              request_payload: {
                source: "grupo_assai_config",
                store_code: storeCode ?? null,
              },
              created_at: new Date().toISOString(),
            });
          }

          pendingLookupRef.current = null;
          setState({
            product: null,
            isLoading: false,
            error: "Código da loja obrigatório",
          });
          onLookupEnd?.();
          return;
        }

        const { default: index } = await import("@/components/player/grupo-assai_ean_index.json");
        const hit = (index as Record<string, { seq_produto: number; descricao: string }>)[trimmedEan];

        if (!hit?.seq_produto) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          let resolved: { id_product?: number; descricao?: string } | null = null;
          try {
            const url = new URL("http://srv-mupa.ddns.net:5050/api/ean/seqproduto");
            url.searchParams.set("codbar", trimmedEan);
            const res = await fetch(url.toString(), { method: "GET", signal: controller.signal });
            const json = await res.json().catch(() => null);
            if (json && typeof json === "object" && Number(json.id_product) > 0) {
              resolved = { id_product: Number(json.id_product), descricao: String(json.descricao || "") };
            }
          } catch (e) {
            // ignore network errors; handled below
          } finally {
            clearTimeout(timeoutId);
          }

          if (!resolved?.id_product) {
            const elapsed = Math.round(performance.now() - startTime);
            if (deviceId) {
              analyticsService.logPriceCheck({
                device_id: deviceId,
                barcode: trimmedEan,
                status_code: 404,
                response_time_ms: elapsed,
                error_message: "EAN não encontrado (índice local e serviço seqproduto)",
                request_payload: {
                  source: "grupo_assai_resolution",
                  store_code: storeCode ?? null,
                },
                created_at: new Date().toISOString(),
              });
            }
            pendingLookupRef.current = null;
            setState({
              product: null,
              isLoading: false,
              error: "EAN não encontrado",
            });
            onLookupEnd?.();
            return;
          }

          groupAssaiPayload = {
            integration: "grupo-assai",
            id_product: resolved.id_product!,
            product_description: resolved.descricao || "",
            id_store: storeCodeNumber,
          };
        } else {
          groupAssaiPayload = {
            integration: "grupo-assai",
            id_product: hit.seq_produto,
            product_description: hit.descricao,
            id_store: storeCodeNumber,
          };
        }
      }

      const { data, error } = await supabase.functions.invoke("product-lookup", {
        body: { 
          device_code: deviceCode, 
          ean: trimmedEan,
          demographics: demographics || null,
          ...(groupAssaiPayload || {})
        }
      });

      const elapsed = Math.round(performance.now() - startTime);
      console.log(`[useProductLookup] Resposta em ${elapsed}ms`);

      // Verifica se foi cancelado
      if (pendingLookupRef.current !== trimmedEan) {
        console.log("[useProductLookup] Lookup cancelado (outro em andamento)");
        return;
      }

      pendingLookupRef.current = null;

      if (error) {
        console.error("[useProductLookup] Erro na chamada:", error);
        
        // Log error
        if (deviceId) {
          analyticsService.logPriceCheck({
            device_id: deviceId,
            barcode: trimmedEan,
            status_code: 500,
            response_time_ms: elapsed,
            error_message: error.message || "Erro desconhecido",
            created_at: new Date().toISOString()
          });
        }

        setState({ 
          product: null, 
          isLoading: false, 
          error: "Erro ao consultar produto. Tente novamente." 
        });
        onLookupEnd?.();
        return;
      }

      if (!data.success) {
        console.log("[useProductLookup] Produto não encontrado:", data.error);
        
        // Log not found (logic logic might be handled by server, but good to have client record if server fails)
        // Actually server logs "not_found", so maybe skip here to avoid duplicates?
        // But if network fails, we want client log.
        // Here we have data, so server was reached. Server logged it.
        
        setState({ 
          product: null, 
          isLoading: false, 
          error: data.error || "Produto não encontrado" 
        });
        onLookupEnd?.();
        return;
      }

      console.log("[useProductLookup] Produto encontrado:", data.product);
      
      // Salva no cache local
      localCache.set(cacheKey, { 
        product: data.product, 
        timestamp: Date.now() 
      });
      
      // Server logs success, so we don't need to duplicate log here for successful fetch.
      
      setState({ 
        product: data.product, 
        isLoading: false, 
        error: null 
      });
      onLookupEnd?.();
    } catch (err) {
      // Ignora erros de abort
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      
      console.error("[useProductLookup] Erro inesperado:", err);
      
      // Log client-side error (network, etc)
      if (deviceId) {
        analyticsService.logPriceCheck({
          device_id: deviceId,
          barcode: trimmedEan,
          status_code: 0, // 0 for network/client error
          response_time_ms: Math.round(performance.now() - startTime),
          error_message: err instanceof Error ? err.message : "Erro desconhecido",
          created_at: new Date().toISOString()
        });
      }

      pendingLookupRef.current = null;
      setState({ 
        product: null, 
        isLoading: false, 
        error: "Erro de conexão. Verifique a rede." 
      });
      onLookupEnd?.();
    }
  }, [deviceCode, deviceId, companySlug, storeCode, onLookupStart, onLookupEnd]);

  const clearProduct = useCallback(() => {
    pendingLookupRef.current = null;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState({ product: null, isLoading: false, error: null });
  }, []);

  // Limpa cache expirado periodicamente
  const clearExpiredCache = useCallback(() => {
    const now = Date.now();
    for (const [key, value] of localCache.entries()) {
      if (now - value.timestamp > CACHE_TTL) {
        localCache.delete(key);
      }
    }
  }, []);

  return {
    ...state,
    lookupProduct,
    clearProduct,
    clearExpiredCache
  };
};
