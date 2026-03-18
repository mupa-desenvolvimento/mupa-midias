import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserTenant } from "./useUserTenant";

export interface DeviceGroup {
  id: string;
  name: string;
  description: string | null;
  store_id: string | null;
  tenant_id: string | null;
  screen_type: string;
  created_at: string;
  updated_at: string;
}

export interface DeviceGroupWithDetails extends DeviceGroup {
  store?: { id: string; name: string; code: string } | null;
  tenant?: { id: string; name: string } | null;
  device_count?: number;
  channel_count?: number;
}

export interface DeviceGroupInsert {
  name: string;
  description?: string | null;
  store_id?: string | null;
  tenant_id?: string | null;
  screen_type?: string;
}

export interface DeviceGroupChannel {
  id: string;
  group_id: string;
  distribution_channel_id: string;
  position: number;
  created_at: string;
  channel?: { id: string; name: string; type: string };
}

export const useDeviceGroups = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tenantId, isSuperAdmin } = useUserTenant();

  const { data: deviceGroups = [], isLoading, error } = useQuery({
    queryKey: ["device-groups", tenantId, isSuperAdmin],
    queryFn: async () => {
      let query = supabase
        .from("device_groups")
        .select(`
          *,
          store:stores(id, name, code),
          tenant:tenants(id, name)
        `)
        .order("name", { ascending: true });

      if (!isSuperAdmin && tenantId) {
        query = query.eq("tenant_id", tenantId);
      } else if (!isSuperAdmin) {
        return [] as DeviceGroupWithDetails[];
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as DeviceGroupWithDetails[];
    },
  });

  const createDeviceGroup = useMutation({
    mutationFn: async (group: DeviceGroupInsert) => {
      const groupData = { ...group };
      if (!isSuperAdmin && tenantId && !groupData.tenant_id) {
        groupData.tenant_id = tenantId;
      }

      const { data, error } = await supabase
        .from("device_groups")
        .insert([groupData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["device-groups"] });
      toast({ title: "Grupo criado com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao criar grupo", description: error.message, variant: "destructive" });
    },
  });

  const updateDeviceGroup = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DeviceGroupInsert> & { id: string }) => {
      const { data, error } = await supabase
        .from("device_groups")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["device-groups"] });
      toast({ title: "Grupo atualizado com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar grupo", description: error.message, variant: "destructive" });
    },
  });

  const deleteDeviceGroup = useMutation({
    mutationFn: async (id: string) => {
      const { error: channelsError } = await supabase
        .from("device_group_channels")
        .delete()
        .eq("group_id", id);
      if (channelsError) throw channelsError;

      const { error: membersError } = await supabase
        .from("device_group_members")
        .delete()
        .eq("group_id", id);
      if (membersError) throw membersError;

      const { error: groupError } = await supabase
        .from("device_groups")
        .delete()
        .eq("id", id);
      if (groupError) throw groupError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["device-groups"] });
      toast({ title: "Grupo excluído com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao excluir grupo", description: error.message, variant: "destructive" });
    },
  });

  const getGroupChannels = async (groupId: string) => {
    const { data, error } = await supabase
      .from("device_group_channels")
      .select(`
        *,
        channel:distribution_channels(id, name, type)
      `)
      .eq("group_id", groupId)
      .order("position", { ascending: true });

    if (error) throw error;
    return data as DeviceGroupChannel[];
  };

  const assignChannelToGroup = useMutation({
    mutationFn: async ({ groupId, channelId, position }: { groupId: string; channelId: string; position: number }) => {
      const { data, error } = await supabase
        .from("device_group_channels")
        .insert([{ group_id: groupId, distribution_channel_id: channelId, position }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["device-groups"] });
      queryClient.invalidateQueries({ queryKey: ["device-group-channels"] });
      toast({ title: "Canal atribuído ao grupo" });
    },
    onError: (error) => {
      toast({ title: "Erro ao atribuir canal", description: error.message, variant: "destructive" });
    },
  });

  const removeChannelFromGroup = useMutation({
    mutationFn: async ({ groupId, channelId }: { groupId: string; channelId: string }) => {
      const { error } = await supabase
        .from("device_group_channels")
        .delete()
        .eq("group_id", groupId)
        .eq("distribution_channel_id", channelId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["device-groups"] });
      queryClient.invalidateQueries({ queryKey: ["device-group-channels"] });
      toast({ title: "Canal removido do grupo" });
    },
    onError: (error) => {
      toast({ title: "Erro ao remover canal", description: error.message, variant: "destructive" });
    },
  });

  return {
    deviceGroups,
    isLoading,
    error,
    createDeviceGroup,
    updateDeviceGroup,
    deleteDeviceGroup,
    getGroupChannels,
    assignChannelToGroup,
    removeChannelFromGroup,
  };
};
