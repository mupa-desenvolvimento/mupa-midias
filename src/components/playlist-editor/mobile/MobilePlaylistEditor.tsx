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
import { EditorCanvas } from "../EditorCanvas";
import { EditorPropertiesPanel } from "../EditorPropertiesPanel";
import { ChannelsList } from "../ChannelsList";
import { PlaylistSettings } from "../PlaylistSettings";
import { CampaignDrawer } from "../CampaignDrawer";
import { EditItemDrawer } from "../EditItemDrawer";
import { MobileTimeline } from "./MobileTimeline";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ArrowLeft,
  Save,
  Loader2,
  Check,
  Folder,
  Film,
  Settings,
  Play,
  Pause,
  Monitor,
  Pencil,
} from "lucide-react";
import { Input } from "@/components/ui/input";
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

type MobilePanel = "campaigns" | "media" | "settings" | null;

export const MobilePlaylistEditor = () => {
  const navigate = useNavigate();
  const { id: playlistId } = useParams<{ id: string }>();
  const { toast } = useToast();

  const { playlists, updatePlaylist, createPlaylist } = usePlaylists();
  const { channels: distributionChannels } = useChannels();
  const { devices } = useDevices();
  const [createdPlaylistId, setCreatedPlaylistId] = useState<string | null>(null);

  const activePlaylistId = createdPlaylistId || playlistId || null;

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

  const [activePanel, setActivePanel] = useState<MobilePanel>(null);
  const [drawerChannel, setDrawerChannel] = useState<PlaylistChannel | null>(null);
  const [editingItem, setEditingItem] = useState<PlaylistChannelItem | null>(null);

  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingDevices, setIsUpdatingDevices] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [localName, setLocalName] = useState("");

  useEffect(() => {
    if (formData.name) setLocalName(formData.name);
  }, [formData.name]);

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
          sum + (e.item.duration_override || e.item.media?.duration || 8),
        0
      ),
    [flatTimelineItems]
  );

  const currentPreviewEntry = flatTimelineItems[currentPreviewIndex];
  const currentPreviewItem = currentPreviewEntry
    ? ({
        ...currentPreviewEntry.item,
        playlist_id: activePlaylistId || "",
      } as any)
    : undefined;

  const handleAddMediaToActiveCampaign = useCallback(
    async (media: MediaItem) => {
      const targetChannel = drawerChannel || playlistChannels[0];
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
        toast({ title: `Mídia adicionada à "${targetChannel.name}"` });
        window.dispatchEvent(new Event("focus"));
      }
    },
    [drawerChannel, playlistChannels, toast]
  );

  const handleRemoveItem = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from("playlist_channel_items")
        .delete()
        .eq("id", id);
      if (error) {
        toast({
          title: "Erro ao remover",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({ title: "Mídia removida" });
        window.dispatchEvent(new Event("focus"));
      }
      if (selectedItemId === id) setSelectedItemId(null);
    },
    [selectedItemId, toast]
  );

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      setActivePanel("settings");
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

  const closePanel = () => setActivePanel(null);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background text-foreground">
      <header className="h-14 shrink-0 flex items-center gap-2 px-3 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/admin/playlists")}
          className="h-11 w-11 -ml-2 shrink-0"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>

        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold truncate leading-tight">
            {formData.name || "Novo Projeto"}
          </h1>
          <div className="flex items-center gap-1.5 text-[11px] leading-tight">
            {hasUnsavedChanges ? (
              <span className="text-amber-500 font-medium">● Editando</span>
            ) : (
              <span className="text-emerald-500 font-medium">✓ Salvo</span>
            )}
            <span className="text-muted-foreground">
              · {flatTimelineItems.length}{" "}
              {flatTimelineItems.length === 1 ? "mídia" : "mídias"}
            </span>
          </div>
        </div>

        {connectedDevices.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0 relative"
            onClick={handleUpdateDevices}
            disabled={isUpdatingDevices}
            aria-label="Sincronizar dispositivos"
          >
            {isUpdatingDevices ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Monitor className="w-5 h-5" />
            )}
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-primary text-[9px] text-primary-foreground font-bold flex items-center justify-center">
              {connectedDevices.length}
            </span>
          </Button>
        )}

        <Button
          onClick={handleSave}
          disabled={isSaving || !hasUnsavedChanges}
          size="sm"
          className={cn(
            "h-10 px-3 gap-1.5 shrink-0 font-medium",
            hasUnsavedChanges
              ? "bg-amber-600 hover:bg-amber-700 text-white"
              : "bg-muted text-muted-foreground"
          )}
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : hasUnsavedChanges ? (
            <Save className="w-4 h-4" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          <span className="text-xs">
            {isSaving ? "Salvando" : hasUnsavedChanges ? "Salvar" : "Salvo"}
          </span>
        </Button>
      </header>

      <div className="shrink-0 bg-black relative" style={{ aspectRatio: "16/9" }}>
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
            zoom={100}
            onZoomChange={() => {}}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 text-white/70">
            <Folder className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">Playlist vazia</p>
            <p className="text-xs mt-1 opacity-70">
              Crie uma campanha e adicione mídias
            </p>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <MobileTimeline
          items={flatTimelineItems}
          currentPreviewIndex={currentPreviewIndex}
          selectedItemId={selectedItemId}
          isPlaying={isPreviewPlaying}
          onSelectItem={(id, idx) => {
            setSelectedItemId(id);
            setCurrentPreviewIndex(idx);
          }}
          onEditItem={(item) => setEditingItem(item)}
          onRemoveItem={handleRemoveItem}
          onReorderGlobal={(updates) => reorderGlobalItems.mutate(updates)}
          totalDuration={totalDuration}
        />
      </div>

      <nav
        className="shrink-0 border-t bg-card/95 backdrop-blur grid grid-cols-4 gap-1 px-2 py-2"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        <Button
          variant={activePanel === "campaigns" ? "secondary" : "ghost"}
          className="h-12 flex-col gap-0.5 px-1 rounded-lg"
          onClick={() =>
            setActivePanel(activePanel === "campaigns" ? null : "campaigns")
          }
        >
          <Folder className="w-5 h-5" />
          <span className="text-[10px] font-medium">Campanhas</span>
        </Button>

        <Button
          variant={activePanel === "media" ? "secondary" : "ghost"}
          className="h-12 flex-col gap-0.5 px-1 rounded-lg"
          onClick={() => setActivePanel(activePanel === "media" ? null : "media")}
        >
          <Film className="w-5 h-5" />
          <span className="text-[10px] font-medium">Mídias</span>
        </Button>

        <Button
          variant="default"
          className="h-12 flex-col gap-0.5 px-1 rounded-lg"
          onClick={() => setIsPreviewPlaying(!isPreviewPlaying)}
          disabled={flatTimelineItems.length === 0}
        >
          {isPreviewPlaying ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5 ml-0.5" />
          )}
          <span className="text-[10px] font-medium">
            {isPreviewPlaying ? "Pausar" : "Tocar"}
          </span>
        </Button>

        <Button
          variant={activePanel === "settings" ? "secondary" : "ghost"}
          className="h-12 flex-col gap-0.5 px-1 rounded-lg"
          onClick={() =>
            setActivePanel(activePanel === "settings" ? null : "settings")
          }
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px] font-medium">Ajustes</span>
        </Button>
      </nav>

      <Sheet
        open={activePanel !== null}
        onOpenChange={(open) => !open && closePanel()}
      >
        <SheetContent
          side="bottom"
          className="h-[85vh] p-0 flex flex-col rounded-t-2xl"
        >
          <SheetHeader className="px-4 py-3 border-b shrink-0">
            <div className="mx-auto -mt-1 mb-2 h-1.5 w-12 rounded-full bg-muted" />
            <SheetTitle className="text-base text-left">
              {activePanel === "campaigns" && "Campanhas"}
              {activePanel === "media" && "Adicionar Mídia"}
              {activePanel === "settings" && "Configurações"}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-hidden">
            {activePanel === "campaigns" && (
              <ChannelsList
                channels={playlistChannels}
                activeChannelId={drawerChannel?.id || null}
                onSelectChannel={(c) => {
                  setDrawerChannel(c);
                  closePanel();
                }}
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

            {activePanel === "media" && (
              <EditorPropertiesPanel
                activePanel="media"
                formData={formData}
                channels={distributionChannels}
                itemCount={flatTimelineItems.length}
                totalDuration={totalDuration}
                connectedDevicesCount={connectedDevices.length}
                onFormChange={handleFormChange}
                onAddMedia={(media) => {
                  handleAddMediaToActiveCampaign(media);
                  closePanel();
                }}
                itemsLength={flatTimelineItems.length}
                onAddAutoContent={() => {}}
              />
            )}

            {activePanel === "settings" && (
              <PlaylistSettings
                playlist={formData}
                channels={distributionChannels}
                itemCount={flatTimelineItems.length}
                totalDuration={totalDuration}
                onChange={handleFormChange}
                connectedDevicesCount={connectedDevices.length}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <CampaignDrawer
        channel={drawerChannel}
        isOpen={!!drawerChannel}
        onClose={() => setDrawerChannel(null)}
        onUpdateChannel={(id, updates) =>
          updateChannel.mutate({ id, ...updates })
        }
      />

      <EditItemDrawer
        item={editingItem}
        channel={
          editingItem
            ? channelsWithItems.find((c) => c.id === editingItem.channel_id) ||
              null
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
