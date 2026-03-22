import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MediaItem {
  id: string;
  name: string;
  type: string;
  file_url: string | null;
  duration: number | null;
  metadata?: any;
}

export interface DevicePlayerData {
  device: {
    id: string;
    device_code: string;
    name: string;
    current_playlist_id: string | null;
    is_blocked: boolean;
    blocked_message: string | null;
    override_media_id: string | null;
    override_media_expires_at: string | null;
  } | null;
  playlist: {
    id: string;
    name: string;
    has_channels: boolean;
    content_scale: string | null;
  } | null;
  mediaItems: MediaItem[];
  overrideMedia: MediaItem | null;
}

export const useDevicePlayerData = (deviceCode: string | undefined) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["device-player-data", deviceCode],
    queryFn: async (): Promise<DevicePlayerData> => {
      if (!deviceCode) {
        return { device: null, playlist: null, mediaItems: [], overrideMedia: null };
      }

      // Fetch device by device_code
      const { data: device, error: deviceError } = await supabase
        .from("devices")
        .select(`
          id,
          device_code,
          name,
          current_playlist_id,
          is_blocked,
          blocked_message,
          override_media_id,
          override_media_expires_at
        `)
        .eq("device_code", deviceCode)
        .maybeSingle();

      if (deviceError) throw deviceError;
      if (!device) {
        return { device: null, playlist: null, mediaItems: [], overrideMedia: null };
      }

      // Check if there's an override media
      let overrideMedia: MediaItem | null = null;
      if (device.override_media_id) {
        const expiresAt = device.override_media_expires_at ? new Date(device.override_media_expires_at) : null;
        const isExpired = expiresAt && expiresAt < new Date();
        
        if (!isExpired) {
          const { data: overrideData } = await supabase
            .from("media_items")
            .select("id, name, type, file_url, duration, metadata")
            .eq("id", device.override_media_id)
            .maybeSingle();
          
          if (overrideData) {
            overrideMedia = overrideData;
          }
        }
      }

      // Try campaign engine first for dynamic playlist
      try {
        const { data: campaignData, error: campaignError } = await supabase.functions.invoke("campaign-engine", {
          body: null,
          method: "GET",
        });
        // The edge function expects GET with query param, use fetch directly
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const campaignRes = await fetch(
          `https://${projectId}.supabase.co/functions/v1/campaign-engine/playlist?device_code=${device.device_code}`,
          { headers: { "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
        );
        if (campaignRes.ok) {
          const campaignPlaylist = await campaignRes.json();
          if (campaignPlaylist.items && campaignPlaylist.items.length > 0) {
            const campaignMedia: MediaItem[] = campaignPlaylist.items.map((item: any) => ({
              id: item.media.id,
              name: item.media.name,
              type: item.media.type,
              file_url: item.media.file_url,
              duration: item.media.duration,
              metadata: item.media.metadata,
            }));
            return { device, playlist: { id: "campaign-dynamic", name: "Campanha Dinâmica", has_channels: false, content_scale: null }, mediaItems: campaignMedia, overrideMedia };
          }
        }
      } catch (e) {
        console.log("[Player] Campaign engine unavailable, falling back to playlist", e);
      }

      // Fallback: If no playlist assigned, return empty
      if (!device.current_playlist_id) {
        return { device, playlist: null, mediaItems: [], overrideMedia };
      }

      // Fetch playlist
      const { data: playlist, error: playlistError } = await supabase
        .from("playlists")
        .select("id, name, has_channels, content_scale")
        .eq("id", device.current_playlist_id)
        .maybeSingle();

      if (playlistError) throw playlistError;
      if (!playlist) {
        return { device, playlist: null, mediaItems: [], overrideMedia };
      }

      let mediaItems: MediaItem[] = [];

      if (playlist.has_channels) {
        // Playlist with channels - get active channel based on time
        const now = new Date();
        const currentDay = now.getDay();
        const currentTime = now.toTimeString().slice(0, 8); // HH:MM:SS

        // Fetch all channels for this playlist
        const { data: channels } = await supabase
          .from("playlist_channels")
          .select("*")
          .eq("playlist_id", playlist.id)
          .eq("is_active", true)
          .order("position", { ascending: true });

        if (channels && channels.length > 0) {
          const currentDateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
          
          // Find the active channel
          let activeChannel = channels.find(channel => {
            // Skip fallback channels in initial search
            if (channel.is_fallback) return false;
            
            // Check date range
            if (channel.start_date && currentDateStr < channel.start_date) return false;
            if (channel.end_date && currentDateStr > channel.end_date) return false;
            
            // Check days of week
            const daysOfWeek = channel.days_of_week || [0, 1, 2, 3, 4, 5, 6];
            if (!daysOfWeek.includes(currentDay)) return false;

            const startTime = channel.start_time;
            const endTime = channel.end_time;

            // Handle overnight schedules
            if (startTime > endTime) {
              return currentTime >= startTime || currentTime <= endTime;
            }

            return currentTime >= startTime && currentTime <= endTime;
          });

          // Fallback to fallback channel if no active channel
          if (!activeChannel) {
            activeChannel = channels.find(c => c.is_fallback);
          }

          if (activeChannel) {
            // Fetch items from the active channel
            const { data: channelItems } = await supabase
              .from("playlist_channel_items")
              .select(`
                id,
                position,
                duration_override,
                media:media_items(id, name, type, file_url, duration, metadata)
              `)
              .eq("channel_id", activeChannel.id)
              .order("position", { ascending: true });

            if (channelItems) {
              mediaItems = channelItems
                .filter(item => item.media)
                .map(item => ({
                  id: item.media!.id,
                  name: item.media!.name,
                  type: item.media!.type,
                  file_url: item.media!.file_url,
                  duration: item.duration_override || item.media!.duration,
                  metadata: (item.media as any)?.metadata,
                }));
            }
          }
        }
      } else {
        // Simple playlist without channels
        const { data: playlistItems } = await supabase
          .from("playlist_items")
          .select(`
            id,
            position,
            duration_override,
            media:media_items(id, name, type, file_url, duration, metadata)
          `)
          .eq("playlist_id", playlist.id)
          .order("position", { ascending: true });

        if (playlistItems) {
          mediaItems = playlistItems
            .filter(item => item.media)
            .map(item => ({
              id: item.media!.id,
              name: item.media!.name,
              type: item.media!.type,
              file_url: item.media!.file_url,
              duration: item.duration_override || item.media!.duration,
              metadata: (item.media as any)?.metadata,
            }));
        }
      }

      return { device, playlist, mediaItems, overrideMedia };
    },
    enabled: !!deviceCode,
    refetchInterval: 60000, // Fallback: refetch every 60 seconds
  });

  // Realtime subscriptions for instant updates
  useEffect(() => {
    if (!deviceCode) return;

    const invalidateQuery = () => {
      queryClient.invalidateQueries({ queryKey: ["device-player-data", deviceCode] });
    };

    // Subscribe to device changes (for override media, blocking, playlist changes)
    const devicesChannel = supabase
      .channel('device-player-devices')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'devices',
          filter: `device_code=eq.${deviceCode}`,
        },
        () => {
          console.log('[Realtime] Device updated, refreshing...');
          invalidateQuery();
        }
      )
      .subscribe();

    // Subscribe to playlists changes
    const playlistsChannel = supabase
      .channel('device-player-playlists')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'playlists',
        },
        () => {
          console.log('[Realtime] Playlist updated, refreshing...');
          invalidateQuery();
        }
      )
      .subscribe();

    // Subscribe to playlist_channels changes
    const channelsChannel = supabase
      .channel('device-player-channels')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'playlist_channels',
        },
        () => {
          console.log('[Realtime] Channel updated, refreshing...');
          invalidateQuery();
        }
      )
      .subscribe();

    // Subscribe to playlist_items changes
    const itemsChannel = supabase
      .channel('device-player-items')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'playlist_items',
        },
        () => {
          console.log('[Realtime] Playlist items updated, refreshing...');
          invalidateQuery();
        }
      )
      .subscribe();

    // Subscribe to playlist_channel_items changes
    const channelItemsChannel = supabase
      .channel('device-player-channel-items')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'playlist_channel_items',
        },
        () => {
          console.log('[Realtime] Channel items updated, refreshing...');
          invalidateQuery();
        }
      )
      .subscribe();

    // Subscribe to media_items changes
    const mediaChannel = supabase
      .channel('device-player-media')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'media_items',
        },
        () => {
          console.log('[Realtime] Media updated, refreshing...');
          invalidateQuery();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(devicesChannel);
      supabase.removeChannel(playlistsChannel);
      supabase.removeChannel(channelsChannel);
      supabase.removeChannel(itemsChannel);
      supabase.removeChannel(channelItemsChannel);
      supabase.removeChannel(mediaChannel);
    };
  }, [deviceCode, queryClient]);

  return query;
};
