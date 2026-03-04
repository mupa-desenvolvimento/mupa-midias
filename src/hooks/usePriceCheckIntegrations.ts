
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Json } from "@/integrations/supabase/types";

export interface PriceCheckIntegration {
  id: string;
  name: string;
  company_id: string | null;
  auth_type: 'none' | 'api_key' | 'bearer_token' | 'basic_auth' | 'oauth2';
  auth_config: Record<string, any>;
  endpoint_url: string;
  method: 'GET' | 'POST';
  barcode_param_type: 'query_param' | 'path_param' | 'body_json' | 'form_data';
  barcode_param_name: string | null;
  headers: Record<string, any>;
  mapping_config: Record<string, any>;
  status: 'active' | 'inactive';
  environment: 'production' | 'staging';
  created_at: string;
  updated_at: string;
  companies?: {
    name: string;
  } | null;
}

export interface PriceCheckLog {
  id: string;
  integration_id: string | null;
  device_id: string | null;
  barcode: string;
  status_code: number;
  response_time_ms: number;
  created_at: string;
  error_message?: string;
}

export function usePriceCheckIntegrations() {
  const queryClient = useQueryClient();

  const { data: integrations, isLoading } = useQuery({
    queryKey: ["price-check-integrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_check_integrations")
        .select(`
          *,
          companies (
            name
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Erro ao carregar integrações");
        throw error;
      }

      return data as PriceCheckIntegration[];
    },
  });

  const createIntegration = useMutation({
    mutationFn: async (newIntegration: Partial<PriceCheckIntegration>) => {
      const { data, error } = await supabase
        .from("price_check_integrations")
        .insert({
          name: newIntegration.name,
          company_id: newIntegration.company_id,
          auth_type: newIntegration.auth_type,
          auth_config: newIntegration.auth_config as unknown as Json,
          endpoint_url: newIntegration.endpoint_url,
          method: newIntegration.method,
          barcode_param_type: newIntegration.barcode_param_type,
          barcode_param_name: newIntegration.barcode_param_name,
          headers: newIntegration.headers as unknown as Json,
          mapping_config: newIntegration.mapping_config as unknown as Json,
          status: newIntegration.status || 'active',
          environment: newIntegration.environment || 'production'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-check-integrations"] });
      toast.success("Integração criada com sucesso");
    },
    onError: (error) => {
      console.error(error);
      toast.error("Erro ao criar integração");
    },
  });

  const updateIntegration = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PriceCheckIntegration> & { id: string }) => {
      const { data, error } = await supabase
        .from("price_check_integrations")
        .update({
          name: updates.name,
          company_id: updates.company_id,
          auth_type: updates.auth_type,
          auth_config: updates.auth_config as unknown as Json,
          endpoint_url: updates.endpoint_url,
          method: updates.method,
          barcode_param_type: updates.barcode_param_type,
          barcode_param_name: updates.barcode_param_name,
          headers: updates.headers as unknown as Json,
          mapping_config: updates.mapping_config as unknown as Json,
          status: updates.status,
          environment: updates.environment,
          updated_at: new Date().toISOString()
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-check-integrations"] });
      toast.success("Integração atualizada com sucesso");
    },
    onError: (error) => {
      console.error(error);
      toast.error("Erro ao atualizar integração");
    },
  });

  const deleteIntegration = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("price_check_integrations")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-check-integrations"] });
      toast.success("Integração removida com sucesso");
    },
    onError: (error) => {
      console.error(error);
      toast.error("Erro ao remover integração");
    },
  });

  return {
    integrations,
    isLoading,
    createIntegration,
    updateIntegration,
    deleteIntegration,
    usePriceCheckLogs,
  };
}

export function usePriceCheckLogs(integrationId?: string) {
  return useQuery({
    queryKey: ["price-check-logs", integrationId],
    queryFn: async () => {
      let query = supabase
        .from("price_check_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (integrationId) {
        query = query.eq("integration_id", integrationId);
      }

      const { data, error } = await query;

      if (error) {
        toast.error("Erro ao carregar logs");
        throw error;
      }

      return data as PriceCheckLog[];
    },
    enabled: !!integrationId,
  });
}
