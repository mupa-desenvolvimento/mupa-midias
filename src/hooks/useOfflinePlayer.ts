import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

// Exporta tipos para uso externo
export interface CachedMedia {
  id: string;
  name: string;
  type: string;
  file_url: string | null;
  duration: number;
  metadata?: any;
  blob_url?: string;
  cached_at: number;
}

export interface CachedPlaylistItem {
  id: string;
  media_id: string;
  position: number;
  duration_override: number | null;
  media: CachedMedia;
  start_date?: string | null;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  days_of_week?: number[] | null;
}

export interface CachedChannel {
  id: string;
  name: string;
  is_active: boolean;
  is_fallback: boolean;
  position: number;
  start_date: string | null;
  end_date: string | null;
  start_time: string;
  end_time: string;
  days_of_week: number[] | null;
  items: CachedPlaylistItem[];
}

export interface CachedPlaylist {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  has_channels: boolean;
  start_date: string | null;
  end_date: string | null;
  days_of_week: number[] | null;
  start_time: string | null;
  end_time: string | null;
  priority: number;
  items: CachedPlaylistItem[];
  channels: CachedChannel[];
  synced_at: number;
  content_scale?: string | null;
}

export interface OverrideMedia {
  id: string;
  name: string;
  type: string;
  file_url: string;
  duration: number;
  blob_url?: string;
  expires_at: string;
}

export interface DeviceState {
  device_code: string;
  device_id: string | null;
  device_name: string | null;
  store_id: string | null;
  company_id: string | null;
  company_slug: string | null;
  playlists: CachedPlaylist[];
  current_playlist_id: string | null;
  last_sync: number;
  is_online: boolean;
  is_blocked: boolean;
  blocked_message: string | null;
  override_media: OverrideMedia | null;
  last_sync_requested_at: string | null;
  camera_enabled: boolean;
  store_code?: string | null;
  device_token?: string | null;
}

import { MediaCacheService } from "@/services/mediaCache";
import { Capacitor } from '@capacitor/core';

const STORAGE_KEY = "device_player_state";
const SYNC_INTERVAL = 5 * 60 * 1000;
const CONTROL_CHECK_INTERVAL = 30 * 1000;

