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
  onLookupStart?: () => void;
  onLookupEnd?: () => void;
}

// Cache local para respostas rápidas
const localCache = new Map<string, { product: ProductData; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

export const useProductLookup = ({ deviceCode, deviceId, onLookupStart, onLookupEnd }: UseProductLookupOptions) => {
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
    const cacheKey = `${deviceCode}:${trimmedEan}`;
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
      const { data, error } = await supabase.functions.invoke("product-lookup", {
        body: { 
          device_code: deviceCode, 
          ean: trimmedEan,
          demographics: demographics || null
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
  }, [deviceCode, onLookupStart, onLookupEnd]);

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
