import { supabase } from "@/integrations/supabase/client";
import { db } from "@/services/firebase";
import { ref, onValue, off } from "firebase/database";
import { offlineStorage } from "@/modules/offline-storage";
import { DeviceState, CachedPlaylist, CachedPlaylistItem, CachedChannel, OverrideMedia } from "@/modules/shared/types";

export class SyncService {
  private deviceCode: string | null = null;
  private firebaseRef: any = null;
  private onUpdateCallback: ((state: DeviceState) => void) | null = null;
  private onErrorCallback: ((error: Error) => void) | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  private retryCount = 0;
  private maxRetries = 3;

  init(deviceCode: string, onUpdate: (state: DeviceState) => void, onError?: (error: Error) => void) {
    this.deviceCode = deviceCode;
    this.onUpdateCallback = onUpdate;
    this.onErrorCallback = onError || null;
    this.retryCount = 0;
    this.startFirebaseListener();
    this.startHeartbeat();
    this.performFullSync();
  }

  cleanup() {
    this.stopHeartbeat();
    if (this.firebaseRef) {
      off(this.firebaseRef);
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.sendHeartbeat(); // Immediate first beat
    // Send heartbeat every 30 seconds
    this.heartbeatInterval = setInterval(() => this.sendHeartbeat(), 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private async sendHeartbeat() {
    if (!this.deviceCode) return;
    
    try {
      // Use RPC function to bypass RLS and ensure update
      const { error } = await (supabase as any).rpc('device_heartbeat', { 
        p_device_code: this.deviceCode 
      });

      if (error) {
        console.error("[SyncService] Heartbeat error:", error);
      } else {
        console.log("[SyncService] Heartbeat sent");
      }
    } catch (err) {
       console.error("[SyncService] Heartbeat exception:", err);
    }
  }

  private startFirebaseListener() {
    if (!this.deviceCode) return;
    
    console.log("[SyncService] Starting Firebase listener for", this.deviceCode);
    this.firebaseRef = ref(db, `/${this.deviceCode}`);
    
    onValue(this.firebaseRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        console.log("[SyncService] Firebase update received:", data);
        if (data.atualizacao_plataforma === "true" || data.force_sync === true) {
          console.log("[SyncService] Force sync requested via Firebase");
          this.performFullSync();
        }
      }
    });
  }

  async performFullSync(): Promise<DeviceState | null> {
    if (!this.deviceCode) return null;
    
    console.log("[SyncService] Performing full sync...");
    
    try {
      // 1. Fetch Device Data
      let device: any = null;
      
      // Try fetching via RPC first (bypasses RLS)
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_public_device_info', { p_device_code: this.deviceCode });

      if (!rpcError && rpcData && rpcData.length > 0) {
        const d = rpcData[0];
        device = {
          ...d,
          companies: { slug: d.company_slug },
          override_media: d.override_media_data
        };
      } else {
        if (rpcError && !rpcError.message?.includes('function not found')) {
             console.warn("[SyncService] RPC failed, falling back to direct select:", rpcError);
        }
        
        // Fallback: Direct select (may fail due to RLS)
        const { data: directData, error: directError } = await supabase
          .from("devices")
          .select(`
            id, name, store_id, current_playlist_id, company_id,
            is_blocked, blocked_message, camera_enabled,
            override_media_id, override_media_expires_at,
            last_sync_requested_at, store_code,
            companies(id, slug),
            override_media:media_items!devices_override_media_id_fkey(id, name, type, file_url, duration)
          `)
          .eq("device_code", this.deviceCode)
          .maybeSingle();

        if (directError) throw directError;
        device = directData;
      }

      if (!device) {
        throw new Error(`Dispositivo não encontrado: ${this.deviceCode}. Verifique se o código está correto e se o dispositivo foi cadastrado no painel.`);
      }

      // 2. Process Override Media
      let overrideMedia: OverrideMedia | null = null;
      const overrideMediaData = device.override_media as any;
      
      if (overrideMediaData && device.override_media_expires_at) {
        const expiresAt = new Date(device.override_media_expires_at);
        if (expiresAt > new Date()) {
          const localUrl = await offlineStorage.getMediaUrl(overrideMediaData.id, overrideMediaData.file_url);
          overrideMedia = {
            id: overrideMediaData.id,
            name: overrideMediaData.name,
            type: overrideMediaData.type,
            file_url: overrideMediaData.file_url,
            duration: overrideMediaData.duration || 10,
            expires_at: device.override_media_expires_at,
            blob_url: localUrl
          };
        }
      }

      // 3. Determine Relevant Playlists/Channels
      const relevantPlaylistIds: string[] = [];
      let relevantChannelIds: string[] = [];

      if (device.current_playlist_id) {
        relevantPlaylistIds.push(device.current_playlist_id);
      }

      // Check Group Memberships
      const { data: groupMembers, error: groupError } = await supabase
        .from("device_group_members")
        .select("group_id")
        .eq("device_id", device.id);

      if (groupError) throw groupError;

      if (groupMembers && groupMembers.length > 0) {
        const groupIds = groupMembers.map(g => g.group_id);
        const { data: groupChannels, error: channelsError } = await supabase
          .from("device_group_channels")
          .select("distribution_channel_id")
          .in("group_id", groupIds);

        if (channelsError) throw channelsError;

        if (groupChannels) {
          relevantChannelIds = groupChannels.map(c => c.distribution_channel_id);
        }
      }

      // 4. Fetch Playlists Content
    let playlistsData: any[] = [];

    if (relevantPlaylistIds.length > 0 || relevantChannelIds.length > 0) {
      console.log("[SyncService] Fetching playlists via RPC...");
      
      // Try RPC first (bypasses RLS for playlist items/media)
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_public_playlists_data', {
          p_playlist_ids: relevantPlaylistIds.length > 0 ? relevantPlaylistIds : null,
          p_channel_ids: relevantChannelIds.length > 0 ? relevantChannelIds : null
      });

      if (!rpcError) {
          playlistsData = Array.isArray(rpcData) ? (rpcData as any[]) : [];
      } else {
          console.warn("[SyncService] RPC get_public_playlists_data failed, falling back to direct select:", rpcError);
          
          // Fallback: Direct select (may fail due to RLS on items)
          const orConditions: string[] = [];

          if (relevantPlaylistIds.length > 0) {
            orConditions.push(`id.in.(${relevantPlaylistIds.join(',')})`);
          }
          
          if (relevantChannelIds.length > 0) {
            orConditions.push(`channel_id.in.(${relevantChannelIds.join(',')})`);
          }

          if (orConditions.length > 0) {
            console.log("[SyncService] Fetching playlists with conditions:", orConditions);
            
            const { data, error: playlistError } = await supabase
              .from("playlists")
              .select(`
                id, name, description, is_active, has_channels, channel_id,
                start_date, end_date, days_of_week, start_time, end_time, priority, content_scale,
                playlist_items(
                  id, media_id, position, duration_override,
                  start_date, end_date, start_time, end_time, days_of_week,
                  media:media_items(id, name, type, file_url, duration)
                ),
                playlist_channels(
                  id, name, is_active, is_fallback, position,
                  start_date, end_date, start_time, end_time, days_of_week,
                  playlist_channel_items(
                    id, media_id, position, duration_override,
                    start_date, end_date, start_time, end_time, days_of_week,
                    media:media_items(id, name, type, file_url, duration)
                  )
                )
              `)
              .eq("is_active", true)
              .or(orConditions.join(','))
              .order("priority", { ascending: false });

            if (playlistError) throw playlistError;
            playlistsData = data || [];
          }
      }
    }

      // 5. Process Playlists & Download Media
      const cachedPlaylists: CachedPlaylist[] = [];
      
      for (const playlist of playlistsData) {
        const processedPlaylist: CachedPlaylist = {
          ...playlist,
          items: [],
          channels: [],
          synced_at: Date.now()
        };

        // Process Channels
        if (playlist.playlist_channels && playlist.playlist_channels.length > 0) {
          console.log(`[SyncService] Processing ${playlist.playlist_channels.length} channels for playlist ${playlist.name}`);
          for (const channel of playlist.playlist_channels) {
            const processedChannel: CachedChannel = {
              ...channel,
              items: []
            };

            for (const item of channel.playlist_channel_items || []) {
              if (item.media && item.media.file_url) {
                const localUrl = await offlineStorage.getMediaUrl(item.media.id, item.media.file_url);
                processedChannel.items.push({
                  ...item,
                  media: { ...item.media, blob_url: localUrl, cached_at: Date.now() }
                });
              }
            }

            if (processedChannel.items.length > 0 || processedChannel.is_fallback) {
                processedChannel.items.sort((a, b) => a.position - b.position);
                console.log(`[SyncService] Channel ${channel.name}: ${processedChannel.items.length} items (fallback: ${processedChannel.is_fallback})`);
                processedPlaylist.channels.push(processedChannel);
            } else {
                console.warn(`[SyncService] Channel ${channel.name} skipped: 0 items and not fallback`);
            }
          }
        } else {
           // Process Direct Items
           for (const item of playlist.playlist_items || []) {
              if (item.media && item.media.file_url) {
                const localUrl = await offlineStorage.getMediaUrl(item.media.id, item.media.file_url);
                processedPlaylist.items.push({
                  ...item,
                  media: { ...item.media, blob_url: localUrl, cached_at: Date.now() }
                });
              }
           }
        }
        
        processedPlaylist.items.sort((a, b) => a.position - b.position);
        cachedPlaylists.push(processedPlaylist);
      }

      const newState: DeviceState = {
        device_code: this.deviceCode,
        device_id: device.id,
        device_name: device.name,
        store_id: device.store_id,
        company_id: device.company_id,
        company_slug: device.companies?.slug,
        playlists: cachedPlaylists,
        last_sync: Date.now(),
        is_online: true,
        is_blocked: device.is_blocked || false,
        blocked_message: device.blocked_message,
        override_media: overrideMedia,
        last_sync_requested_at: device.last_sync_requested_at,
        camera_enabled: device.camera_enabled || false,
        store_code: device.store_code
      };

      if (this.onUpdateCallback) {
        this.onUpdateCallback(newState);
      }
      
      // If we reach here, sync was successful
      this.retryCount = 0;
      return newState;
    } catch (error) {
      console.error("[SyncService] Sync error:", error);
      console.error("[SyncService] Detailed Error:", JSON.stringify(error, null, 2));
      
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        const delay = 5000 * this.retryCount; // Exponential backoff: 5s, 10s, 15s
        console.log(`[SyncService] Retrying sync in ${delay}ms (Attempt ${this.retryCount}/${this.maxRetries})...`);
        setTimeout(() => this.performFullSync(), delay);
      }

      if (this.onErrorCallback) {
        if (error instanceof Error) {
          this.onErrorCallback(error);
        } else {
          // Properly stringify objects (like Supabase errors)
          this.onErrorCallback(new Error(JSON.stringify(error, null, 2)));
        }
      }
      return null;
    }
  }
}

export const syncService = new SyncService();
