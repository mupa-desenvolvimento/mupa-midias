import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";

export interface PlaylistChannel {
  id: string;
  playlist_id: string;
  name: string;
  description: string | null;
  start_time: string;
  end_time: string;
  start_date: string | null;
  end_date: string | null;
  days_of_week: number[];
  position: number;
  is_fallback: boolean;
  is_active: boolean;
  metadata: Json | null;
  created_at: string;
  updated_at: string;
  item_count?: number;
}

export interface PlaylistChannelInsert {
  playlist_id: string;
  name: string;
  description?: string | null;
  start_time?: string;
  end_time?: string;
  start_date?: string | null;
  end_date?: string | null;
  days_of_week?: number[];
  position?: number;
  is_fallback?: boolean;
  is_active?: boolean;
  metadata?: Json | null;
}

export interface PlaylistChannelItem {
  id: string;
  channel_id: string;
  media_id: string;
  position: number;
  global_position: number;
  duration_override: number | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  days_of_week: number[] | null;
  is_schedule_override: boolean;
  created_at: string;
  media?: {
    id: string;
    name: string;
    type: string;
    file_url: string | null;
    thumbnail_url: string | null;
    duration: number | null;
    file_size: number | null;
    resolution: string | null;
    status: string;
  };
}

export interface PlaylistChannelItemInsert {
  channel_id: string;
  media_id: string;
  position: number;
  global_position?: number;
  duration_override?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  days_of_week?: number[] | null;
  is_schedule_override?: boolean;
}

export interface PlaylistChannelWithItems extends PlaylistChannel {
  items: PlaylistChannelItem[];
}

export const usePlaylistChannels = (playlistId: string | null) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: channels = [], isLoading, error } = useQuery({
    queryKey: ["playlist-channels", playlistId],
    queryFn: async () => {
      if (!playlistId) return [];
      
      const { data, error } = await supabase
        .from("playlist_channels")
        .select(`
          *,
          playlist_channel_items(count)
        `)
        .eq("playlist_id", playlistId)
        .order("position", { ascending: true });

      if (error) throw error;
      
      return (data || []).map(channel => ({
        ...channel,
        days_of_week: channel.days_of_week || [0, 1, 2, 3, 4, 5, 6],
        item_count: channel.playlist_channel_items?.[0]?.count || 0,
      })) as PlaylistChannel[];
    },
    enabled: !!playlistId,
  });

  // Fetch channels with their items for timeline display
  const { data: channelsWithItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["playlist-channels-with-items", playlistId],
    queryFn: async () => {
      if (!playlistId) return [];
      
      // First get all channels
      const { data: channelsData, error: channelsError } = await supabase
        .from("playlist_channels")
        .select("*")
        .eq("playlist_id", playlistId)
        .order("position", { ascending: true });

      if (channelsError) throw channelsError;
      if (!channelsData || channelsData.length === 0) return [];

      // Then get all items for these channels
      const channelIds = channelsData.map(c => c.id);
      const { data: itemsData, error: itemsError } = await supabase
        .from("playlist_channel_items")
        .select(`
          *,
          media:media_items(id, name, type, file_url, thumbnail_url, duration, file_size, resolution, status)
        `)
        .in("channel_id", channelIds)
        .order("position", { ascending: true });

      if (itemsError) throw itemsError;

      // Group items by channel
      const itemsByChannel = (itemsData || []).reduce((acc, item) => {
        if (!acc[item.channel_id]) {
          acc[item.channel_id] = [];
        }
        acc[item.channel_id].push(item);
        return acc;
      }, {} as Record<string, PlaylistChannelItem[]>);

      return channelsData.map(channel => ({
        ...channel,
        days_of_week: channel.days_of_week || [0, 1, 2, 3, 4, 5, 6],
        item_count: itemsByChannel[channel.id]?.length || 0,
        items: itemsByChannel[channel.id] || [],
      })) as PlaylistChannelWithItems[];
    },
    enabled: !!playlistId,
  });

  const createChannel = useMutation({
    mutationFn: async (channel: PlaylistChannelInsert) => {
      const { data, error } = await supabase
        .from("playlist_channels")
        .insert([channel])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlist-channels", playlistId] });
      toast({ title: "Campanha criada com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao criar campanha", description: error.message, variant: "destructive" });
    },
  });

  const updateChannel = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PlaylistChannelInsert> & { id: string }) => {
      const { data, error } = await supabase
        .from("playlist_channels")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlist-channels", playlistId] });
      toast({ title: "Campanha atualizada com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar campanha", description: error.message, variant: "destructive" });
    },
  });

  const deleteChannel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("playlist_channels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlist-channels", playlistId] });
      toast({ title: "Campanha excluída com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao excluir campanha", description: error.message, variant: "destructive" });
    },
  });

  const reorderChannels = useMutation({
    mutationFn: async (orderedChannels: { id: string; position: number }[]) => {
      const promises = orderedChannels.map(({ id, position }) =>
        supabase.from("playlist_channels").update({ position }).eq("id", id)
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlist-channels", playlistId] });
    },
    onError: (error) => {
      toast({ title: "Erro ao reordenar campanhas", description: error.message, variant: "destructive" });
    },
  });

  // Check which channel is currently active based on time
  const getActiveChannel = (): PlaylistChannel | null => {
    if (channels.length === 0) return null;
    
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.toTimeString().slice(0, 5);
    
    // Find channel that matches current time and day
    const activeChannel = channels.find(channel => {
      if (!channel.is_active) return false;
      if (!channel.days_of_week.includes(currentDay)) return false;
      
      const startTime = channel.start_time.slice(0, 5);
      const endTime = channel.end_time.slice(0, 5);
      
      // Handle overnight schedules
      if (startTime > endTime) {
        return currentTime >= startTime || currentTime <= endTime;
      }
      
      return currentTime >= startTime && currentTime <= endTime;
    });
    
    // If no active channel, return fallback
    if (!activeChannel) {
      return channels.find(c => c.is_fallback && c.is_active) || null;
    }
    
    return activeChannel;
  };

  // Global reorder items across all channels
  const reorderGlobalItems = useMutation({
    mutationFn: async (updates: { itemId: string; channelId: string; position: number }[]) => {
      // Update global_position for all items
      const promises = updates.map(({ itemId, position }) =>
        supabase
          .from("playlist_channel_items")
          .update({ global_position: position })
          .eq("id", itemId)
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlist-channels", playlistId] });
      queryClient.invalidateQueries({ queryKey: ["playlist-channels-with-items", playlistId] });
      toast({ title: "Ordem atualizada" });
    },
    onError: (error) => {
      toast({ title: "Erro ao reordenar mídias", description: error.message, variant: "destructive" });
    },
  });

  // Update a channel item (for settings dialog)
  const updateChannelItem = useMutation({
    mutationFn: async ({ id, ...updates }: { 
      id: string;
      duration_override?: number;
      is_schedule_override?: boolean;
      start_date?: string | null;
      end_date?: string | null;
      start_time?: string | null;
      end_time?: string | null;
      days_of_week?: number[] | null;
    }) => {
      const { data, error } = await supabase
        .from("playlist_channel_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlist-channels", playlistId] });
      queryClient.invalidateQueries({ queryKey: ["playlist-channels-with-items", playlistId] });
      toast({ title: "Configurações salvas" });
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar item", description: error.message, variant: "destructive" });
    },
  });

  return {
    channels,
    channelsWithItems,
    isLoading,
    isLoadingWithItems: itemsLoading,
    error,
    createChannel,
    updateChannel,
    deleteChannel,
    reorderChannels,
    reorderGlobalItems,
    updateChannelItem,
    getActiveChannel,
  };
};

