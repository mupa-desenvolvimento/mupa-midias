import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserTenant } from "./useUserTenant";
import type { Json } from "@/integrations/supabase/types";

export interface Device {
  id: string;
  device_code: string;
  name: string;
  store_id: string | null;
  company_id: string | null;
  display_profile_id: string | null;
  current_playlist_id: string | null;
  price_integration_id: string | null;
  api_integration_id: string | null;
  price_integration_enabled?: boolean;
  status: string;
  last_seen_at: string | null;
  resolution: string | null;
  camera_enabled: boolean;
  metadata: Json | null;
  is_active: boolean;
  is_blocked: boolean;
  blocked_message: string | null;
  override_media_id: string | null;
  override_media_expires_at: string | null;
  last_sync_requested_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeviceWithRelations extends Device {
  store?: { id: string; name: string; code: string } | null;
  company?: { id: string; name: string; slug: string } | null;
  display_profile?: { id: string; name: string; resolution: string } | null;
  current_playlist?: { id: string; name: string } | null;
  price_check_integration?: { id: string; name: string } | null;
  api_integration?: { id: string; name: string } | null;
}

export interface DeviceInsert {
  device_code: string;
  name: string;
  store_id?: string | null;
  company_id?: string | null;
  display_profile_id?: string | null;
  current_playlist_id?: string | null;
  price_integration_id?: string | null;
  api_integration_id?: string | null;
  status?: string;
  resolution?: string | null;
  camera_enabled?: boolean;
  metadata?: Json | null;
}

export interface DeviceUpdate {
  name?: string;
  store_id?: string | null;
  company_id?: string | null;
  display_profile_id?: string | null;
  current_playlist_id?: string | null;
  price_integration_id?: string | null;
  api_integration_id?: string | null;
  price_integration_enabled?: boolean;
  status?: string;
  resolution?: string | null;
  camera_enabled?: boolean;
  metadata?: Json | null;
  is_active?: boolean;
}

export const useDevices = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tenantId, companyId, isSuperAdmin } = useUserTenant();

  const { data: devices = [], isLoading, error, refetch } = useQuery({
    queryKey: ["devices", tenantId, isSuperAdmin],
    queryFn: async () => {
      const fullSelect = `
        *,
        store:stores(id, name, code),
        company:companies(id, name, slug),
        display_profile:display_profiles(id, name, resolution),
        current_playlist:playlists(id, name),
        price_check_integration:price_check_integrations(id, name),
        api_integration:api_integrations(id, name)
      `;

      const fallbackSelectV2 = `
        id, device_code, name, store_id, company_id, display_profile_id, current_playlist_id,
        price_integration_id, api_integration_id, price_integration_enabled,
        status, last_seen_at, resolution, camera_enabled, metadata, is_active, is_blocked,
        blocked_message, override_media_id, override_media_expires_at, last_sync_requested_at,
        created_at, updated_at,
        store:stores(id, name, code),
        company:companies(id, name, slug),
        display_profile:display_profiles(id, name, resolution),
        current_playlist:playlists(id, name)
      `;

      const fallbackSelect = `
        id, device_code, name, store_id, company_id, display_profile_id, current_playlist_id,
        status, last_seen_at, resolution, camera_enabled, metadata, is_active, is_blocked,
        blocked_message, override_media_id, override_media_expires_at, last_sync_requested_at,
        created_at, updated_at,
        store:stores(id, name, code),
        company:companies(id, name, slug),
        display_profile:display_profiles(id, name, resolution),
        current_playlist:playlists(id, name)
      `;

      // Get all company IDs for the tenant to filter devices properly
      let tenantCompanyIds: string[] = [];
      if (!isSuperAdmin && tenantId) {
        const { data: companies } = await supabase
          .from("companies")
          .select("id")
          .eq("tenant_id", tenantId);
        tenantCompanyIds = (companies || []).map(c => c.id);
        if (tenantCompanyIds.length === 0) return [] as DeviceWithRelations[];
      }

      const buildQuery = (select: string) => {
        let query = supabase
          .from("devices")
          .select(select)
          .order("created_at", { ascending: false });

        // Filter by ALL companies belonging to the tenant
        if (!isSuperAdmin && tenantCompanyIds.length > 0) {
          query = query.in("company_id", tenantCompanyIds);
        } else if (!isSuperAdmin) {
          // No tenant = no devices
          return null;
        }

        return query;
      };

      let data: any[] | null = null;
      let queryError: any = null;

      const full = await buildQuery(fullSelect);
      data = full.data as any[] | null;
      queryError = full.error;

      if (queryError) {
        const msg = String(queryError.message || "");
        const shouldFallback =
          msg.includes("schema cache") ||
          msg.includes("price_integration_id") ||
          msg.includes("price_integration_enabled") ||
          msg.includes("api_integration_id") ||
          msg.includes("price_check_integrations") ||
          msg.includes("api_integrations");

        if (shouldFallback) {
          const fallbackV2 = await buildQuery(fallbackSelectV2);

          if (fallbackV2.error) {
            const fallbackV1 = await buildQuery(fallbackSelect);
            data = fallbackV1.data as any[] | null;
            queryError = fallbackV1.error;
          } else {
            data = fallbackV2.data as any[] | null;
            queryError = null;
          }
        }
      }

      if (queryError) throw queryError;
      
      const transformedData = (data || []).map((device: any) => ({
        ...device,
        price_check_integration: Array.isArray(device.price_check_integration) 
          ? device.price_check_integration[0] 
          : device.price_check_integration,
        api_integration: Array.isArray(device.api_integration)
          ? device.api_integration[0]
          : device.api_integration
      }));

      return transformedData as DeviceWithRelations[];
    },
  });

  const createDevice = useMutation({
    mutationFn: async (device: DeviceInsert) => {
      // Auto-assign company_id if not set
      const deviceData = { ...device };
      if (!isSuperAdmin && companyId && !deviceData.company_id) {
        deviceData.company_id = companyId;
      }

      const { data, error } = await supabase
        .from("devices")
        .insert([deviceData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      toast({ title: "Dispositivo criado com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao criar dispositivo", description: error.message, variant: "destructive" });
    },
  });

  const updateDevice = useMutation({
    mutationFn: async ({ id, ...updates }: DeviceUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("devices")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, ...updates }) => {
      await queryClient.cancelQueries({ queryKey: ["devices"] });
      const previous = queryClient.getQueryData<DeviceWithRelations[]>(["devices"]);
      if (previous) {
        queryClient.setQueryData<DeviceWithRelations[]>(
          ["devices"],
          previous.map((d) => (d.id === id ? ({ ...d, ...updates } as any) : d)),
        );
      }
      return { previous };
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<DeviceWithRelations[]>(["devices"], (current) => {
        if (!current) return current;
        return current.map((d) => (d.id === updated.id ? ({ ...d, ...(updated as any) } as any) : d));
      });
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      toast({ title: "Dispositivo atualizado com sucesso" });
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["devices"], ctx.previous);
      toast({ title: "Erro ao atualizar dispositivo", description: error.message, variant: "destructive" });
    },
  });

  const deleteDevice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("devices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      toast({ title: "Dispositivo excluído com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao excluir dispositivo", description: error.message, variant: "destructive" });
    },
  });

  return {
    devices,
    isLoading,
    error,
    refetch,
    createDevice,
    updateDevice,
    deleteDevice,
  };
};
