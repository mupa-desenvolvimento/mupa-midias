import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserTenant } from "./useUserTenant";
import type { Json } from "@/integrations/supabase/types";

export interface Playlist {
  id: string;
  name: string;
  description: string | null;
  channel_id: string | null;
  is_active: boolean;
  schedule: Json | null;
  start_date: string | null;
  end_date: string | null;
  days_of_week: number[] | null;
  start_time: string | null;
  end_time: string | null;
  priority: number;
  fallback_media_id: string | null;
  has_channels: boolean;
  is_default: boolean;
  is_company_default: boolean;
  created_at: string;
  updated_at: string;
  tenant_id?: string | null;
}

export interface PlaylistWithChannel extends Playlist {
  channel?: { id: string; name: string; type: string } | null;
  item_count?: number;
}

export interface PlaylistInsert {
  name: string;
  description?: string | null;
  channel_id?: string | null;
  is_active?: boolean;
  schedule?: Json | null;
  start_date?: string | null;
  end_date?: string | null;
  days_of_week?: number[] | null;
  start_time?: string | null;
  end_time?: string | null;
  priority?: number;
  fallback_media_id?: string | null;
  has_channels?: boolean;
  is_default?: boolean;
  is_company_default?: boolean;
  tenant_id?: string | null;
}

export const usePlaylists = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tenantId, isSuperAdmin } = useUserTenant();

  const { data: playlists = [], isLoading, error } = useQuery({
    queryKey: ["playlists", tenantId, isSuperAdmin],
    queryFn: async () => {
      let query = supabase
        .from("playlists")
        .select(`
          *,
          channel:distribution_channels!playlists_distribution_channel_id_fkey(id, name, type)
        `)
        .order("created_at", { ascending: false });

      if (!isSuperAdmin && tenantId) {
        query = query.eq("tenant_id", tenantId);
      } else if (!isSuperAdmin) {
        return [] as PlaylistWithChannel[];
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PlaylistWithChannel[];
    },
  });

  const createPlaylist = useMutation({
    mutationFn: async (playlist: PlaylistInsert) => {
      const playlistData = { ...playlist };
      if (!isSuperAdmin && tenantId && !playlistData.tenant_id) {
        playlistData.tenant_id = tenantId;
      }

      const { data, error } = await supabase
        .from("playlists")
        .insert([playlistData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      toast({ title: "Playlist criada com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao criar playlist", description: error.message, variant: "destructive" });
    },
  });

  const updatePlaylist = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PlaylistInsert> & { id: string }) => {
      const { data, error } = await supabase
        .from("playlists")
        .update(updates)
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Playlist não encontrada ou sem permissão para editar");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      toast({ title: "Playlist atualizada com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar playlist", description: error.message, variant: "destructive" });
    },
  });

  const deletePlaylist = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("playlists").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      toast({ title: "Playlist excluída com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao excluir playlist", description: error.message, variant: "destructive" });
    },
  });

  return {
    playlists,
    isLoading,
    error,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
  };
};
