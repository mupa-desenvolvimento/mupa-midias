import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserTenant } from "./useUserTenant";

export interface StoreInternalGroup {
  id: string;
  store_id: string;
  tenant_id: string;
  name: string;
  playlist_id: string | null;
  created_at: string;
  updated_at: string;
  store?: { id: string; name: string; code: string } | null;
  playlist?: { id: string; name: string } | null;
}

export interface InternalGroupDevice {
  id: string;
  internal_group_id: string;
  device_id: string;
  created_at: string;
  device?: { id: string; name: string; device_code: string; status: string } | null;
}

export interface GlobalGroupTarget {
  id: string;
  group_id: string;
  store_internal_group_id: string;
  created_at: string;
  store_internal_group?: StoreInternalGroup | null;
}

export const useStoreInternalGroups = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tenantId, isSuperAdmin } = useUserTenant();

  const { data: internalGroups = [], isLoading } = useQuery({
    queryKey: ["store-internal-groups", tenantId, isSuperAdmin],
    queryFn: async () => {
      let query = supabase
        .from("store_internal_groups")
        .select(`
          *,
          store:stores(id, name, code),
          playlist:playlists(id, name)
        `)
        .order("name");

      if (!isSuperAdmin && tenantId) {
        query = query.eq("tenant_id", tenantId);
      } else if (!isSuperAdmin) {
        return [] as StoreInternalGroup[];
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as StoreInternalGroup[];
    },
    enabled: !!tenantId || isSuperAdmin,
  });

  const { data: internalGroupDevices = [] } = useQuery({
    queryKey: ["store-internal-group-devices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_internal_group_devices")
        .select(`*, device:devices(id, name, device_code, status)`)
        .order("created_at");

      if (error) throw error;
      return data as InternalGroupDevice[];
    },
  });

  const { data: globalGroupTargets = [] } = useQuery({
    queryKey: ["global-group-targets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("global_group_targets")
        .select(`*, store_internal_group:store_internal_groups(*, store:stores(id, name, code))`)
        .order("created_at");

      if (error) throw error;
      return data as GlobalGroupTarget[];
    },
  });

  const createInternalGroup = useMutation({
    mutationFn: async (group: { name: string; store_id: string; playlist_id?: string | null; tenant_id?: string }) => {
      const tid = group.tenant_id || tenantId;
      if (!tid) throw new Error("tenant_id é obrigatório");
      const { data, error } = await supabase
        .from("store_internal_groups")
        .insert([{ 
          name: group.name, 
          store_id: group.store_id, 
          playlist_id: group.playlist_id,
          tenant_id: tid 
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-internal-groups"] });
      toast({ title: "Setor criado com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao criar setor", description: error.message, variant: "destructive" });
    },
  });

  const updateInternalGroup = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<StoreInternalGroup> & { id: string }) => {
      const { data, error } = await supabase
        .from("store_internal_groups")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-internal-groups"] });
      toast({ title: "Setor atualizado com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar setor", description: error.message, variant: "destructive" });
    },
  });

  const createBulkInternalGroups = useMutation({
    mutationFn: async (group: { name: string; storeIds: string[] }) => {
      const tid = tenantId;
      if (!tid) throw new Error("tenant_id é obrigatório");
      const inserts = group.storeIds.map(sid => ({ name: group.name, store_id: sid, tenant_id: tid }));
      const { data, error } = await supabase
        .from("store_internal_groups")
        .insert(inserts)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-internal-groups"] });
      toast({ title: "Setores criados em massa com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao criar setores", description: error.message, variant: "destructive" });
    },
  });

  const deleteInternalGroup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("store_internal_groups")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-internal-groups"] });
      toast({ title: "Setor excluído com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao excluir setor", description: error.message, variant: "destructive" });
    },
  });

  const linkDeviceToInternalGroup = useMutation({
    mutationFn: async ({ internalGroupId, deviceId }: { internalGroupId: string; deviceId: string }) => {
      const { data, error } = await supabase
        .from("store_internal_group_devices")
        .insert([{ internal_group_id: internalGroupId, device_id: deviceId }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-internal-group-devices"] });
      toast({ title: "Dispositivo vinculado ao setor" });
    },
    onError: (error) => {
      toast({ title: "Erro ao vincular dispositivo", description: error.message, variant: "destructive" });
    },
  });

  const unlinkDeviceFromInternalGroup = useMutation({
    mutationFn: async ({ internalGroupId, deviceId }: { internalGroupId: string; deviceId: string }) => {
      const { error } = await supabase
        .from("store_internal_group_devices")
        .delete()
        .eq("internal_group_id", internalGroupId)
        .eq("device_id", deviceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-internal-group-devices"] });
      toast({ title: "Dispositivo removido do setor" });
    },
    onError: (error) => {
      toast({ title: "Erro ao remover dispositivo", description: error.message, variant: "destructive" });
    },
  });

  const addGlobalGroupTarget = useMutation({
    mutationFn: async ({ groupId, storeInternalGroupId }: { groupId: string; storeInternalGroupId: string }) => {
      const { data, error } = await supabase
        .from("global_group_targets")
        .insert([{ group_id: groupId, store_internal_group_id: storeInternalGroupId }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["global-group-targets"] });
      toast({ title: "Setor vinculado ao grupo" });
    },
    onError: (error) => {
      toast({ title: "Erro ao vincular setor", description: error.message, variant: "destructive" });
    },
  });

  const removeGlobalGroupTarget = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("global_group_targets")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["global-group-targets"] });
      toast({ title: "Setor removido do grupo" });
    },
    onError: (error) => {
      toast({ title: "Erro ao remover setor", description: error.message, variant: "destructive" });
    },
  });

  const getDevicesForInternalGroup = (internalGroupId: string) =>
    internalGroupDevices.filter(d => d.internal_group_id === internalGroupId);

  const getTargetsForGlobalGroup = (groupId: string) =>
    globalGroupTargets.filter(t => t.group_id === groupId);

  const getInternalGroupsForStore = (storeId: string) =>
    internalGroups.filter(g => g.store_id === storeId);

  return {
    internalGroups,
    internalGroupDevices,
    globalGroupTargets,
    isLoading,
    createInternalGroup,
    updateInternalGroup,
    createBulkInternalGroups,
    deleteInternalGroup,
    linkDeviceToInternalGroup,
    unlinkDeviceFromInternalGroup,
    addGlobalGroupTarget,
    removeGlobalGroupTarget,
    getDevicesForInternalGroup,
    getTargetsForGlobalGroup,
    getInternalGroupsForStore,
  };
};
