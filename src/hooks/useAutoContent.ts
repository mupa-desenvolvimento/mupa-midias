import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";

export type AutoContentType =
  | "weather"
  | "news"
  | "quote"
  | "curiosity"
  | "birthday"
  | "nutrition"
  | "instagram"
  | "qr_campaign";

export interface AutoContentItem {
  id: string;
  tenant_id: string;
  type: AutoContentType;
  category: string | null;
  title: string;
  description: string | null;
  image_url: string | null;
  payload_json: Json | null;
  source: "mock" | "api" | "upload" | "manual";
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

export interface AutoContentSetting {
  id: string;
  tenant_id: string;
  module_type: AutoContentType;
  enabled: boolean;
  refresh_interval_minutes: number;
  last_fetch_at: string | null;
  created_at: string;
  updated_at: string;
  weather_state?: string | null;
  weather_city?: string | null;
  weather_country?: string | null;
}

interface UseAutoContentParams {
  type?: AutoContentType;
  category?: string | null;
  limit?: number;
}

interface ToggleModulePayload {
  moduleType: AutoContentType;
  enabled: boolean;
  refreshIntervalMinutes?: number;
}

interface GenerateNowPayload {
  moduleType: AutoContentType;
  refreshIntervalMinutes?: number;
}

interface UploadBirthdaysPayload {
  csv: string;
  fileName?: string;
}

export const useAutoContent = (params?: UseAutoContentParams) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: items = [],
    isLoading: isLoadingItems,
    error: itemsError,
    refetch: refetchItems,
  } = useQuery({
    queryKey: ["auto-content-items", params],
    queryFn: async () => {
      let query = (supabase as any)
        .from("auto_content_items")
        .select("*");

      if (params?.type) {
        query = query.eq("type", params.type);
      }

      if (params?.category) {
        query = query.eq("category", params.category);
      }

      if (params?.limit) {
        query = query.limit(params.limit);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as AutoContentItem[];
    },
  });

  const {
    data: settings = [],
    isLoading: isLoadingSettings,
    error: settingsError,
    refetch: refetchSettings,
  } = useQuery({
    queryKey: ["auto-content-settings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("auto_content_settings")
        .select("*")
        .order("module_type", { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as AutoContentSetting[];
    },
  });

  const toggleModule = useMutation({
    mutationFn: async ({
      moduleType,
      enabled,
      refreshIntervalMinutes,
    }: ToggleModulePayload) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Não autenticado");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auto-content-engine/toggle-module`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            module_type: moduleType,
            enabled,
            refresh_interval_minutes: refreshIntervalMinutes,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao atualizar módulo de conteúdo automático");
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-content-settings"] });
      toast({ title: "Módulo atualizado com sucesso" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar módulo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateNow = useMutation({
    mutationFn: async ({
      moduleType,
      refreshIntervalMinutes,
    }: GenerateNowPayload) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Não autenticado");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auto-content-engine/generate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            module_type: moduleType,
            refresh_interval_minutes: refreshIntervalMinutes,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao gerar conteúdo automático");
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-content-items"] });
      queryClient.invalidateQueries({ queryKey: ["auto-content-settings"] });
      toast({ title: "Conteúdo gerado com sucesso" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao gerar conteúdo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const uploadBirthdays = useMutation({
    mutationFn: async ({ csv, fileName }: UploadBirthdaysPayload) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Não autenticado");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auto-content-engine/upload-birthdays`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            csv,
            file_name: fileName,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao enviar CSV de aniversariantes");
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-content-items"] });
      toast({ title: "Aniversariantes processados com sucesso" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao enviar CSV",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    items,
    isLoadingItems,
    itemsError,
    settings,
    isLoadingSettings,
    settingsError,
    refetchItems,
    refetchSettings,
    toggleModule,
    generateNow,
    uploadBirthdays,
  };
};
