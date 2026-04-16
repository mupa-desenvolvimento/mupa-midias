import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserTenant } from "./useUserTenant";

export interface StoreInternalGroup {
  id: string;
  store_id: string;
  tenant_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  store?: { id: string; name: string; code: string } | null;
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
        .select(`*, store:stores(id, name, code)`)
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
    mutationFn: async (group: { name: string; store_id: string; tenant_id?: string }) => {
      const groupData = { ...group };
      if (!isSuperAdmin && tenantId && !groupData.tenant_id) {
        groupData.tenant_id = tenantId;
      }
      const { data, error } = await supabase
        .from("store_internal_groups")
        .insert([groupData])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-internal-groups"] });
      toast({ title: "Grupo interno criado com sucesso" });
    },
    onError: (error) => {
      const msg = error.message.includes("duplicate") ? "Já existe um grupo com este nome nesta loja" : error.message;
      toast({ title: "Erro ao criar grupo interno", description: msg, variant: "destructive" });
    },
  });

  const createBulkInternalGroups = useMutation({
    mutationFn: async ({ name, storeIds, tenantIdOverride }: { name: string; storeIds: string[]; tenantIdOverride?: string }) => {
      const tid = tenantIdOverride || tenantId;
      const rows = storeIds.map(store_id => ({ name, store_id, tenant_id: tid! }));
      const { data, error } = await supabase
        .from("store_internal_groups")
        .upsert(rows, { onConflict: "store_id,name" })
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["store-internal-groups"] });
      toast({ title: `Grupo interno criado em ${data.length} loja(s)` });
    },
    onError: (error) => {
      toast({ title: "Erro ao criar grupos em massa", description: error.message, variant: "destructive" });
    },
  });

  const deleteInternalGroup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("store_internal_groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-internal-groups"] });
      queryClient.invalidateQueries({ queryKey: ["global-group-targets"] });
      toast({ title: "Grupo interno excluído" });
    },
    onError: (error) => {
      toast({ title: "Erro ao excluir grupo interno", description: error.message, variant: "destructive" });
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
      toast({ title: "Dispositivo vinculado ao grupo interno" });
    },
    onError: (error) => {
      const msg = error.message.includes("duplicate") ? "Dispositivo já vinculado" : error.message;
      toast({ title: "Erro ao vincular", description: msg, variant: "destructive" });
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
      toast({ title: "Dispositivo desvinculado" });
    },
    onError: (error) => {
      toast({ title: "Erro ao desvincular", description: error.message, variant: "destructive" });
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
      toast({ title: "Grupo interno vinculado ao grupo global" });
    },
    onError: (error) => {
      const msg = error.message.includes("duplicate") ? "Já vinculado" : error.message;
      toast({ title: "Erro ao vincular", description: msg, variant: "destructive" });
    },
  });

  const removeGlobalGroupTarget = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("global_group_targets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["global-group-targets"] });
      toast({ title: "Vínculo removido" });
    },
    onError: (error) => {
      toast({ title: "Erro ao remover vínculo", description: error.message, variant: "destructive" });
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
