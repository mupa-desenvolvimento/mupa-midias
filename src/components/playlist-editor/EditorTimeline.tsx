import { useState, useCallback, useRef } from "react";
import { PlaylistItem } from "@/hooks/usePlaylistItems";
import { MediaItem } from "@/hooks/useMediaItems";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ItemSettingsDialog } from "./ItemSettingsDialog";
import {
  Plus,
  Clock,
  Trash2,
  Copy,
  GripVertical,
  Image,
  Video,
  FileText,
  MoreVertical,
  ChevronUp,
  ChevronDown,
  Settings,
  Calendar,
  ArrowUpDown,
  Type,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface EditorTimelineProps {
  items: PlaylistItem[];
  selectedItemId: string | null;
  currentPreviewIndex: number;
  onSelectItem: (id: string | null) => void;
  onSetPreviewIndex: (index: number) => void;
  onAddMedia: (media: MediaItem, position: number) => void;
  onRemoveItem: (id: string) => void;
  onDuplicateItem: (item: PlaylistItem) => void;
  onUpdateDuration: (id: string, duration: number) => void;
  onUpdateItemSettings: (
    id: string,
    updates: {
      duration_override: number;
      is_schedule_override: boolean;
      start_date: string | null;
      end_date: string | null;
      start_time: string | null;
      end_time: string | null;
      days_of_week: number[] | null;
    },
  ) => void;
  onReorderItems: (items: { id: string; position: number }[]) => void;
  totalDuration: number;
  isPlaying: boolean;
}

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }
  return `${secs}s`;
};

const getMediaIcon = (type: string) => {
  switch (type) {
    case "video":
      return Video;
    case "image":
      return Image;
    default:
      return FileText;
  }
};

