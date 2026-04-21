import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { PlaylistChannelWithItems, PlaylistChannelItem, PlaylistChannel } from "@/hooks/usePlaylistChannels";
import { MediaItem } from "@/hooks/useMediaItems";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Clock,
  Trash2,
  Edit,
  Eye,
  Lock,
  MoreVertical,
  GripVertical,
  Image as ImageIcon,
  Video,
  FileText,
  ZoomIn,
  ZoomOut,
  Folder,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface TimelineItem {
  item: PlaylistChannelItem;
  channel: PlaylistChannel;
  channelIndex: number;
  duration: number;
}

interface GlobalTimelineProps {
  channelsWithItems: PlaylistChannelWithItems[];
  selectedItemId: string | null;
  currentPreviewIndex: number;
  isPlaying: boolean;
  onSelectItem: (id: string | null) => void;
  onSetPreviewIndex: (index: number) => void;
  onTogglePlay: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onEditItem: (item: PlaylistChannelItem) => void;
  onRemoveItem: (id: string) => void;
  onSelectChannel: (channel: PlaylistChannel) => void;
  onReorderGlobal: (updates: { itemId: string; channelId: string; position: number }[]) => void;
  onAddMedia?: (media: MediaItem) => void;
}

// Mupa-themed campaign label colors (semantic tokens, neutral accents)
const campaignAccents = [
  "border-l-blue-500 bg-blue-500/5",
  "border-l-emerald-500 bg-emerald-500/5",
  "border-l-amber-500 bg-amber-500/5",
  "border-l-rose-500 bg-rose-500/5",
  "border-l-violet-500 bg-violet-500/5",
  "border-l-cyan-500 bg-cyan-500/5",
  "border-l-orange-500 bg-orange-500/5",
  "border-l-pink-500 bg-pink-500/5",
];

const campaignBadgeColors = [
  "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
  "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20",
];

const getMediaIcon = (type?: string) => {
  switch (type) {
    case "video":
      return Video;
    case "image":
      return ImageIcon;
    default:
      return FileText;
  }
};

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins > 0) return `${mins}:${secs.toString().padStart(2, "0")}`;
  return `${secs}s`;
};