export const useOfflinePlayer = (deviceCode: string) => {
  const [deviceState, setDeviceState] = useState<DeviceState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{
    total: number;
    downloaded: number;
    current: string | null;
  }>({ total: 0, downloaded: 0, current: null });
  
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mediaCacheRef = useRef<Map<string, string>>(new Map());

  // Carrega estado do localStorage
  const loadLocalState = useCallback((): DeviceState | null => {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}_${deviceCode}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error("Erro ao carregar estado local:", e);
    }
    return null;
  }, [deviceCode]);

  // Salva estado no localStorage
  const saveLocalState = useCallback((state: DeviceState) => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_${deviceCode}`, JSON.stringify(state));
    } catch (e) {
      console.error("Erro ao salvar estado local:", e);
    }
  }, [deviceCode]);

  // Download e cache de mídia
  const downloadMedia = useCallback(async (url: string, mediaId: string): Promise<string> => {
    const cached = mediaCacheRef.current.get(mediaId);
    if (cached) return cached;

    // Em plataforma nativa (APK), faz download real para o filesystem
    if (Capacitor.isNativePlatform()) {
      try {
        const cachedUrl = await MediaCacheService.isCached(url);
        if (cachedUrl) {
          mediaCacheRef.current.set(mediaId, cachedUrl);
          return cachedUrl;
        }
        const localUrl = await MediaCacheService.downloadFile(url);
        if (localUrl) {
          mediaCacheRef.current.set(mediaId, localUrl);
          return localUrl;
        }
        return url;
      } catch (e) {
        console.error(`[Native] Erro ao baixar mídia ${mediaId}:`, e);
        return url;
      }
    }

    // No navegador web: tenta baixar e salvar no IndexedDB para funcionamento offline
    try {
      // Primeiro tenta carregar do IndexedDB (já cacheado)
      const cachedUrl = await loadFromIndexedDB(mediaId);
      if (cachedUrl) {
        mediaCacheRef.current.set(mediaId, cachedUrl);
        return cachedUrl;
      }

      // Tenta fazer download e cachear
      const response = await fetch(url, { mode: 'cors' });
      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        mediaCacheRef.current.set(mediaId, blobUrl);
        await saveToIndexedDB(mediaId, blob);
        return blobUrl;
      }
      
      // Se falhar, usa URL direta
      mediaCacheRef.current.set(mediaId, url);
      return url;
    } catch (e) {
      // CORS ou erro de rede: usa URL direta (funciona em <img>/<video> online)
      console.warn(`[OfflinePlayer] Cache falhou para ${mediaId}, usando URL direta:`, e);
      mediaCacheRef.current.set(mediaId, url);
      return url;
    }
  }, []);

  // IndexedDB helpers
  const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("PlayerMediaCache", 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains("media")) {
          db.createObjectStore("media", { keyPath: "id" });
        }
      };
    });
  };

  const saveToIndexedDB = async (id: string, blob: Blob) => {
    try {
      const db = await openDB();
      const tx = db.transaction("media", "readwrite");
      const store = tx.objectStore("media");
      store.put({ id, blob, cached_at: Date.now() });
    } catch (e) {
      console.error("Erro ao salvar no IndexedDB:", e);
    }
  };

  const loadFromIndexedDB = async (id: string): Promise<string | null> => {
    try {
      const db = await openDB();
      const tx = db.transaction("media", "readonly");
      const store = tx.objectStore("media");
      const request = store.get(id);
      
      return new Promise((resolve) => {
        request.onsuccess = () => {
          if (request.result) {
            const blobUrl = URL.createObjectURL(request.result.blob);
            mediaCacheRef.current.set(id, blobUrl);
            resolve(blobUrl);
          } else {
            resolve(null);
          }
        };
        request.onerror = () => resolve(null);
      });
    } catch (e) {
      return null;
    }
  };

  // Limpa todos os dados do cache
  const clearAllData = useCallback(async () => {
    console.log("[useOfflinePlayer] Limpando todos os dados...");
    localStorage.removeItem(`${STORAGE_KEY}_${deviceCode}`);
    try {
      const deleteRequest = indexedDB.deleteDatabase("PlayerMediaCache");
      await new Promise<void>((resolve, reject) => {
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => reject(deleteRequest.error);
        deleteRequest.onblocked = () => { resolve(); };
      });
    } catch (e) {
      console.error("[useOfflinePlayer] Erro ao limpar IndexedDB:", e);
    }
    mediaCacheRef.current.forEach((url) => { URL.revokeObjectURL(url); });
    mediaCacheRef.current.clear();
    setDeviceState(null);
  }, [deviceCode]);

  // Verifica se um canal está ativo agora
  const isChannelActiveNow = useCallback((channel: CachedChannel): boolean => {
    if (!channel.is_active) return false;
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.toTimeString().slice(0, 5);
    if (channel.is_fallback) return true;
    if (channel.days_of_week && channel.days_of_week.length > 0) {
      if (!channel.days_of_week.includes(currentDay)) return false;
    }
    if (channel.start_date) {
      const startDate = new Date(channel.start_date);
      if (now < startDate) return false;
    }
    if (channel.end_date) {
      const endDate = new Date(channel.end_date);
      endDate.setHours(23, 59, 59);
      if (now > endDate) return false;
    }
    if (channel.start_time && currentTime < channel.start_time.slice(0, 5)) return false;
    if (channel.end_time && currentTime > channel.end_time.slice(0, 5)) return false;
    return true;
  }, []);

  // Verifica se playlist está ativa agora
  const isPlaylistActiveNow = useCallback((playlist: CachedPlaylist): boolean => {
    if (!playlist.is_active) return false;
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.toTimeString().slice(0, 5);
    if (playlist.days_of_week && playlist.days_of_week.length > 0) {
      if (!playlist.days_of_week.includes(currentDay)) return false;
    }
    if (playlist.start_date) {
      const startDate = new Date(playlist.start_date);
      if (now < startDate) return false;
    }
    if (playlist.end_date) {
      const endDate = new Date(playlist.end_date);
      endDate.setHours(23, 59, 59);
      if (now > endDate) return false;
    }
    if (playlist.start_time && currentTime < playlist.start_time) return false;
    if (playlist.end_time && currentTime > playlist.end_time) return false;
    return true;
  }, []);

  // Obtém playlist ativa com maior prioridade
  const getActivePlaylist = useCallback((): CachedPlaylist | null => {
    if (!deviceState?.playlists) return null;
    const activePlaylists = deviceState.playlists
      .filter(isPlaylistActiveNow)
      .sort((a, b) => b.priority - a.priority);
    return activePlaylists[0] || null;
  }, [deviceState, isPlaylistActiveNow]);

  // Obtém o canal ativo da playlist
  const getActiveChannel = useCallback((playlist: CachedPlaylist): CachedChannel | null => {
    if (!playlist.has_channels || !playlist.channels || playlist.channels.length === 0) {
      return null;
    }
    const activeChannels = playlist.channels.filter(isChannelActiveNow);
    const normalChannels = activeChannels.filter(c => !c.is_fallback);
    const fallbackChannels = activeChannels.filter(c => c.is_fallback);
    if (normalChannels.length > 0) {
      return normalChannels.sort((a, b) => a.position - b.position)[0];
    }
    if (fallbackChannels.length > 0) {
      return fallbackChannels.sort((a, b) => a.position - b.position)[0];
    }
    return null;
  }, [isChannelActiveNow]);

  // Obtém items ativos da playlist
  const getActiveItems = useCallback((): CachedPlaylistItem[] => {
    const playlist = getActivePlaylist();
    if (!playlist) return [];
    if (playlist.has_channels) {
      const activeChannel = getActiveChannel(playlist);
      if (activeChannel) {
        return activeChannel.items;
      }
      return [];
    }
    return playlist.items;
  }, [getActivePlaylist, getActiveChannel]);

  // ========== SYNC COM SERVIDOR (usa RPCs SECURITY DEFINER para contornar RLS) ==========
  const syncWithServer = useCallback(async () => {
    if (isSyncing) return;

    setIsSyncing(true);
    setSyncError(null);

    try {
      // 1. Busca dados do dispositivo via RPC (contorna RLS)
      const { data: deviceRows, error: deviceError } = await supabase.rpc('get_public_device_info', {
        p_device_code: deviceCode,
      });

      if (deviceError) throw deviceError;

      const device = Array.isArray(deviceRows) ? deviceRows[0] : deviceRows;
      if (!device) {
        throw new Error(`Dispositivo "${deviceCode}" não encontrado. Verifique se foi registrado corretamente.`);
      }

      // Processa mídia avulsa (override)
      let overrideMedia: OverrideMedia | null = null;
      const overrideMediaData = device.override_media_data as any;
      
      if (overrideMediaData && device.override_media_expires_at) {
        const expiresAt = new Date(device.override_media_expires_at);
        if (expiresAt > new Date()) {
          overrideMedia = {
            id: overrideMediaData.id,
            name: overrideMediaData.name,
            type: overrideMediaData.type,
            file_url: overrideMediaData.file_url,
            duration: overrideMediaData.duration || 10,
            expires_at: device.override_media_expires_at,
          };
        }
      }

      // 2. Tenta buscar playlist dinâmica do Campaign Engine primeiro
      const mediaToDownload: { id: string; url: string; name: string }[] = [];
      const cachedPlaylists: CachedPlaylist[] = [];
      try {
        const projectId = (import.meta as any).env.VITE_SUPABASE_PROJECT_ID as string | undefined;
        const publishableKey = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
        if (projectId) {
          const url = `https://${projectId}.supabase.co/functions/v1/campaign-engine/playlist?device_code=${(device as any).device_code || deviceCode}`;
          const res = await fetch(url, { headers: { ...(publishableKey ? { apikey: publishableKey } : {}) } });
          if (res.ok) {
            const playlist = await res.json();
            if (playlist?.items && Array.isArray(playlist.items) && playlist.items.length > 0) {
              const items: CachedPlaylistItem[] = playlist.items
                .filter((it: any) => it?.media && (it.media.type === "video" || it.media.type === "image" || it.media.file_url))
                .map((it: any, idx: number) => {
                  const m = it.media;
                  if (m?.file_url) {
                    mediaToDownload.push({ id: m.id, url: m.file_url, name: m.name });
                  }
                  return {
                    id: it.id ?? `${m.id}-${idx}`,
                    media_id: m.id,
                    position: it.position ?? idx,
                    duration_override: it.duration_override ?? null,
                    start_date: it.start_date ?? null,
                    end_date: it.end_date ?? null,
                    start_time: it.start_time ?? null,
                    end_time: it.end_time ?? null,
                    days_of_week: it.days_of_week ?? null,
                    media: {
                      id: m.id,
                      name: m.name,
                      type: m.type,
                      file_url: m.file_url,
                      duration: m.duration || 10,
                      metadata: m.metadata,
                      cached_at: Date.now(),
                    },
                  } as CachedPlaylistItem;
                });
              if (items.length > 0) {
                cachedPlaylists.push({
                  id: "campaign-dynamic",
                  name: "Campanha Dinâmica",
                  description: null,
                  is_active: true,
                  has_channels: false,
                  start_date: null,
                  end_date: null,
                  days_of_week: null,
                  start_time: null,
                  end_time: null,
                  priority: 100,
                  items: items.sort((a, b) => a.position - b.position),
                  channels: [],
                  synced_at: Date.now(),
                });
              }
            }
          }
        }
      } catch (e) {
        // silencioso: se falhar, continua com playlists tradicionais
      }

      // 3. Busca playlists associadas ao dispositivo (se não veio nada do engine)
      const relevantPlaylistIds: string[] = [];
      let relevantChannelIds: string[] = [];

      if (device.current_playlist_id) {
        relevantPlaylistIds.push(device.current_playlist_id);
      }

      // Busca grupos -> canais (estas tabelas têm RLS pública para SELECT)
      const { data: groupMembers } = await supabase
        .from("device_group_members")
        .select("group_id")
        .eq("device_id", device.id);

      if (groupMembers && groupMembers.length > 0) {
        const groupIds = groupMembers.map(g => g.group_id);
        const { data: groupChannels } = await supabase
          .from("device_group_channels")
          .select("distribution_channel_id")
          .in("group_id", groupIds);

        if (groupChannels && groupChannels.length > 0) {
          relevantChannelIds = groupChannels.map(c => c.distribution_channel_id);
        }
      }

      // 4. Busca playlists via RPC (contorna RLS)
      let playlistsData: any[] = [];

      if (cachedPlaylists.length === 0 && (relevantPlaylistIds.length > 0 || relevantChannelIds.length > 0)) {
        const { data: playlistsResult, error: playlistsError } = await supabase.rpc('get_public_playlists_data', {
          p_playlist_ids: relevantPlaylistIds.length > 0 ? relevantPlaylistIds : null,
          p_channel_ids: relevantChannelIds.length > 0 ? relevantChannelIds : null,
        });

        if (playlistsError) throw playlistsError;
        playlistsData = (Array.isArray(playlistsResult) ? playlistsResult : []) as any[];
      }

      // 5. Monta playlists locais (somente se não veio do engine)
      for (const playlist of playlistsData) {
        const items: CachedPlaylistItem[] = [];
        const channels: CachedChannel[] = [];
        
        if (playlist.has_channels && playlist.playlist_channels) {
          for (const channel of playlist.playlist_channels) {
            const channelItems: CachedPlaylistItem[] = [];
            for (const item of channel.playlist_channel_items || []) {
              if (item.media) {
                const isNonFileSlide = item.media.type === "news" || item.media.type === "weather";
                if (!isNonFileSlide && item.media.file_url) {
                  mediaToDownload.push({ id: item.media.id, url: item.media.file_url, name: item.media.name });
                }
                if (!isNonFileSlide && !item.media.file_url) continue;
                channelItems.push({
                  id: item.id,
                  media_id: item.media_id,
                  position: item.position,
                  duration_override: item.duration_override,
                  start_date: item.start_date,
                  end_date: item.end_date,
                  start_time: item.start_time,
                  end_time: item.end_time,
                  days_of_week: item.days_of_week,
                  media: {
                    id: item.media.id,
                    name: item.media.name,
                    type: item.media.type,
                    file_url: item.media.file_url,
                    duration: item.media.duration || 10,
                    metadata: item.media.metadata,
                    cached_at: Date.now(),
                  },
                });
              }
            }
            if (channelItems.length > 0 || channel.is_fallback) {
              channels.push({
                id: channel.id,
                name: channel.name,
                is_active: channel.is_active,
                is_fallback: channel.is_fallback,
                position: channel.position,
                start_date: channel.start_date,
                end_date: channel.end_date,
                start_time: channel.start_time,
                end_time: channel.end_time,
                days_of_week: channel.days_of_week,
                items: channelItems.sort((a, b) => a.position - b.position),
              });
            }
          }
        } else {
          for (const item of playlist.playlist_items || []) {
            if (item.media) {
              const isNonFileSlide = item.media.type === "news" || item.media.type === "weather";
              if (!isNonFileSlide && item.media.file_url) {
                mediaToDownload.push({ id: item.media.id, url: item.media.file_url, name: item.media.name });
              }
              if (!isNonFileSlide && !item.media.file_url) continue;
              items.push({
                id: item.id,
                media_id: item.media_id,
                position: item.position,
                duration_override: item.duration_override,
                start_date: item.start_date,
                end_date: item.end_date,
                start_time: item.start_time,
                end_time: item.end_time,
                days_of_week: item.days_of_week,
                media: {
                  id: item.media.id,
                  name: item.media.name,
                  type: item.media.type,
                  file_url: item.media.file_url,
                  duration: item.media.duration || 10,
                  metadata: item.media.metadata,
                  cached_at: Date.now(),
                },
              });
            }
          }
        }

        const hasContent = items.length > 0 || channels.some((c: any) => c.items.length > 0);
        if (hasContent) {
          cachedPlaylists.push({
            id: playlist.id,
            name: playlist.name,
            description: playlist.description,
            is_active: playlist.is_active,
            has_channels: playlist.has_channels || false,
            start_date: playlist.start_date,
            end_date: playlist.end_date,
            days_of_week: playlist.days_of_week,
            start_time: playlist.start_time,
            end_time: playlist.end_time,
            priority: playlist.priority || 0,
            items: items.sort((a, b) => a.position - b.position),
            channels: channels.sort((a, b) => a.position - b.position),
            synced_at: Date.now(),
          });
        }
      }

      const manifest = {
        device_code: deviceCode,
        generated_at: Date.now(),
        media: mediaToDownload.map(m => ({
          id: m.id,
          url: m.url,
          name: m.name,
        })),
        override_media: overrideMedia
          ? {
              id: overrideMedia.id,
              url: overrideMedia.file_url,
              name: overrideMedia.name,
              expires_at: overrideMedia.expires_at,
            }
          : null,
      };

      try {
        localStorage.setItem(`media_manifest_${deviceCode}`, JSON.stringify(manifest));
      } catch (e) {
        console.error("[useOfflinePlayer] Erro ao salvar manifest de mídia:", e);
      }

      setDownloadProgress({ total: mediaToDownload.length, downloaded: 0, current: null });

      for (let i = 0; i < mediaToDownload.length; i++) {
        const media = mediaToDownload[i];
        setDownloadProgress({ total: mediaToDownload.length, downloaded: i, current: media.name });

        let blobUrl = await loadFromIndexedDB(media.id);
        if (!blobUrl) {
          blobUrl = await downloadMedia(media.url, media.id);
        }

        for (const playlist of cachedPlaylists) {
          for (const item of playlist.items) {
            if (item.media.id === media.id && blobUrl) {
              item.media.blob_url = blobUrl;
            }
          }
          for (const channel of playlist.channels) {
            for (const item of channel.items) {
              if (item.media.id === media.id && blobUrl) {
                item.media.blob_url = blobUrl;
              }
            }
          }
        }
      }

      // Download mídia avulsa
      if (overrideMedia && overrideMedia.file_url) {
        setDownloadProgress({
          total: mediaToDownload.length + 1,
          downloaded: mediaToDownload.length,
          current: overrideMedia.name,
        });
        let blobUrl = await loadFromIndexedDB(overrideMedia.id);
        if (!blobUrl) {
          blobUrl = await downloadMedia(overrideMedia.file_url, overrideMedia.id);
        }
        if (blobUrl) {
          overrideMedia.blob_url = blobUrl;
        }
      }

      setDownloadProgress({ total: mediaToDownload.length, downloaded: mediaToDownload.length, current: null });

      if (Capacitor.isNativePlatform()) {
        const activeUrls: string[] = mediaToDownload.map(m => m.url);
        if (overrideMedia?.file_url) {
          activeUrls.push(overrideMedia.file_url);
        }
        try {
          await MediaCacheService.cleanupOldFiles(activeUrls);
        } catch (e) {
          console.error("[useOfflinePlayer] Erro ao limpar arquivos antigos de mídia:", e);
        }
      }

      // 6. Atualiza estado
      const newState: DeviceState = {
        device_code: deviceCode,
        device_id: device.id,
        device_name: device.name,
        store_id: device.store_id,
        company_id: device.company_id,
        company_slug: device.company_slug || null,
        playlists: cachedPlaylists,
        last_sync: Date.now(),
        is_online: true,
        is_blocked: device.is_blocked || false,
        blocked_message: device.blocked_message || null,
        override_media: overrideMedia,
        last_sync_requested_at: device.last_sync_requested_at || null,
        camera_enabled: device.camera_enabled || false,
        store_code: device.store_code || null,
      };

      setDeviceState(newState);
      saveLocalState(newState);

      // 7. Heartbeat via RPC (se tiver device_token salvo)
      const savedToken = localStorage.getItem(`device_token_${deviceCode}`);
      if (savedToken) {
        supabase.rpc('device_heartbeat', {
          p_device_token: savedToken,
          p_status: 'online',
          p_current_playlist_id: device.current_playlist_id || null,
        }).then(({ error }) => {
          if (error) console.warn("[useOfflinePlayer] Heartbeat error:", error.message);
        });
      }

    } catch (e: any) {
      console.error("Erro na sincronização:", e);
      const errorMessage = e?.message || (typeof e === 'string' ? e : "Erro desconhecido");
      setSyncError(errorMessage);
      
      const localState = loadLocalState();
      if (localState) {
        setDeviceState({ ...localState, is_online: false });
      }
    } finally {
      setIsSyncing(false);
    }
  }, [deviceCode, isSyncing, downloadMedia, saveLocalState, loadLocalState, loadFromIndexedDB]);

  // Inicialização
  useEffect(() => {
    const init = async () => {
      if (Capacitor.isNativePlatform()) {
        await MediaCacheService.init();
      }

      setIsLoading(true);
      
      const localState = loadLocalState();
      if (localState) {
        // Restaura blob URLs do IndexedDB para todos os itens (playlists e canais)
        for (const playlist of localState.playlists) {
          for (const item of playlist.items) {
            const blobUrl = await loadFromIndexedDB(item.media.id);
            if (blobUrl) {
              item.media.blob_url = blobUrl;
            }
          }
          for (const channel of playlist.channels || []) {
            for (const item of channel.items) {
              const blobUrl = await loadFromIndexedDB(item.media.id);
              if (blobUrl) {
                item.media.blob_url = blobUrl;
              }
            }
          }
        }
        // Restaura override media
        if (localState.override_media) {
          const blobUrl = await loadFromIndexedDB(localState.override_media.id);
          if (blobUrl) {
            localState.override_media.blob_url = blobUrl;
          }
        }
        setDeviceState(localState);
      }

      await syncWithServer();
      setIsLoading(false);
    };

    init();
  }, [deviceCode]);

  // Verificação rápida de comandos de controle via RPC
  const checkControlCommands = useCallback(async () => {
    if (!deviceState?.device_id) return;

    try {
      // Heartbeat
      const savedToken = localStorage.getItem(`device_token_${deviceCode}`);
      if (savedToken) {
        await supabase.rpc('device_heartbeat', {
          p_device_token: savedToken,
          p_status: 'online',
          p_current_playlist_id: null,
        });
      }

      // Check via RPC
      const { data: deviceRows, error } = await supabase.rpc('get_public_device_info', {
        p_device_code: deviceCode,
      });

      if (error) return;
      const device = Array.isArray(deviceRows) ? deviceRows[0] : deviceRows;
      if (!device) return;

      const needsUpdate = 
        device.is_blocked !== deviceState.is_blocked ||
        device.blocked_message !== deviceState.blocked_message ||
        device.override_media_id !== (deviceState.override_media?.id || null) ||
        device.camera_enabled !== deviceState.camera_enabled;

      const lastSyncRequested = device.last_sync_requested_at;
      const needsForcedSync = lastSyncRequested && 
        (!deviceState.last_sync_requested_at || lastSyncRequested > deviceState.last_sync_requested_at);

      if (needsUpdate || needsForcedSync) {
        console.log("[useOfflinePlayer] Comando de controle detectado, sincronizando...");
        await syncWithServer();
      }
    } catch (e) {
      console.error("[useOfflinePlayer] Erro ao verificar comandos:", e);
    }
  }, [deviceCode, deviceState, syncWithServer]);

  // Refs estáveis para evitar re-criação de intervalos e Realtime
  const syncWithServerRef = useRef(syncWithServer);
  const checkControlCommandsRef = useRef(checkControlCommands);
  
  useEffect(() => {
    syncWithServerRef.current = syncWithServer;
  }, [syncWithServer]);
  
  useEffect(() => {
    checkControlCommandsRef.current = checkControlCommands;
  }, [checkControlCommands]);

  // Configura intervalos de sincronização e Realtime (roda UMA vez por deviceCode)
  useEffect(() => {
    const fullSyncInterval = setInterval(() => syncWithServerRef.current(), SYNC_INTERVAL);
    const controlCheckInterval = setInterval(() => checkControlCommandsRef.current(), CONTROL_CHECK_INTERVAL);

    const handleOnline = () => {
      setDeviceState((prev) => prev ? { ...prev, is_online: true } : null);
      syncWithServerRef.current();
    };
    const handleOffline = () => {
      setDeviceState((prev) => prev ? { ...prev, is_online: false } : null);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Supabase Realtime - canal único e estável
    let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
    
    if (deviceCode) {
      console.log("[useOfflinePlayer] Configurando Realtime para device_code:", deviceCode);
      
      realtimeChannel = supabase
        .channel(`device-updates-${deviceCode}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'devices', filter: `device_code=eq.${deviceCode}` },
          () => { syncWithServerRef.current(); }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'playlists' },
          () => { syncWithServerRef.current(); }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'playlist_items' },
          () => { syncWithServerRef.current(); }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'playlist_channel_items' },
          () => { syncWithServerRef.current(); }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'playlist_channels' },
          () => { syncWithServerRef.current(); }
        )
        .subscribe((status, err) => {
          console.log("[useOfflinePlayer] Realtime subscription status:", status);
          if (err) console.error("[useOfflinePlayer] Realtime error:", err);
        });
    }

    return () => {
      clearInterval(fullSyncInterval);
      clearInterval(controlCheckInterval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    };
  }, [deviceCode]);

  // Cleanup blob URLs
  useEffect(() => {
    return () => {
      mediaCacheRef.current.forEach((url) => { URL.revokeObjectURL(url); });
    };
  }, []);

  return {
    deviceState,
    isLoading,
    isSyncing,
    syncError,
    downloadProgress,
    getActivePlaylist,
    getActiveItems,
    getActiveChannel,
    syncWithServer,
    isPlaylistActiveNow,
    clearAllData,
  };
};