export const EditorTimeline = ({
  items,
  selectedItemId,
  currentPreviewIndex,
  onSelectItem,
  onSetPreviewIndex,
  onAddMedia,
  onRemoveItem,
  onDuplicateItem,
  onUpdateDuration,
  onUpdateItemSettings,
  onReorderItems,
  totalDuration,
  isPlaying,
}: EditorTimelineProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [settingsItem, setSettingsItem] = useState<PlaylistItem | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
      setDropTargetIndex(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      setDropTargetIndex(null);

      const mediaData = e.dataTransfer.getData("application/json");
      if (mediaData) {
        try {
          const media = JSON.parse(mediaData) as MediaItem;
          onAddMedia(media, items.length);
        } catch {
          // Not valid JSON
        }
      }
    },
    [items.length, onAddMedia],
  );

  const handleItemDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.setData("text/plain", index.toString());
    e.dataTransfer.effectAllowed = "move";
    setDraggedIndex(index);

    // Create custom drag image
    const dragElement = e.currentTarget as HTMLElement;
    const rect = dragElement.getBoundingClientRect();
    const ghost = dragElement.cloneNode(true) as HTMLElement;
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    ghost.style.opacity = "0.8";
    ghost.style.transform = "rotate(2deg) scale(1.02)";
    ghost.style.position = "absolute";
    ghost.style.top = "-9999px";
    ghost.style.left = "-9999px";
    ghost.style.pointerEvents = "none";
    ghost.style.boxShadow = "0 10px 40px rgba(0,0,0,0.4)";
    ghost.style.borderRadius = "8px";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, rect.width / 2, rect.height / 2);

    // Cleanup ghost after drag starts
    requestAnimationFrame(() => {
      document.body.removeChild(ghost);
    });
  }, []);

  const handleItemDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.stopPropagation();
      if (draggedIndex !== null && draggedIndex !== index) {
        setDropTargetIndex(index);
      }
    },
    [draggedIndex],
  );

  const handleItemDragLeave = useCallback((e: React.DragEvent) => {
    e.stopPropagation();
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!e.currentTarget.contains(relatedTarget)) {
      setDropTargetIndex(null);
    }
  }, []);

  const handleItemDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      e.stopPropagation();
      setDropTargetIndex(null);

      const dragIndexStr = e.dataTransfer.getData("text/plain");
      if (dragIndexStr && draggedIndex !== null) {
        const dragIndex = parseInt(dragIndexStr);
        if (dragIndex !== dropIndex) {
          const newItems = [...items];
          const [draggedItem] = newItems.splice(dragIndex, 1);
          newItems.splice(dropIndex, 0, draggedItem);

          const reordered = newItems.map((item, idx) => ({
            id: item.id,
            position: idx,
          }));
          onReorderItems(reordered);
        }
        setDraggedIndex(null);
        return;
      }

      const mediaData = e.dataTransfer.getData("application/json");
      if (mediaData) {
        try {
          const media = JSON.parse(mediaData) as MediaItem;
          onAddMedia(media, dropIndex);
        } catch {
          // Ignore
        }
      }
      setDraggedIndex(null);
    },
    [items, draggedIndex, onAddMedia, onReorderItems],
  );

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDropTargetIndex(null);
  }, []);

  const handleSort = (type: "name" | "duration" | "date") => {
    const sorted = [...items].sort((a, b) => {
      switch (type) {
        case "name":
          return (a.media?.name || "").localeCompare(b.media?.name || "");
        case "duration":
          const durA = a.duration_override || a.media?.duration || 0;
          const durB = b.duration_override || b.media?.duration || 0;
          return durA - durB;
        case "date":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        default:
          return 0;
      }
    });

    const reordered = sorted.map((item, index) => ({
      id: item.id,
      position: index,
    }));

    onReorderItems(reordered);
  };

  // Calculate cumulative time for each item
  const itemTimes = items.reduce<{ startTime: number; endTime: number }[]>((acc, item, index) => {
    const duration = item.duration_override || item.media?.duration || 10;
    const startTime = index === 0 ? 0 : acc[index - 1].endTime;
    acc.push({ startTime, endTime: startTime + duration });
    return acc;
  }, []);

  return (
    <div
      className={cn(
        "flex flex-col bg-muted/50 border-t border-border transition-all flex-shrink-0",
        isExpanded ? "h-40" : "h-10",
      )}
    >
      {/* Timeline Header */}
      <div className="h-8 flex items-center justify-between px-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            <span className="text-xs font-medium">Timeline</span>
          </button>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(totalDuration)}
            </span>
            <span className="opacity-50">•</span>
            <span>
              {items.length} {items.length === 1 ? "item" : "itens"}
            </span>
          </div>

          <div className="h-4 w-px bg-border mx-2" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1.5 px-2">
                <ArrowUpDown className="w-3 h-3" />
                Ordenar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => handleSort("name")}>
                <Type className="w-4 h-4 mr-2" />
                Nome
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSort("duration")}>
                <Clock className="w-4 h-4 mr-2" />
                Duração
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSort("date")}>
                <Calendar className="w-4 h-4 mr-2" />
                Data de inclusão
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Timeline Content */}
      {isExpanded && (
        <div
          className={cn(
            "flex-1 relative transition-colors duration-200",
            isDragOver ? "bg-primary/5" : "",
            draggedIndex !== null ? "bg-accent/30" : "",
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {items.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className={cn(
                  "flex flex-col items-center gap-2 px-8 py-4 rounded-xl border-2 border-dashed transition-all duration-200",
                  isDragOver ? "border-primary bg-primary/10 scale-105" : "border-border",
                )}
              >
                <Plus className="w-8 h-8 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Arraste mídias aqui</p>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="flex items-center gap-1 p-2 min-w-max h-full">
                {items.map((item, index) => {
                  const duration = item.duration_override || item.media?.duration || 8;
                  const isSelected = selectedItemId === item.id;
                  const isCurrent = currentPreviewIndex === index;
                  const isDragging = draggedIndex === index;
                  const isDropTarget = dropTargetIndex === index;
                  const hasScheduleOverride = item.is_schedule_override;
                  const Icon = getMediaIcon(item.media?.type || "image");

                  // Calculate width based on duration (min 100px, 10px per second)
                  const width = Math.max(100, duration * 10);

                  return (
                    <TooltipProvider key={item.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="relative flex items-center h-full">
                            {/* Drop Indicator - Left side */}
                            {isDropTarget && draggedIndex !== null && draggedIndex > index && (
                              <div className="absolute -left-1.5 top-0 bottom-0 w-1 bg-primary rounded-full z-20 animate-pulse" />
                            )}

                            <div
                              draggable
                              onDragStart={(e) => handleItemDragStart(e, index)}
                              onDragOver={(e) => handleItemDragOver(e, index)}
                              onDragLeave={handleItemDragLeave}
                              onDrop={(e) => handleItemDrop(e, index)}
                              onDragEnd={handleDragEnd}
                              onClick={() => {
                                onSelectItem(item.id);
                                onSetPreviewIndex(index);
                              }}
                              className={cn(
                                "group relative flex-shrink-0 rounded-lg overflow-hidden cursor-pointer h-full",
                                "border-2 transition-all duration-200",
                                isSelected
                                  ? "border-primary ring-2 ring-primary/30"
                                  : isCurrent
                                    ? "border-foreground/30"
                                    : "border-transparent hover:border-muted-foreground/50",
                                isDragging ? "opacity-40 scale-95 rotate-1" : "opacity-100",
                                isDropTarget ? "scale-[0.98] border-primary/50" : "",
                              )}
                              style={{ width: `${width}px`, height: 80 }}
                            >
                              {/* Thumbnail */}
                              <div className="absolute inset-0 bg-muted">
                                {item.media?.file_url &&
                                  (item.media.type === "video" ? (
                                    <video
                                      src={item.media.file_url}
                                      className={cn(
                                        "w-full h-full object-cover transition-opacity duration-200",
                                        isDragging ? "opacity-50" : "opacity-80",
                                      )}
                                      muted
                                    />
                                  ) : (
                                    <img
                                      src={item.media.file_url}
                                      alt=""
                                      className={cn(
                                        "w-full h-full object-cover transition-opacity duration-200",
                                        isDragging ? "opacity-50" : "opacity-80",
                                      )}
                                    />
                                  ))}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                              </div>

                              {/* Content */}
                              <div className="absolute inset-0 flex flex-col justify-between p-2">
                                {/* Top Row */}
                                <div className="flex items-start justify-between">
                                  <div
                                    className={cn(
                                      "flex items-center gap-1 transition-opacity duration-200",
                                      isDragging ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                                    )}
                                  >
                                    <div className="p-1 bg-black/50 rounded cursor-grab active:cursor-grabbing hover:bg-black/70 transition-colors">
                                      <GripVertical className="w-3 h-3 text-white/70" />
                                    </div>
                                  </div>

                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 opacity-0 group-hover:opacity-100 bg-black/50 hover:bg-black/70 text-white/70 hover:text-white transition-all"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <MoreVertical className="w-3 h-3" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSettingsItem(item);
                                        }}
                                      >
                                        <Settings className="w-4 h-4 mr-2" />
                                        Configurações
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onDuplicateItem(item);
                                        }}
                                      >
                                        <Copy className="w-4 h-4 mr-2" />
                                        Duplicar
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onRemoveItem(item.id);
                                        }}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Remover
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>

                                {/* Bottom Row */}
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <Icon className="w-3 h-3 text-white/70" />
                                    <span className="text-[10px] text-white/80 font-medium truncate max-w-[60px]">
                                      {item.media?.name || "Sem nome"}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-white/50 flex items-center gap-0.5">
                                    <Clock className="w-2.5 h-2.5" />
                                    {formatDuration(duration)}
                                  </span>
                                </div>
                              </div>

                              {/* Playing Indicator */}
                              {isCurrent && isPlaying && (
                                <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                              )}

                              {/* Schedule Override Indicator */}
                              {hasScheduleOverride && !isDragging && (
                                <div className="absolute top-2 right-8 opacity-80">
                                  <Calendar className="w-3 h-3 text-blue-400" />
                                </div>
                              )}

                              {/* Drag overlay */}
                              {isDragging && <div className="absolute inset-0 bg-primary/20 rounded-lg" />}
                            </div>

                            {/* Drop Indicator - Right side */}
                            {isDropTarget && draggedIndex !== null && draggedIndex < index && (
                              <div className="absolute -right-1.5 top-0 bottom-0 w-1 bg-primary rounded-full z-20 animate-pulse" />
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <div className="flex flex-col gap-1 text-xs">
                            <p className="font-semibold">{item.media?.name}</p>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDuration(duration)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(item.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}

                {/* Add Button at End */}
                <div
                  className={cn(
                    "flex-shrink-0 w-16 rounded-lg border-2 border-dashed flex items-center justify-center transition-all duration-200",
                    isDragOver || dropTargetIndex === items.length
                      ? "border-primary bg-primary/10 scale-105"
                      : "border-border hover:border-muted-foreground hover:bg-accent/50",
                  )}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropTargetIndex(items.length);
                  }}
                  onDragLeave={() => setDropTargetIndex(null)}
                  onDrop={(e) => handleItemDrop(e, items.length)}
                >
                  <Plus className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}
        </div>
      )}

      {/* Settings Dialog */}
      <ItemSettingsDialog
        item={settingsItem}
        open={!!settingsItem}
        onOpenChange={(open) => !open && setSettingsItem(null)}
        onSave={onUpdateItemSettings}
      />
    </div>
  );
};
