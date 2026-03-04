import { useState, useCallback, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePlaylists } from "@/hooks/usePlaylists";
import { usePlaylistItems } from "@/hooks/usePlaylistItems";
import { usePlaylistChannels, PlaylistChannel } from "@/hooks/usePlaylistChannels";
import { useChannels } from "@/hooks/useChannels";
import { useDevices } from "@/hooks/useDevices";
import { MediaItem } from "@/hooks/useMediaItems";
import { AutoContentItem } from "@/hooks/useAutoContent";
import { EditorSidebar } from "./EditorSidebar";
import { EditorCanvas } from "./EditorCanvas";
import { EditorTimeline } from "./EditorTimeline";
import { EditorHeader } from "./EditorHeader";
import { EditorPropertiesPanel } from "./EditorPropertiesPanel";
import { ChannelsList } from "./ChannelsList";
import { ChannelEditor } from "./ChannelEditor";
import { ChannelsTimeline } from "./ChannelsTimeline";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/services/firebase";
import { ref, update } from "firebase/database";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Radio, Layers } from "lucide-react";

interface PlaylistFormData {
  name: string;
  description: string | null;
  channel_id: string | null;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  priority: number;
  content_scale: 'cover' | 'contain' | 'fill';
}

export const PlaylistEditor = () => {
  const navigate = useNavigate();
  const { id: playlistId } = useParams<{ id: string }>();
  const { toast } = useToast();
  
  const { playlists, updatePlaylist, createPlaylist } = usePlaylists();
  const { channels: distributionChannels } = useChannels();
  const { devices } = useDevices();
  const [createdPlaylistId, setCreatedPlaylistId] = useState<string | null>(null);
  
  const activePlaylistId = createdPlaylistId || playlistId || null;
  
  // Playlist channels (blocos de programação)
  const {
    channels: playlistChannels,
    channelsWithItems,
    isLoading: channelsLoading,
    createChannel,
    updateChannel,
    deleteChannel,
    reorderChannels,
    reorderGlobalItems,
    updateChannelItem,
  } = usePlaylistChannels(activePlaylistId);
  
  // Legacy playlist items (for backward compatibility)
  const { 
    items, 
    isLoading: itemsLoading, 
    addItem, 
    removeItem, 
    updateItem, 
    reorderItems,
    getTotalDuration 
  } = usePlaylistItems(activePlaylistId);

  const [activePanel, setActivePanel] = useState<"media" | null>("media");
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingDevices, setIsUpdatingDevices] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [activeTab, setActiveTab] = useState<"channels" | "legacy">("channels");
  const [selectedChannel, setSelectedChannel] = useState<PlaylistChannel | null>(null);

  const existingPlaylist = playlists.find((p) => p.id === activePlaylistId);
  const isNewPlaylist = !playlistId && !createdPlaylistId;
  const connectedDevices = devices.filter(d => d.current_playlist_id === activePlaylistId);
  const hasChannels = playlistChannels.length > 0 || existingPlaylist?.has_channels;

  const [formData, setFormData] = useState<PlaylistFormData>({
    name: "",
    description: null,
    channel_id: null,
    is_active: true,
    start_date: null,
    end_date: null,
    days_of_week: [0, 1, 2, 3, 4, 5, 6],
    start_time: "00:00",
    end_time: "23:59",
    priority: 5,
    content_scale: 'cover',
  });

  useEffect(() => {
    if (existingPlaylist) {
      const schedule = existingPlaylist.schedule as Record<string, unknown> | null;
      const contentScale = (existingPlaylist as any).content_scale as 'cover' | 'contain' | 'fill' | null;
      setFormData({
        name: existingPlaylist.name,
        description: existingPlaylist.description,
        channel_id: existingPlaylist.channel_id,
        is_active: existingPlaylist.is_active,
        start_date: (schedule?.start_date as string) || null,
        end_date: (schedule?.end_date as string) || null,
        days_of_week: (schedule?.days_of_week as number[]) || [0, 1, 2, 3, 4, 5, 6],
        start_time: (schedule?.start_time as string) || "00:00",
        end_time: (schedule?.end_time as string) || "23:59",
        priority: (schedule?.priority as number) || 5,
        content_scale: contentScale || 'cover',
      });
      
      // Auto-select channels tab if playlist has channels
      if (existingPlaylist.has_channels) {
        setActiveTab("channels");
      }
    }
  }, [existingPlaylist]);

  const handleFormChange = useCallback((updates: Partial<PlaylistFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
  }, []);

  const ensurePlaylistExists = async (): Promise<string | null> => {
    if (activePlaylistId) return activePlaylistId;
    
    const tempName = formData.name || `Nova Playlist ${new Date().toLocaleString("pt-BR")}`;
    
    const schedule = {
      start_date: formData.start_date,
      end_date: formData.end_date,
      days_of_week: formData.days_of_week,
      start_time: formData.start_time,
      end_time: formData.end_time,
      priority: formData.priority,
    };

    const playlistData = {
      name: tempName,
      description: formData.description,
      channel_id: formData.channel_id,
      is_active: formData.is_active,
      schedule,
      content_scale: formData.content_scale,
      has_channels: true,
    };

    try {
      const result = await createPlaylist.mutateAsync(playlistData);
      setCreatedPlaylistId(result.id);
      setFormData(prev => ({ ...prev, name: tempName }));
      return result.id;
    } catch (error) {
      toast({ title: "Erro ao criar playlist", variant: "destructive" });
      return null;
    }
  };

  const handleAddMedia = useCallback(async (media: MediaItem, position: number) => {
    const id = await ensurePlaylistExists();
    if (!id) return;
    
    const itemDuration = media.type === 'video' && media.duration ? media.duration : 8;
    
    addItem.mutate({
      playlist_id: id,
      media_id: media.id,
      position,
      duration_override: itemDuration,
    });
  }, [activePlaylistId, addItem, formData, createPlaylist]);

  const handleRemoveItem = useCallback((id: string) => {
    removeItem.mutate(id);
    if (selectedItemId === id) {
      setSelectedItemId(null);
    }
  }, [removeItem, selectedItemId]);

  const handleDuplicateItem = useCallback(async (item: typeof items[0]) => {
    const id = await ensurePlaylistExists();
    if (!id) return;
    
    addItem.mutate({
      playlist_id: id,
      media_id: item.media_id,
      position: items.length,
      duration_override: item.duration_override,
    });
  }, [items.length, addItem, ensurePlaylistExists]);

  const handleUpdateDuration = useCallback((id: string, duration: number) => {
    updateItem.mutate({ id, duration_override: duration });
  }, [updateItem]);

  const handleUpdateItemSettings = useCallback((id: string, updates: {
    duration_override: number;
    is_schedule_override: boolean;
    start_date: string | null;
    end_date: string | null;
    start_time: string | null;
    end_time: string | null;
    days_of_week: number[] | null;
  }) => {
    updateItem.mutate({ id, ...updates });
  }, [updateItem]);

  const handleReorderItems = useCallback((orderedItems: { id: string; position: number }[]) => {
    reorderItems.mutate(orderedItems);
  }, [reorderItems]);

  // Channel handlers
  const handleCreateChannel = useCallback(async (data: Parameters<typeof createChannel.mutate>[0]) => {
    const id = await ensurePlaylistExists();
    if (!id) return;
    
    createChannel.mutate({ ...data, playlist_id: id });
    
    // Update playlist to has_channels = true
    if (activePlaylistId) {
      await supabase.from("playlists").update({ has_channels: true }).eq("id", activePlaylistId);
    }
  }, [createChannel, ensurePlaylistExists, activePlaylistId]);

  const handleUpdateChannel = useCallback((channelId: string, updates: any) => {
    updateChannel.mutate({ id: channelId, ...updates });
  }, [updateChannel]);

  const handleDeleteChannel = useCallback((channelId: string) => {
    deleteChannel.mutate(channelId);
    if (selectedChannel?.id === channelId) {
      setSelectedChannel(null);
    }
  }, [deleteChannel, selectedChannel]);

  const handleReorderChannels = useCallback((orderedChannels: { id: string; position: number }[]) => {
    reorderChannels.mutate(orderedChannels);
  }, [reorderChannels]);

  const handleAddAutoContent = useCallback(async (item: AutoContentItem) => {
    const id = await ensurePlaylistExists();
    if (!id) return;

    if (!item.image_url && item.type !== 'news') {
      toast({
        title: "Conteúdo automático sem imagem",
        variant: "destructive",
      });
      return;
    }

    const mediaType = item.type === 'news' ? 'news' : 'image';
    const fileUrl = item.image_url || (item.type === 'news' ? 'https://placehold.co/1920x1080/2563eb/ffffff?text=Noticias' : null);

    const { data: media, error } = await supabase
      .from("media_items")
      .insert({
        name: item.title,
        type: mediaType,
        file_url: fileUrl,
        status: "active",
        metadata: {
          auto_content_id: item.id,
          auto_content_type: item.type,
        } as any,
      })
      .select()
      .single();

    if (error || !media) {
      toast({
        title: "Erro ao adicionar conteúdo automático",
        variant: "destructive",
      });
      return;
    }

    addItem.mutate({
      playlist_id: id,
      media_id: media.id,
      position: items.length,
      duration_override: media.duration || 10,
    });
  }, [ensurePlaylistExists, addItem, items.length, toast]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }

    setIsSaving(true);

    const schedule = {
      start_date: formData.start_date,
      end_date: formData.end_date,
      days_of_week: formData.days_of_week,
      start_time: formData.start_time,
      end_time: formData.end_time,
      priority: formData.priority,
    };

    const playlistData = {
      name: formData.name,
      description: formData.description,
      channel_id: formData.channel_id,
      is_active: formData.is_active,
      schedule,
      content_scale: formData.content_scale,
      has_channels: playlistChannels.length > 0,
    };

    try {
      if (activePlaylistId) {
        await updatePlaylist.mutateAsync({ id: activePlaylistId, ...playlistData });
      } else {
        const result = await createPlaylist.mutateAsync(playlistData);
        setCreatedPlaylistId(result.id);
      }
      setHasUnsavedChanges(false);
      toast({ title: "Projeto salvo!" });
    } catch (error) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateDevices = async () => {
    if (!activePlaylistId) {
      toast({ 
        title: "Salve a playlist primeiro", 
        variant: "destructive" 
      });
      return;
    }

    setIsUpdatingDevices(true);

    try {
      const { error: playlistError } = await supabase
        .from("playlists")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", activePlaylistId);

      if (playlistError) throw playlistError;

      const { data: devicesData, error: fetchError } = await supabase
        .from("devices")
        .select("id, device_code")
        .eq("current_playlist_id", activePlaylistId);

      if (fetchError) throw fetchError;

      const deviceIds = devicesData?.map(d => d.id) || [];

      if (deviceIds.length > 0) {
        // 1. Atualizar no Supabase
        const { error: updateError } = await supabase
          .from("devices")
          .update({ updated_at: new Date().toISOString() })
          .in("id", deviceIds);

        if (updateError) throw updateError;

        // 2. Atualizar no Firebase para todos os dispositivos
        const updates: Record<string, any> = {};
        
        // Precisamos buscar as relações (empresa/store) para preencher corretamente
        const { data: devicesWithRelations } = await supabase
          .from("devices")
          .select(`
            id, 
            device_code,
            store:stores(name),
            company:companies(id, name)
          `)
          .in("id", deviceIds);

        devicesWithRelations?.forEach((device: any) => {
          if (device.device_code) {
            const companyInfo = device.company ? `${device.company.id}_${device.company.name}` : "";
            const groupInfo = device.store ? `Loja: ${device.store.name}` : "Sem grupo";

            updates[`${device.device_code}`] = {
              "atualizacao_plataforma": "true",
              "empresa_id": companyInfo,
              "device_id": device.id,
              "last-update": new Date().toISOString(),
              "grupo_device": groupInfo
            };
          }
        });

        if (Object.keys(updates).length > 0) {
          await update(ref(db), updates);
        }
      }

      toast({ 
        title: "Sincronização enviada!", 
        description: `${deviceIds.length} dispositivo(s) serão atualizados` 
      });
    } catch (error) {
      console.error("Error updating devices:", error);
      toast({ title: "Erro ao sincronizar", variant: "destructive" });
    } finally {
      setIsUpdatingDevices(false);
    }
  };

  const totalDuration = getTotalDuration();
  const currentPreviewItem = items[currentPreviewIndex];

  // If editing a channel, show channel editor
  if (selectedChannel) {
    return (
      <ChannelEditor
        channel={selectedChannel}
        playlistName={formData.name || "Nova Playlist"}
        onBack={() => setSelectedChannel(null)}
        onUpdateChannel={(updates) => handleUpdateChannel(selectedChannel.id, updates)}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Header */}
      <EditorHeader
        projectName={formData.name || "Novo Projeto"}
        hasUnsavedChanges={hasUnsavedChanges}
        isSaving={isSaving}
        isUpdatingDevices={isUpdatingDevices}
        connectedDevicesCount={connectedDevices.length}
        onBack={() => navigate("/admin/playlists")}
        onSave={handleSave}
        onUpdateDevices={handleUpdateDevices}
      />

      {/* Main Content - Full height minus header */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Sidebar - Tools */}
        <EditorSidebar
          activePanel={activePanel}
          onPanelChange={setActivePanel}
        />

        {/* Left Panel - Content Selection */}
        {activePanel && (
          <div className="w-80 border-r bg-card flex flex-col overflow-hidden">
            {/* Tabs for Channels vs Legacy mode */}
            <div className="p-3 border-b shrink-0">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <TabsList className="w-full">
                  <TabsTrigger value="channels" className="flex-1 gap-2">
                    <Radio className="w-4 h-4" />
                    Canais
                  </TabsTrigger>
                  <TabsTrigger value="legacy" className="flex-1 gap-2">
                    <Layers className="w-4 h-4" />
                    Mídias
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {activeTab === "channels" ? (
              <div className="flex-1 overflow-hidden min-h-0">
                <ChannelsList
                  channels={playlistChannels}
                  activeChannelId={null}
                  onSelectChannel={setSelectedChannel}
                  onCreateChannel={handleCreateChannel}
                  onUpdateChannel={handleUpdateChannel}
                  onDeleteChannel={handleDeleteChannel}
                  onReorderChannels={handleReorderChannels}
                  playlistId={activePlaylistId || ""}
                  playlistName={formData.name || "Nova Playlist"}
                />
              </div>
            ) : (
              <div className="h-full overflow-hidden">
                <EditorPropertiesPanel
                  activePanel={activePanel}
                  formData={formData}
                  channels={distributionChannels}
                  itemCount={items.length}
                  totalDuration={totalDuration}
                  connectedDevicesCount={connectedDevices.length}
                  onFormChange={handleFormChange}
                  onAddMedia={handleAddMedia}
                  itemsLength={items.length}
                  onAddAutoContent={handleAddAutoContent}
                />
              </div>
            )}
          </div>
        )}

        {/* Center - Canvas/Preview (only show in legacy mode) */}
        {activeTab === "legacy" && (
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <EditorCanvas
              currentItem={currentPreviewItem}
              isPlaying={isPreviewPlaying}
              onTogglePlay={() => setIsPreviewPlaying(!isPreviewPlaying)}
              onPrevious={() => setCurrentPreviewIndex(Math.max(0, currentPreviewIndex - 1))}
              onNext={() => {
                if (currentPreviewIndex >= items.length - 1) {
                  setCurrentPreviewIndex(0);
                } else {
                  setCurrentPreviewIndex(currentPreviewIndex + 1);
                }
              }}
              currentIndex={currentPreviewIndex}
              totalItems={items.length}
              zoom={zoom}
              onZoomChange={setZoom}
            />

            {/* Timeline */}
            <EditorTimeline
              items={items}
              selectedItemId={selectedItemId}
              currentPreviewIndex={currentPreviewIndex}
              onSelectItem={setSelectedItemId}
              onSetPreviewIndex={setCurrentPreviewIndex}
              onAddMedia={handleAddMedia}
              onRemoveItem={handleRemoveItem}
              onDuplicateItem={handleDuplicateItem}
              onUpdateDuration={handleUpdateDuration}
              onUpdateItemSettings={handleUpdateItemSettings}
              onReorderItems={handleReorderItems}
              totalDuration={totalDuration}
              isPlaying={isPreviewPlaying}
            />
          </div>
        )}

        {/* Channels Timeline view when in channels mode */}
        {activeTab === "channels" && !selectedChannel && (
          <div className="flex-1 flex flex-col min-w-0 p-4 bg-muted/30 overflow-hidden">
            <div className="flex-1 flex flex-col gap-4 min-h-0">
              {/* Timeline visualization */}
              <ChannelsTimeline
                channels={playlistChannels}
                channelsWithItems={channelsWithItems}
                onSelectChannel={setSelectedChannel}
                onUpdateChannel={(channelId, updates) => {
                  updateChannel.mutate({ id: channelId, ...updates });
                }}
                onReorderGlobal={(items) => {
                  reorderGlobalItems.mutate(items);
                }}
                onUpdateItem={(itemId, updates) => {
                  updateChannelItem.mutate({ id: itemId, ...updates });
                }}
                activeChannelId={null}
              />
              
              {/* Empty state if no channels */}
              {playlistChannels.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <Radio className="w-16 h-16 text-muted-foreground/50 mb-4" />
                  <h2 className="text-xl font-semibold mb-2">Nenhum Canal Criado</h2>
                  <p className="text-muted-foreground max-w-md mb-6">
                    Crie seu primeiro canal na lista à esquerda para começar a programar conteúdos por horário.
                  </p>
                </div>
              )}
              
              {/* Instructions when channels exist */}
              {playlistChannels.length > 0 && (
                <div className="text-center text-muted-foreground text-sm shrink-0">
                  Clique em um canal para editar ou arraste para reordenar
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