export const GlobalTimeline = ({
  channelsWithItems,
  selectedItemId,
  currentPreviewIndex,
  isPlaying,
  onSelectItem,
  onSetPreviewIndex,
  onTogglePlay,
  onPrevious,
  onNext,
  onEditItem,
  onRemoveItem,
  onSelectChannel,
  onReorderGlobal,
  onAddMedia,
}: GlobalTimelineProps) => {
  const [zoom, setZoom] = useState(100);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [isDragOverEmpty, setIsDragOverEmpty] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build flat timeline of all items from all campaigns
  const flatItems = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];
    channelsWithItems.forEach((channel, channelIndex) => {
      if (channel.items?.length) {
        channel.items.forEach((item) => {
          items.push({
            item,
            channel,
            channelIndex,
            duration: item.duration_override || item.media?.duration || 8,
          });
        });
      }
    });
    items.sort((a, b) => (a.item.global_position ?? 0) - (b.item.global_position ?? 0));
    return items;
  }, [channelsWithItems]);

  const totalDuration = useMemo(
    () => flatItems.reduce((sum, i) => sum + i.duration, 0),
    [flatItems]
  );

  const getItemWidth = (duration: number) => {
    const base = 140;
    const scaled = (duration / 8) * (zoom * 1.2);
    return Math.max(base, scaled);
  };

  // Drag handlers for reordering
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.setData("text/plain", index.toString());
    e.dataTransfer.effectAllowed = "move";
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.stopPropagation();
      if (draggedIndex !== null && draggedIndex !== index) {
        setDropTargetIndex(index);
      }
    },
    [draggedIndex]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      e.stopPropagation();
      setDropTargetIndex(null);

      // Handle media drag from library
      const mediaData = e.dataTransfer.getData("application/json");
      if (mediaData && onAddMedia) {
        try {
          const media = JSON.parse(mediaData) as MediaItem;
          onAddMedia(media);
          setDraggedIndex(null);
          return;
        } catch {
          // not media drop
        }
      }

      const dragIndexStr = e.dataTransfer.getData("text/plain");
      if (dragIndexStr && draggedIndex !== null) {
        const dragIndex = parseInt(dragIndexStr, 10);
        if (dragIndex !== dropIndex && !isNaN(dragIndex)) {
          const newItems = [...flatItems];
          const [moved] = newItems.splice(dragIndex, 1);
          newItems.splice(dropIndex, 0, moved);
          onReorderGlobal(
            newItems.map((it, idx) => ({
              itemId: it.item.id,
              channelId: it.item.channel_id,
              position: idx,
            }))
          );
        }
      }
      setDraggedIndex(null);
    },
    [flatItems, draggedIndex, onReorderGlobal, onAddMedia]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDropTargetIndex(null);
  }, []);

  const handleEmptyDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOverEmpty(false);
      const mediaData = e.dataTransfer.getData("application/json");
      if (mediaData && onAddMedia) {
        try {
          const media = JSON.parse(mediaData) as MediaItem;
          onAddMedia(media);
        } catch {
          // ignore
        }
      }
    },
    [onAddMedia]
  );

  return (
    <div className="flex flex-col h-full bg-card border-t">
      {/* Timeline Header / Controls */}
      <div className="h-12 flex items-center justify-between px-4 border-b shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Folder className="w-4 h-4 text-primary" />
            Linha do Tempo Global
          </h3>
          <Badge variant="outline" className="text-[10px] gap-1 font-mono h-5">
            <Clock className="w-3 h-3" />
            {formatDuration(totalDuration)}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {flatItems.length} {flatItems.length === 1 ? "mídia" : "mídias"}
          </span>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onPrevious}
            disabled={currentPreviewIndex <= 0}
          >
            <SkipBack className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={onTogglePlay}
            disabled={flatItems.length === 0}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onNext}
            disabled={currentPreviewIndex >= flatItems.length - 1}
          >
            <SkipForward className="w-4 h-4" />
          </Button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setZoom((z) => Math.max(50, z - 25))}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <Slider
            value={[zoom]}
            onValueChange={([v]) => setZoom(v)}
            min={50}
            max={200}
            step={25}
            className="w-24"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setZoom((z) => Math.min(200, z + 25))}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <span className="text-[10px] text-muted-foreground w-8 font-mono">{zoom}%</span>
        </div>
      </div>

      {/* Timeline Content */}
      <div className="flex-1 overflow-hidden bg-muted/20">
        {flatItems.length === 0 ? (
          <div
            className={cn(
              "h-full flex items-center justify-center transition-all",
              isDragOverEmpty && "bg-primary/5"
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOverEmpty(true);
            }}
            onDragLeave={() => setIsDragOverEmpty(false)}
            onDrop={handleEmptyDrop}
          >
            <div
              className={cn(
                "flex flex-col items-center gap-3 px-12 py-8 rounded-xl border-2 border-dashed transition-all",
                isDragOverEmpty ? "border-primary bg-primary/10 scale-105" : "border-border"
              )}
            >
              <div className="p-3 rounded-full bg-muted">
                <Plus className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Timeline vazia</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Adicione mídias às campanhas para vê-las aqui
                </p>
              </div>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full" ref={scrollRef as any}>
            <div className="flex items-stretch gap-2 p-4 min-w-max h-full">
              {flatItems.map((entry, index) => {
                const { item, channel, channelIndex, duration } = entry;
                const isSelected = selectedItemId === item.id;
                const isCurrent = currentPreviewIndex === index;
                const isDragging = draggedIndex === index;
                const isDropTarget =
                  dropTargetIndex === index && draggedIndex !== null && draggedIndex !== index;
                const Icon = getMediaIcon(item.media?.type);
                const width = getItemWidth(duration);
                const accentClass = campaignAccents[channelIndex % campaignAccents.length];
                const badgeClass = campaignBadgeColors[channelIndex % campaignBadgeColors.length];

                return (
                  <TooltipProvider key={item.id} delayDuration={400}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="relative flex items-stretch">
                          {/* Drop indicator left */}
                          {isDropTarget && draggedIndex! > index && (
                            <div className="absolute -left-1.5 top-0 bottom-0 w-1 bg-primary rounded-full z-20 animate-pulse" />
                          )}

                          <div
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDrop={(e) => handleDrop(e, index)}
                            onDragEnd={handleDragEnd}
                            onClick={() => {
                              onSelectItem(item.id);
                              onSetPreviewIndex(index);
                            }}
                            className={cn(
                              "group relative shrink-0 rounded-lg overflow-hidden cursor-pointer flex flex-col",
                              "border-l-4 border-2 transition-all duration-150",
                              "bg-card hover:shadow-md",
                              accentClass,
                              isSelected
                                ? "border-primary ring-2 ring-primary/30"
                                : isCurrent
                                ? "border-foreground/40"
                                : "border-border/60 hover:border-border",
                              isDragging && "opacity-40 scale-95"
                            )}
                            style={{ width, height: 160 }}
                          >
                            {/* Thumbnail area */}
                            <div className="relative flex-1 bg-muted overflow-hidden">
                              {item.media?.file_url ? (
                                item.media.type === "video" ? (
                                  <video
                                    src={item.media.file_url}
                                    className="w-full h-full object-cover"
                                    muted
                                  />
                                ) : (
                                  <img
                                    src={item.media.thumbnail_url || item.media.file_url}
                                    alt=""
                                    className="w-full h-full object-cover"
                                  />
                                )
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Icon className="w-8 h-8 text-muted-foreground/40" />
                                </div>
                              )}

                              {/* Hover actions overlay */}
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                                <Button
                                  size="icon"
                                  variant="secondary"
                                  className="h-7 w-7 rounded-full bg-white/90 hover:bg-white text-foreground"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSetPreviewIndex(index);
                                    if (!isPlaying) onTogglePlay();
                                  }}
                                  title="Reproduzir"
                                >
                                  <Play className="w-3.5 h-3.5 ml-0.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="secondary"
                                  className="h-7 w-7 rounded-full bg-white/90 hover:bg-white text-foreground"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEditItem(item);
                                  }}
                                  title="Editar"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="secondary"
                                  className="h-7 w-7 rounded-full bg-white/90 hover:bg-white text-foreground"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectItem(item.id);
                                    onSetPreviewIndex(index);
                                  }}
                                  title="Preview"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </Button>
                              </div>

                              {/* Drag handle */}
                              <div className="absolute top-1 left-1 p-1 rounded bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
                                <GripVertical className="w-3 h-3 text-white/80" />
                              </div>

                              {/* More menu */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="absolute top-1 right-1 h-6 w-6 bg-black/40 hover:bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreVertical className="w-3 h-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                  <DropdownMenuItem onClick={() => onEditItem(item)}>
                                    <Edit className="w-3.5 h-3.5 mr-2" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => onSelectChannel(channel)}>
                                    <Folder className="w-3.5 h-3.5 mr-2" />
                                    Abrir campanha
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => onRemoveItem(item.id)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                                    Remover
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>

                              {/* Duration badge */}
                              <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm">
                                <span className="text-[10px] font-mono text-white">
                                  {duration}s
                                </span>
                              </div>

                              {/* Playing pulse */}
                              {isCurrent && isPlaying && (
                                <div className="absolute top-1 left-8 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/90">
                                  <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                  <span className="text-[9px] text-white font-medium">LIVE</span>
                                </div>
                              )}
                            </div>

                            {/* Footer / Info */}
                            <div className="px-2 py-1.5 border-t bg-card shrink-0">
                              <div className="flex items-center gap-1 mb-1">
                                <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
                                <span className="text-[11px] font-medium truncate">
                                  {item.media?.name || "Sem nome"}
                                </span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectChannel(channel);
                                }}
                                className={cn(
                                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-medium uppercase tracking-wide hover:opacity-80 transition-opacity",
                                  badgeClass
                                )}
                                title={`Ver campanha: ${channel.name}`}
                              >
                                <Folder className="w-2.5 h-2.5" />
                                <span className="truncate max-w-[100px]">{channel.name}</span>
                              </button>
                            </div>
                          </div>

                          {/* Drop indicator right */}
                          {isDropTarget && draggedIndex! < index && (
                            <div className="absolute -right-1.5 top-0 bottom-0 w-1 bg-primary rounded-full z-20 animate-pulse" />
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <div className="space-y-1 text-xs">
                          <p className="font-semibold">{item.media?.name}</p>
                          <p className="text-muted-foreground">
                            Campanha: <span className="font-medium">{channel.name}</span>
                          </p>
                          <p className="text-muted-foreground">
                            Duração: <span className="font-mono">{formatDuration(duration)}</span>
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </div>
    </div>
  );
};
