import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserTenant } from "./useUserTenant";

export interface Group {
  id: string;
  name: string;
  parent_id: string | null;
  playlist_id: string | null;
  tenant_id: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface GroupWithDetails extends Group {
  playlist?: { id: string; name: string } | null;
  children?: GroupWithDetails[];
}

export const useGroups = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tenantId, isSuperAdmin } = useUserTenant();

  const { data: groups = [], isLoading, error } = useQuery({
    queryKey: ["groups", tenantId, isSuperAdmin],
    queryFn: async () => {
      let query = supabase
        .from("groups")
        .select(`
          *,
          playlist:playlists(id, name)
        `)
        .order("name", { ascending: true });

      if (!isSuperAdmin && tenantId) {
        query = query.eq("tenant_id", tenantId);
      } else if (!isSuperAdmin) {
        return [] as GroupWithDetails[];
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as GroupWithDetails[];
    },
    enabled: !!tenantId || isSuperAdmin,
  });

  const createGroup = useMutation({
    mutationFn: async (group: { name: string; parent_id?: string | null; playlist_id?: string | null; tenant_id?: string | null }) => {
      const groupData = { ...group };
      if (!isSuperAdmin && tenantId && !groupData.tenant_id) {
        groupData.tenant_id = tenantId;
      }

      const { data, error } = await supabase
        .from("groups")
        .insert([groupData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast({ title: "Grupo criado com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao criar grupo", description: error.message, variant: "destructive" });
    },
  });

  const updateGroup = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Group> & { id: string }) => {
      const { data, error } = await supabase
        .from("groups")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast({ title: "Grupo atualizado com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar grupo", description: error.message, variant: "destructive" });
    },
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("groups")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast({ title: "Grupo excluído com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao excluir grupo", description: error.message, variant: "destructive" });
    },
  });

  return {
    groups,
    isLoading,
    error,
    createGroup,
    updateGroup,
    deleteGroup,
  };
};
