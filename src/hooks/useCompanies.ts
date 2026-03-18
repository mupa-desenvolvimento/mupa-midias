import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserTenant } from "./useUserTenant";
import type { Json } from "@/integrations/supabase/types";

export interface Company {
  id: string;
  tenant_id: string | null;
  name: string;
  slug: string;
  cnpj: string | null;
  is_active: boolean;
  settings: Json | null;
  created_at: string;
  updated_at: string;
}

export interface ApiIntegration {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  base_url: string;
  auth_type: string;
  endpoints: Json;
  default_settings: Json;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyIntegration {
  id: string;
  company_id: string;
  integration_id: string;
  is_active: boolean;
  credentials: Json;
  settings: Json;
  token_cache: Json;
  created_at: string;
  updated_at: string;
  integration?: ApiIntegration;
}

export interface CompanyWithIntegrations extends Company {
  integrations?: CompanyIntegration[];
}

export interface CompanyInsert {
  name: string;
  slug: string;
  tenant_id?: string | null;
  cnpj?: string | null;
  settings?: Json | null;
}

export interface CompanyUpdate {
  name?: string;
  slug?: string;
  cnpj?: string | null;
  is_active?: boolean;
  settings?: Json | null;
}

export interface CompanyIntegrationInsert {
  company_id: string;
  integration_id: string;
  credentials: Json;
  settings: Json;
}

export const useCompanies = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tenantId, isSuperAdmin } = useUserTenant();

  const { data: companies = [], isLoading, error } = useQuery({
    queryKey: ["companies", tenantId, isSuperAdmin],
    queryFn: async () => {
      let query = supabase
        .from("companies")
        .select(`
          *,
          integrations:company_integrations(
            *,
            integration:api_integrations(*)
          )
        `)
        .order("name");

      if (!isSuperAdmin && tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CompanyWithIntegrations[];
    },
  });

  const { data: availableIntegrations = [] } = useQuery({
    queryKey: ["api-integrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_integrations")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as ApiIntegration[];
    },
  });

  const createCompany = useMutation({
    mutationFn: async (company: CompanyInsert) => {
      const companyData = { ...company };
      if (!isSuperAdmin && tenantId && !companyData.tenant_id) {
        companyData.tenant_id = tenantId;
      }

      const { data, error } = await supabase
        .from("companies")
        .insert([companyData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast({ title: "Empresa criada com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao criar empresa", description: error.message, variant: "destructive" });
    },
  });

  const updateCompany = useMutation({
    mutationFn: async ({ id, ...updates }: CompanyUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("companies")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast({ title: "Empresa atualizada com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar empresa", description: error.message, variant: "destructive" });
    },
  });

  const deleteCompany = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("companies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast({ title: "Empresa excluída com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao excluir empresa", description: error.message, variant: "destructive" });
    },
  });

  const addCompanyIntegration = useMutation({
    mutationFn: async (integration: CompanyIntegrationInsert) => {
      const { data: existing } = await supabase
        .from("company_integrations")
        .select("id")
        .eq("company_id", integration.company_id)
        .eq("integration_id", integration.integration_id)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from("company_integrations")
          .update({
            credentials: integration.credentials,
            settings: integration.settings,
            is_active: true
          })
          .eq("id", existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("company_integrations")
          .insert([{
            company_id: integration.company_id,
            integration_id: integration.integration_id,
            credentials: integration.credentials,
            settings: integration.settings,
            is_active: true
          }])
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast({ title: "Integração configurada com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao configurar integração", description: error.message, variant: "destructive" });
    },
  });

  const updateCompanyIntegration = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CompanyIntegrationInsert> & { id: string }) => {
      const { data, error } = await supabase
        .from("company_integrations")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast({ title: "Integração atualizada com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar integração", description: error.message, variant: "destructive" });
    },
  });

  const removeCompanyIntegration = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("company_integrations")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast({ title: "Integração removida com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao remover integração", description: error.message, variant: "destructive" });
    },
  });

  return {
    companies,
    availableIntegrations,
    isLoading,
    error,
    createCompany,
    updateCompany,
    deleteCompany,
    addCompanyIntegration,
    updateCompanyIntegration,
    removeCompanyIntegration,
  };
};
