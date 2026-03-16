
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Json } from "@/integrations/supabase/types";

export interface PriceCheckIntegration {
  id: string;
  name: string;
  company_id: string | null;
  tenant_id?: string | null;
  auth_type: string;
  auth_config: Record<string, any>;
  auth_curl?: string | null;
  request_curl?: string | null;
  auth_url?: string | null;
  auth_method?: string | null;
  auth_headers_json?: Record<string, any>;
  auth_query_params_json?: Record<string, any>;
  auth_body_json?: Record<string, any>;
  auth_body_text?: string | null;
  auth_token_path?: string | null;
  token_expiration_seconds?: number | null;
  token_cache?: any;
  request_url?: string | null;
  request_method?: string | null;
  request_headers_json?: Record<string, any>;
  request_query_params_json?: Record<string, any>;
  request_body_json?: Record<string, any>;
  request_body_text?: string | null;
  request_variables_json?: any;
  endpoint_url: string;
  method: string;
  barcode_param_type: string;
  barcode_param_name: string | null;
  headers: Record<string, any>;
  mapping_config: Record<string, any>;
  status: "active" | "inactive";
  environment: "production" | "staging";
  created_at: string;
  updated_at: string;
  companies?: { name: string } | null;
}

export interface PriceCheckLog {
  id: string;
  integration_id: string | null;
  device_id: string | null;
  barcode: string;
  store_code?: string | null;
  status_code: number;
  response_time_ms: number;
  request_snapshot?: any;
  response_snapshot?: any;
  mapped_product?: any;
  error_message?: string | null;
  created_at: string;
}

export function usePriceCheckIntegrations() {
  const queryClient = useQueryClient();

  const { data: integrations, isLoading } = useQuery({
    queryKey: ["price-check-integrations"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("price_check_integrations")
        .select("*, companies(name)")
        .order("created_at", { ascending: false });

      if (error) {
        const msg = String(error?.message ?? "").toLowerCase();
        if (msg.includes("does not exist") && msg.includes("relation")) return [] as PriceCheckIntegration[];
        toast.error("Erro ao carregar integrações");
        throw error;
      }
      return data as PriceCheckIntegration[];
    },
  });

  const createIntegration = useMutation({
    mutationFn: async (payload: Partial<PriceCheckIntegration>) => {
      const { companies, id, created_at, updated_at, ...rest } = payload as any;
      const { data, error } = await (supabase as any)
        .from("price_check_integrations")
        .insert(rest)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-check-integrations"] });
      toast.success("Integração criada com sucesso");
    },
    onError: (e: any) => { console.error(e); toast.error("Erro ao criar integração"); },
  });

  const updateIntegration = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PriceCheckIntegration> & { id: string }) => {
      const { companies, created_at, ...rest } = updates as any;
      const { data, error } = await (supabase as any)
        .from("price_check_integrations")
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-check-integrations"] });
      toast.success("Integração atualizada");
    },
    onError: (e: any) => { console.error(e); toast.error("Erro ao atualizar"); },
  });

  const deleteIntegration = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("price_check_integrations")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-check-integrations"] });
      toast.success("Integração removida");
    },
    onError: (e: any) => { console.error(e); toast.error("Erro ao remover"); },
  });

  return { integrations, isLoading, createIntegration, updateIntegration, deleteIntegration, usePriceCheckLogs };
}

export function usePriceCheckLogs(integrationId?: string) {
  return useQuery({
    queryKey: ["price-check-logs", integrationId],
    queryFn: async () => {
      let query = (supabase as any)
        .from("price_check_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (integrationId) query = query.eq("integration_id", integrationId);

      const { data, error } = await query;
      if (error) {
        const msg = String(error?.message ?? "").toLowerCase();
        if (msg.includes("does not exist") && msg.includes("relation")) return [] as PriceCheckLog[];
        toast.error("Erro ao carregar logs");
        throw error;
      }
      return data as PriceCheckLog[];
    },
    enabled: !!integrationId,
  });
}
