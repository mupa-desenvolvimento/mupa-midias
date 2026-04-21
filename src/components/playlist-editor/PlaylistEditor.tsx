import { useState, useCallback, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePlaylists } from "@/hooks/usePlaylists";
import {
  usePlaylistChannels,
  PlaylistChannel,
  PlaylistChannelItem,
} from "@/hooks/usePlaylistChannels";
import { useChannels } from "@/hooks/useChannels";
import { useDevices } from "@/hooks/useDevices";
import { MediaItem } from "@/hooks/useMediaItems";
import { EditorCanvas } from "./EditorCanvas";
import { EditorHeader } from "./EditorHeader";
import { EditorPropertiesPanel } from "./EditorPropertiesPanel";
import { ChannelsList } from "./ChannelsList";
import { PlaylistSettings } from "./PlaylistSettings";
import { GlobalTimeline } from "./GlobalTimeline";
import { CampaignDrawer } from "./CampaignDrawer";
import { EditItemDrawer } from "./EditItemDrawer";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Folder,
  Film,
  Settings,
  Plus,
  ChevronRight,
  ChevronLeft,
  Box,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  content_scale: "cover" | "contain" | "fill";
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

  // Playlist channels (campaigns) + items in one query
  const {
    channels: playlistChannels,
    channelsWithItems,
    createChannel,
    updateChannel,
    deleteChannel,
    reorderChannels,
    reorderGlobalItems,
    updateChannelItem,
  } = usePlaylistChannels(activePlaylistId);

  // Sidebar state
  const [activeSidebarTab, setActiveSidebarTab] = useState<
    "campaigns" | "media" | "settings"
  >("campaigns");
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  // Drawer state
  const [drawerChannel, setDrawerChannel] = useState<PlaylistChannel | null>(null);
  const [editingItem, setEditingItem] = useState<PlaylistChannelItem | null>(null);

  // Player state
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingDevices, setIsUpdatingDevices] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [zoom, setZoom] = useState(100);

  const existingPlaylist = playlists.find((p) => p.id === activePlaylistId);
  const connectedDevices = devices.filter(
    (d) => d.current_playlist_id === activePlaylistId
  );

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
    content_scale: "cover",
  });

  useEffect(() => {
    if (existingPlaylist) {
      const schedule = existingPlaylist.schedule as Record<string, unknown> | null;
      const contentScale = (existingPlaylist as any).content_scale as
        | "cover"
        | "contain"
        | "fill"
        | null;
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
        content_scale: contentScale || "cover",
      });
    }
  }, [existingPlaylist]);

  const handleFormChange = useCallback((updates: Partial<PlaylistFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
  }, []);

  // Build flat timeline (all items from all campaigns)
  const flatTimelineItems = useMemo(() => {
    const items: Array<{
      item: PlaylistChannelItem;
      channel: PlaylistChannel;
    }> = [];
    channelsWithItems.forEach((channel) => {
      channel.items?.forEach((item) => {
        items.push({ item, channel });
      });
    });
    items.sort(
      (a, b) => (a.item.global_position ?? 0) - (b.item.global_position ?? 0)
    );
    return items;
  }, [channelsWithItems]);

  const totalDuration = useMemo(
    () =>
      flatTimelineItems.reduce(
        (sum, e) =>
          sum +
          (e.item.duration_override || e.item.media?.duration || 8),
        0
      ),
    [flatTimelineItems]
  );

  // Adapt current item for canvas preview
  const currentPreviewEntry = flatTimelineItems[currentPreviewIndex];
  const currentPreviewItem = currentPreviewEntry
    ? ({
        ...currentPreviewEntry.item,
        playlist_id: activePlaylistId || "",
      } as any)
    : undefined;

  // Handlers
  const handleSelectChannel = useCallback((channel: PlaylistChannel) => {
    setDrawerChannel(channel);
  }, []);

  const handleEditItem = useCallback((item: PlaylistChannelItem) => {
    setEditingItem(item);
  }, []);

  const handleRemoveItem = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from("playlist_channel_items")
        .delete()
        .eq("id", id);
      if (error) {
        toast({
          title: "Erro ao remover mídia",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({ title: "Mídia removida" });
        // Trigger refetch via invalidating channel items handled by hook on operations.
        // Force a manual re-trigger by toggling state if needed; the channelsWithItems query
        // will re-run on focus / next mount. To make UX immediate, we do a hard refetch.
        window.dispatchEvent(new Event("focus"));
      }
      if (selectedItemId === id) setSelectedItemId(null);
    },
    [selectedItemId, toast]
  );

  const handleAddMediaToActiveCampaign = useCallback(
    async (media: MediaItem) => {
      const targetChannel =
        drawerChannel || playlistChannels[0];
      if (!targetChannel) {
        toast({
          title: "Crie uma campanha primeiro",
          variant: "destructive",
        });
        return;
      }
      const dur =
        media.type === "video" && media.duration
          ? media.duration
          : media.duration ?? 8;

      const { error } = await supabase
        .from("playlist_channel_items")
        .insert([
          {
            channel_id: targetChannel.id,
            media_id: media.id,
            position: targetChannel.item_count || 0,
            duration_override: dur,
          },
        ]);
      if (error) {
        toast({
          title: "Erro ao adicionar mídia",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({ title: `Mídia adicionada à campanha "${targetChannel.name}"` });
        window.dispatchEvent(new Event("focus"));
      }
    },
    [drawerChannel, playlistChannels, toast]
  );

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
        await updatePlaylist.mutateAsync({
          id: activePlaylistId,
          ...playlistData,
        });
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
      await supabase
        .from("playlists")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", activePlaylistId);
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
    { id: "elements", icon: Box, label: "Elementos (Breve)", disabled: true },
    { id: "settings", icon: Settings, label: "Configurações" },
  ];

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-background text-foreground overflow-hidden -m-3 md:-m-4 lg:-m-6">
      <div className="flex-1 flex overflow-hidden">
        {/* Compact Left Sidebar */}
        <div className="w-16 border-r bg-card flex flex-col items-center py-4 gap-3 z-20 shrink-0">
          <TooltipProvider delayDuration={300}>
            {sidebarItems.map((item) => (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeSidebarTab === item.id ? "secondary" : "ghost"}
                    size="icon"
                    disabled={item.disabled}
                    className={cn(
                      "w-10 h-10 rounded-xl transition-all",
                      activeSidebarTab === item.id
                        ? "bg-primary/10 text-primary hover:bg-primary/20"
                        : "text-muted-foreground hover:text-foreground"
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

            <div className="mt-auto pt-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-10 h-10 rounded-xl text-muted-foreground hover:text-foreground"
                    onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                  >
                    {isSidebarExpanded ? (
                      <ChevronLeft className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{isSidebarExpanded ? "Recolher" : "Expandir"}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>

        {/* Expanded Side Panel */}
        {isSidebarExpanded && (
          <div className="w-80 border-r bg-card flex flex-col overflow-hidden z-10 shrink-0 animate-in slide-in-from-left duration-200">
            {activeSidebarTab === "campaigns" && (
              <ChannelsList
                channels={playlistChannels}
                activeChannelId={drawerChannel?.id || null}
                onSelectChannel={handleSelectChannel}
                onCreateChannel={(data) =>
                  createChannel.mutate({
                    ...data,
                    playlist_id: activePlaylistId || "",
                  })
                }
                onUpdateChannel={(id, data) =>
                  updateChannel.mutate({ id, ...data })
                }
                onDeleteChannel={(id) => deleteChannel.mutate(id)}
                onReorderChannels={(ordered) =>
                  reorderChannels.mutate(ordered)
                }
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
                  itemCount={flatTimelineItems.length}
                  totalDuration={totalDuration}
                  connectedDevicesCount={connectedDevices.length}
                  onFormChange={handleFormChange}
                  onAddMedia={(media) => handleAddMediaToActiveCampaign(media)}
                  itemsLength={flatTimelineItems.length}
                  onAddAutoContent={() => {}}
                />
              </div>
            )}

            {activeSidebarTab === "settings" && (
              <div className="flex-1 overflow-hidden">
                <PlaylistSettings
                  playlist={formData}
                  channels={distributionChannels}
                  itemCount={flatTimelineItems.length}
                  totalDuration={totalDuration}
                  onChange={handleFormChange}
                  connectedDevicesCount={connectedDevices.length}
                />
              </div>
            )}
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
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
            {/* Preview Canvas (top) */}
            <div className="flex-1 flex flex-col min-h-0 bg-muted/20">
              {flatTimelineItems.length > 0 ? (
                <EditorCanvas
                  currentItem={currentPreviewItem}
                  isPlaying={isPreviewPlaying}
                  onTogglePlay={() => setIsPreviewPlaying(!isPreviewPlaying)}
                  onPrevious={() =>
                    setCurrentPreviewIndex(Math.max(0, currentPreviewIndex - 1))
                  }
                  onNext={() => {
                    if (currentPreviewIndex >= flatTimelineItems.length - 1) {
                      setCurrentPreviewIndex(0);
                    } else {
                      setCurrentPreviewIndex(currentPreviewIndex + 1);
                    }
                  }}
                  currentIndex={currentPreviewIndex}
                  totalItems={flatTimelineItems.length}
                  zoom={zoom}
                  onZoomChange={setZoom}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <Folder className="w-8 h-8 text-muted-foreground/50" />
                  </div>
                  <h3 className="text-lg font-semibold">Playlist vazia</h3>
                  <p className="text-muted-foreground max-w-sm mt-2">
                    Crie uma campanha e adicione mídias para começar a montar
                    sua programação.
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

            {/* Global Timeline (bottom) - SOURCE OF TRUTH */}
            <div className="shrink-0 h-[260px]">
              <GlobalTimeline
                channelsWithItems={channelsWithItems}
                selectedItemId={selectedItemId}
                currentPreviewIndex={currentPreviewIndex}
                isPlaying={isPreviewPlaying}
                onSelectItem={setSelectedItemId}
                onSetPreviewIndex={setCurrentPreviewIndex}
                onTogglePlay={() => setIsPreviewPlaying(!isPreviewPlaying)}
                onPrevious={() =>
                  setCurrentPreviewIndex(Math.max(0, currentPreviewIndex - 1))
                }
                onNext={() => {
                  if (currentPreviewIndex >= flatTimelineItems.length - 1) {
                    setCurrentPreviewIndex(0);
                  } else {
                    setCurrentPreviewIndex(currentPreviewIndex + 1);
                  }
                }}
                onEditItem={handleEditItem}
                onRemoveItem={handleRemoveItem}
                onSelectChannel={handleSelectChannel}
                onReorderGlobal={(updates) => reorderGlobalItems.mutate(updates)}
                onAddMedia={handleAddMediaToActiveCampaign}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Drawers */}
      <CampaignDrawer
        channel={drawerChannel}
        isOpen={!!drawerChannel}
        onClose={() => setDrawerChannel(null)}
        onUpdateChannel={(id, updates) => updateChannel.mutate({ id, ...updates })}
      />

      <EditItemDrawer
        item={editingItem}
        channel={
          editingItem
            ? channelsWithItems.find((c) => c.id === editingItem.channel_id) || null
            : null
        }
        channels={playlistChannels}
        isOpen={!!editingItem}
        onClose={() => setEditingItem(null)}
        onSave={(id, updates) => {
          updateChannelItem.mutate({ id, ...updates });
          setEditingItem(null);
        }}
        onChangeChannel={(channel) => {
          setEditingItem(null);
          setDrawerChannel(channel);
        }}
      />
    </div>
  );
};
