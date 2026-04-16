import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface GroupStore {
  id: string;
  group_id: string;
  store_id: string;
  created_at: string;
  store?: { id: string; name: string; code: string } | null;
}

export const useGroupStores = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: groupStores = [], isLoading } = useQuery({
    queryKey: ["group-stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_stores")
        .select(`
          *,
          store:stores(id, name, code)
        `)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as GroupStore[];
    },
  });

  const linkStore = useMutation({
    mutationFn: async ({ groupId, storeId }: { groupId: string; storeId: string }) => {
      const { data, error } = await supabase
        .from("group_stores")
        .insert([{ group_id: groupId, store_id: storeId }])
        .select(`*, store:stores(id, name, code)`)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-stores"] });
      toast({ title: "Loja vinculada ao grupo" });
    },
    onError: (error) => {
      const msg = error.message.includes("duplicate") ? "Loja já vinculada a este grupo" : error.message;
      toast({ title: "Erro ao vincular loja", description: msg, variant: "destructive" });
    },
  });

  const unlinkStore = useMutation({
    mutationFn: async ({ groupId, storeId }: { groupId: string; storeId: string }) => {
      const { error } = await supabase
        .from("group_stores")
        .delete()
        .eq("group_id", groupId)
        .eq("store_id", storeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-stores"] });
      toast({ title: "Loja desvinculada do grupo" });
    },
    onError: (error) => {
      toast({ title: "Erro ao desvincular loja", description: error.message, variant: "destructive" });
    },
  });

  const getStoresForGroup = (groupId: string) => {
    return groupStores.filter(gs => gs.group_id === groupId);
  };

  return { groupStores, isLoading, linkStore, unlinkStore, getStoresForGroup };
};
