import { useState, useCallback, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePlaylists } from "@/hooks/usePlaylists";
import { usePlaylistItems } from "@/hooks/usePlaylistItems";
import { usePlaylistChannels, PlaylistChannel, usePlaylistChannelItems } from "@/hooks/usePlaylistChannels";
import { useChannels } from "@/hooks/useChannels";
import { useDevices } from "@/hooks/useDevices";
import { MediaItem } from "@/hooks/useMediaItems";
import { AutoContentItem } from "@/hooks/useAutoContent";
import { EditorCanvas } from "./EditorCanvas";
import { EditorTimeline } from "./EditorTimeline";
import { EditorHeader } from "./EditorHeader";
import { EditorPropertiesPanel } from "./EditorPropertiesPanel";
import { ChannelsList } from "./ChannelsList";
import { PlaylistSettings } from "./PlaylistSettings";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/services/firebase";
import { ref, update } from "firebase/database";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Radio, 
  Layers, 
  Folder, 
  Film, 
  Settings, 
  Plus, 
  ChevronRight, 
  ChevronLeft,
  LayoutList,
  Box,
  Monitor
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PlaylistFormData {
  name: string;
  description: string | null;
  channel_id: string | null;
  is_active: boolean;
  is_default: boolean;
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
  
  // Playlist channels (campaigns)
  const {
    channels: playlistChannels,
    isLoading: channelsLoading,
    createChannel,
    updateChannel,
    deleteChannel,
    reorderChannels,
  } = usePlaylistChannels(activePlaylistId);
  
  const [activeSidebarTab, setActiveSidebarTab] = useState<"campaigns" | "media" | "settings">("campaigns");
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState<PlaylistChannel | null>(null);
  
  // Fetch items for the selected channel
  const { 
    items: channelItems, 
    isLoading: itemsLoading, 
    addItem: addChannelItem, 
    removeItem: removeChannelItem, 
    updateItem: updateChannelItem, 
    reorderItems: reorderChannelItems,
    getTotalDuration: getChannelTotalDuration 
  } = usePlaylistChannelItems(selectedChannel?.id || null);

  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingDevices, setIsUpdatingDevices] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [zoom, setZoom] = useState(100);

  // Auto-select first channel if none selected
  useEffect(() => {
    if (!selectedChannel && playlistChannels.length > 0) {
      setSelectedChannel(playlistChannels[0]);
    }
  }, [playlistChannels, selectedChannel]);

  const existingPlaylist = playlists.find((p) => p.id === activePlaylistId);
  const connectedDevices = devices.filter(d => d.current_playlist_id === activePlaylistId);

  const [formData, setFormData] = useState<PlaylistFormData>({
    name: "",
    description: null,
    channel_id: null,
    is_active: true,
    is_default: false,
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
        is_default: existingPlaylist.is_default ?? false,
        start_date: (schedule?.start_date as string) || null,
        end_date: (schedule?.end_date as string) || null,
        days_of_week: (schedule?.days_of_week as number[]) || [0, 1, 2, 3, 4, 5, 6],
        start_time: (schedule?.start_time as string) || "00:00",
        end_time: (schedule?.end_time as string) || "23:59",
        priority: (schedule?.priority as number) || 5,
        content_scale: contentScale || 'cover',
      });
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
      is_default: formData.is_default,
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
    if (!selectedChannel) {
      toast({ title: "Selecione uma campanha primeiro", variant: "destructive" });
      return;
    }
    
    const itemDuration = (media.type === "video" && media.duration) ? media.duration : (media.duration ?? 8);
    
    addChannelItem.mutate({
      channel_id: selectedChannel.id,
      media_id: media.id,
      position,
      duration_override: itemDuration,
    });
  }, [selectedChannel, addChannelItem, toast]);

  const handleRemoveItem = useCallback((id: string) => {
    removeChannelItem.mutate(id);
    if (selectedItemId === id) {
      setSelectedItemId(null);
    }
  }, [removeChannelItem, selectedItemId]);

  const handleDuplicateItem = useCallback(async (item: any) => {
    if (!selectedChannel) return;
    
    addChannelItem.mutate({
      channel_id: selectedChannel.id,
      media_id: item.media_id,
      position: channelItems.length,
      duration_override: item.duration_override,
    });
  }, [channelItems.length, addChannelItem, selectedChannel]);

  const handleUpdateDuration = useCallback((id: string, duration: number) => {
    updateChannelItem.mutate({ id, duration_override: duration });
  }, [updateChannelItem]);

  const handleUpdateItemSettings = useCallback((id: string, updates: any) => {
    updateChannelItem.mutate({ id, ...updates });
  }, [updateChannelItem]);

  const handleReorderItems = useCallback((orderedItems: { id: string; position: number }[]) => {
    reorderChannelItems.mutate(orderedItems);
  }, [reorderChannelItems]);

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
      is_default: formData.is_default,
      schedule,
      content_scale: formData.content_scale,
      has_channels: true,
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
      toast({ title: "Salve a playlist primeiro", variant: "destructive" });
      return;
    }

    setIsUpdatingDevices(true);
    try {
      await supabase.from("playlists").update({ updated_at: new Date().toISOString() }).eq("id", activePlaylistId);
      toast({ title: "Sincronização enviada!" });
    } catch (error) {
      toast({ title: "Erro ao sincronizar", variant: "destructive" });
    } finally {
      setIsUpdatingDevices(false);
    }
  };

  const sidebarItems = [
    { id: "campaigns", icon: Folder, label: "Campanhas" },
    { id: "media", icon: Film, label: "Mídias" },
    { id: "settings", icon: Settings, label: "Configurações" },
  ];

  const currentPreviewItem = channelItems[currentPreviewIndex];
  const totalDuration = getChannelTotalDuration();

  // Adapt channelItems to match PlaylistItem type expected by EditorTimeline
  const adaptedItems = useMemo(() => {
    return channelItems.map(item => ({
      ...item,
      playlist_id: activePlaylistId || "",
    }));
  }, [channelItems, activePlaylistId]) as any;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-background text-foreground overflow-hidden -m-3 md:-m-4 lg:-m-6">
      {/* Editor Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* 1. COMPACT LEFT SIDEBAR */}
        <div className="w-16 border-r bg-card flex flex-col items-center py-4 gap-4 z-20 shrink-0">
          <TooltipProvider>
            {sidebarItems.map((item) => (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeSidebarTab === item.id ? "secondary" : "ghost"}
                    size="icon"
                    className={cn(
                      "w-10 h-10 rounded-xl transition-all",
                      activeSidebarTab === item.id ? "bg-primary/10 text-primary hover:bg-primary/20" : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => {
                      setActiveSidebarTab(item.id as any);
                      setIsSidebarExpanded(true);
                    }}
                  >
                    <item.icon className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{item.label}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
          
          <div className="mt-auto pb-4">
             <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-10 h-10 rounded-xl text-muted-foreground hover:text-foreground"
                    onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                  >
                    {isSidebarExpanded ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{isSidebarExpanded ? "Colapsar menu" : "Expandir menu"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* 2. EXPANDED SIDE PANEL */}
        {isSidebarExpanded && (
          <div className="w-80 border-r bg-card flex flex-col overflow-hidden z-10 animate-in slide-in-from-left duration-200 shrink-0">
            {activeSidebarTab === "campaigns" && (
              <ChannelsList
                channels={playlistChannels}
                activeChannelId={selectedChannel?.id || null}
                onSelectChannel={setSelectedChannel}
                onCreateChannel={(data) => createChannel.mutate({ ...data, playlist_id: activePlaylistId || "" })}
                onUpdateChannel={(id, data) => updateChannel.mutate({ id, ...data })}
                onDeleteChannel={(id) => deleteChannel.mutate(id)}
                onReorderChannels={(ordered) => reorderChannels.mutate(ordered)}
                playlistId={activePlaylistId || ""}
                playlistName={formData.name || "Nova Playlist"}
              />
            )}
            
            {activeSidebarTab === "media" && (
              <div className="flex-1 overflow-hidden">
                <EditorPropertiesPanel
                  activePanel="media"
                  formData={formData}
                  channels={distributionChannels}
                  itemCount={channelItems.length}
                  totalDuration={totalDuration}
                  connectedDevicesCount={connectedDevices.length}
                  onFormChange={handleFormChange}
                  onAddMedia={handleAddMedia}
                  itemsLength={channelItems.length}
                  onAddAutoContent={() => {}} // Not implemented for channels yet in this view
                />
              </div>
            )}
            
            {activeSidebarTab === "settings" && (
              <div className="flex-1 overflow-hidden">
                <PlaylistSettings
                  playlist={formData}
                  channels={distributionChannels}
                  itemCount={channelItems.length}
                  totalDuration={totalDuration}
                  onChange={handleFormChange}
                  connectedDevicesCount={connectedDevices.length}
                />
              </div>
            )}
          </div>
        )}

        {/* 3. MAIN CONTENT AREA */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
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

          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Center Area - Canvas/Preview */}
            <div className="flex-1 flex flex-col min-h-0 bg-muted/20">
              {selectedChannel ? (
                <div className="flex-1 flex flex-col min-h-0">
                   {/* Campaign Info Bar */}
                   <div className="px-6 py-3 border-b bg-card flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Monitor className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold">{selectedChannel.name}</h2>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <Layers className="w-3 h-3" />
                            {channelItems.length} mídias
                          </span>
                          <span className="opacity-30">|</span>
                          <span className="flex items-center gap-1">
                            <Folder className="w-3 h-3" />
                            {selectedChannel.start_time.slice(0, 5)} - {selectedChannel.end_time.slice(0, 5)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <EditorCanvas
                    currentItem={currentPreviewItem}
                    isPlaying={isPreviewPlaying}
                    onTogglePlay={() => setIsPreviewPlaying(!isPreviewPlaying)}
                    onPrevious={() => setCurrentPreviewIndex(Math.max(0, currentPreviewIndex - 1))}
                    onNext={() => {
                      if (currentPreviewIndex >= channelItems.length - 1) {
                        setCurrentPreviewIndex(0);
                      } else {
                        setCurrentPreviewIndex(currentPreviewIndex + 1);
                      }
                    }}
                    currentIndex={currentPreviewIndex}
                    totalItems={channelItems.length}
                    zoom={zoom}
                    onZoomChange={setZoom}
                  />
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <Folder className="w-8 h-8 text-muted-foreground/50" />
                  </div>
                  <h3 className="text-lg font-semibold">Nenhuma Campanha Selecionada</h3>
                  <p className="text-muted-foreground max-w-sm mt-2">
                    Selecione uma campanha no painel à esquerda para visualizar e editar seu conteúdo na timeline.
                  </p>
                  <Button 
                    className="mt-6 gap-2" 
                    variant="outline"
                    onClick={() => {
                      setActiveSidebarTab("campaigns");
                      setIsSidebarExpanded(true);
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    Criar primeira campanha
                  </Button>
                </div>
              )}
            </div>

            {/* Bottom Area - Timeline */}
            <div className="shrink-0 h-[280px]">
              <EditorTimeline
                items={adaptedItems}
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
          </div>
        </div>

      </div>
    </div>
  );
};