export const usePlaylistChannelItems = (channelId: string | null) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ["playlist-channel-items", channelId],
    queryFn: async () => {
      if (!channelId) return [];
      
      const { data, error } = await supabase
        .from("playlist_channel_items")
        .select(`
          *,
          media:media_items(id, name, type, file_url, duration, file_size, resolution, status)
        `)
        .eq("channel_id", channelId)
        .order("position", { ascending: true });

      if (error) throw error;
      return data as PlaylistChannelItem[];
    },
    enabled: !!channelId,
  });

  const addItem = useMutation({
    mutationFn: async (item: PlaylistChannelItemInsert) => {
      // Get max global_position for this playlist to add at the end
      const { data: existingItems } = await supabase
        .from("playlist_channel_items")
        .select("global_position, playlist_channels!inner(playlist_id)")
        .eq("playlist_channels.playlist_id", item.channel_id.split('-')[0] !== item.channel_id ? undefined : undefined);
      
      // Get the channel's playlist_id first
      const { data: channelData } = await supabase
        .from("playlist_channels")
        .select("playlist_id")
        .eq("id", item.channel_id)
        .single();
      
      let maxGlobalPosition = -1;
      if (channelData?.playlist_id) {
        const { data: allItems } = await supabase
          .from("playlist_channel_items")
          .select("global_position, playlist_channels!inner(playlist_id)")
          .eq("playlist_channels.playlist_id", channelData.playlist_id);
        
        if (allItems && allItems.length > 0) {
          maxGlobalPosition = Math.max(...allItems.map(i => i.global_position ?? 0));
        }
      }
      
      const itemWithGlobalPosition = {
        ...item,
        global_position: item.global_position ?? maxGlobalPosition + 1,
      };

      const { data, error } = await supabase
        .from("playlist_channel_items")
        .insert([itemWithGlobalPosition])
        .select(`
          *,
          media:media_items(id, name, type, file_url, duration, file_size, resolution, status)
        `)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlist-channel-items", channelId] });
      queryClient.invalidateQueries({ queryKey: ["playlist-channels"] });
      queryClient.invalidateQueries({ queryKey: ["playlist-channels-with-items"] });
      toast({ title: "Mídia adicionada à campanha" });
    },
    onError: (error) => {
      toast({ title: "Erro ao adicionar mídia", description: error.message, variant: "destructive" });
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PlaylistChannelItemInsert> & { id: string }) => {
      const { data, error } = await supabase
        .from("playlist_channel_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlist-channel-items", channelId] });
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar item", description: error.message, variant: "destructive" });
    },
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("playlist_channel_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlist-channel-items", channelId] });
      queryClient.invalidateQueries({ queryKey: ["playlist-channels"] });
      queryClient.invalidateQueries({ queryKey: ["playlist-channels-with-items"] });
      toast({ title: "Mídia removida da campanha" });
    },
    onError: (error) => {
      toast({ title: "Erro ao remover mídia", description: error.message, variant: "destructive" });
    },
  });

  const reorderItems = useMutation({
    mutationFn: async (orderedItems: { id: string; position: number }[]) => {
      const promises = orderedItems.map(({ id, position }) =>
        supabase.from("playlist_channel_items").update({ position }).eq("id", id)
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlist-channel-items", channelId] });
      queryClient.invalidateQueries({ queryKey: ["playlist-channels-with-items"] });
    },
    onError: (error) => {
      toast({ title: "Erro ao reordenar itens", description: error.message, variant: "destructive" });
    },
  });

  const getTotalDuration = () => {
    return items.reduce((total, item) => {
      const duration = item.duration_override || item.media?.duration || 8;
      return total + duration;
    }, 0);
  };

  return {
    items,
    isLoading,
    error,
    addItem,
    updateItem,
    removeItem,
    reorderItems,
    getTotalDuration,
  };
};
