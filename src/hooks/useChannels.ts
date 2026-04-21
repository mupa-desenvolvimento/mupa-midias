import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";

export interface Channel {
  id: string;
  name: string;
  description: string | null;
  type: string;
  source: string;
  priority: number;
  is_active: boolean;
  metadata: Json | null;
  fallback_playlist_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChannelInsert {
  name: string;
  description?: string | null;
  type?: string;
  source?: string;
  priority?: number;
  is_active?: boolean;
  metadata?: Json | null;
  fallback_playlist_id?: string | null;
}

export const useChannels = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: channels = [], isLoading, error } = useQuery({
    queryKey: ["distribution-channels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("distribution_channels")
        .select("*")
        .order("priority", { ascending: true });

      if (error) throw error;
      return data as Channel[];
    },
  });

  const createChannel = useMutation({
    mutationFn: async (channel: ChannelInsert) => {
      const { data, error } = await supabase
        .from("distribution_channels")
        .insert([channel])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["distribution-channels"] });
      toast({ title: "Campanha criada com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao criar campanha", description: error.message, variant: "destructive" });
    },
  });

  const updateChannel = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ChannelInsert> & { id: string }) => {
      const { data, error } = await supabase
        .from("distribution_channels")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["distribution-channels"] });
      toast({ title: "Campanha atualizada com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar campanha", description: error.message, variant: "destructive" });
    },
  });

  const deleteChannel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("distribution_channels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["distribution-channels"] });
      toast({ title: "Campanha excluída com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao excluir campanha", description: error.message, variant: "destructive" });
    },
  });

  return {
    channels,
    isLoading,
    error,
    createChannel,
    updateChannel,
    deleteChannel,
  };
};
