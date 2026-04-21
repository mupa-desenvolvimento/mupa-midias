import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { PlaylistChannel, PlaylistChannelWithItems, PlaylistChannelItem } from "@/hooks/usePlaylistChannels";
import { cn } from "@/lib/utils";
import { Video, Image, Clock, Film, Play, Pause, SkipBack, SkipForward, ZoomIn, ZoomOut, Maximize2, Settings } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ChannelItemSettingsDialog } from "./ChannelItemSettingsDialog";

interface AllMediaTimelineProps {
  channelsWithItems: PlaylistChannelWithItems[];
  onSelectChannel: (channel: PlaylistChannel) => void;
  onReorderGlobal?: (items: { channelId: string; itemId: string; position: number }[]) => void;
  onUpdateItem?: (itemId: string, updates: {
    duration_override: number;
    is_schedule_override: boolean;
    start_date: string | null;
    end_date: string | null;
    start_time: string | null;
    end_time: string | null;
    days_of_week: number[] | null;
  }) => void;
}

// Color palette for channels
const channelColors = [
  { bg: "bg-blue-500", border: "border-blue-500/50", ring: "ring-blue-500/30" },
  { bg: "bg-emerald-500", border: "border-emerald-500/50", ring: "ring-emerald-500/30" },
  { bg: "bg-violet-500", border: "border-violet-500/50", ring: "ring-violet-500/30" },
  { bg: "bg-amber-500", border: "border-amber-500/50", ring: "ring-amber-500/30" },
  { bg: "bg-rose-500", border: "border-rose-500/50", ring: "ring-rose-500/30" },
  { bg: "bg-cyan-500", border: "border-cyan-500/50", ring: "ring-cyan-500/30" },
];

interface MediaItemWithMeta {
  item: PlaylistChannelItem;
  channel: PlaylistChannelWithItems;
  channelIndex: number;
  globalIndex: number;
  duration: number;
  color: typeof channelColors[0];
}

export const AllMediaTimeline = ({
  channelsWithItems,
  onSelectChannel,
  onReorderGlobal,
  onUpdateItem,
}: AllMediaTimelineProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [orderedItems, setOrderedItems] = useState<MediaItemWithMeta[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Build initial ordered items from channels, sorted by global_position
  const initialItems = useMemo(() => {
    const items: MediaItemWithMeta[] = [];
    
    // First collect all items with channel info
    channelsWithItems.forEach((channel, channelIndex) => {
      if (channel.items && channel.items.length > 0) {
        channel.items.forEach(item => {
          items.push({
            item,
            channel,
            channelIndex,
            globalIndex: item.global_position ?? 0,
            duration: item.duration_override || item.media?.duration || 8,
            color: channelColors[channelIndex % channelColors.length],
          });
        });
      }
    });
    
    // Sort by global_position
    items.sort((a, b) => a.globalIndex - b.globalIndex);
    
    // Re-assign globalIndex after sorting
    return items.map((item, idx) => ({ ...item, globalIndex: idx }));
  }, [channelsWithItems]);

  // Sync ordered items when channels change
  useEffect(() => {
    setOrderedItems(initialItems);
  }, [initialItems]);

  // Calculate total duration
  const totalDuration = useMemo(() => {
    return orderedItems.reduce((sum, item) => sum + item.duration, 0);
  }, [orderedItems]);

  // Current item
  const currentMedia = orderedItems[currentIndex];

  // Playback timer
  useEffect(() => {
    if (!isPlaying || orderedItems.length === 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const current = orderedItems[currentIndex];
    if (!current) return;

    timerRef.current = setInterval(() => {
      setCurrentTime((prev) => {
        if (prev >= current.duration) {
          if (currentIndex < orderedItems.length - 1) {
            setCurrentIndex(currentIndex + 1);
          } else {
            setCurrentIndex(0);
          }
          return 0;
        }
        return prev + 0.1;
      });
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, currentIndex, orderedItems]);

  const handleItemClick = (index: number) => {
    setCurrentIndex(index);
    setCurrentTime(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetIndex(index);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTargetIndex(null);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDropTargetIndex(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    
    if (dragIndex !== dropIndex && !isNaN(dragIndex)) {
      let newItems: MediaItemWithMeta[] = [];
      
      setOrderedItems(prev => {
        newItems = [...prev];
        const [draggedItem] = newItems.splice(dragIndex, 1);
        newItems.splice(dropIndex, 0, draggedItem);
        
        // Update global indices
        return newItems.map((item, idx) => ({ ...item, globalIndex: idx }));
      });

      // Update current index if needed
      if (currentIndex === dragIndex) {
        setCurrentIndex(dropIndex);
      } else if (dragIndex < currentIndex && dropIndex >= currentIndex) {
        setCurrentIndex(prev => prev - 1);
      } else if (dragIndex > currentIndex && dropIndex <= currentIndex) {
        setCurrentIndex(prev => prev + 1);
      }

      // Persist to database
      if (onReorderGlobal && newItems.length > 0) {
        // Build update array with new positions per channel
        const updates = newItems.map((item, idx) => ({
          itemId: item.item.id,
          channelId: item.item.channel_id,
          position: idx,
        }));
        onReorderGlobal(updates);
      }
    }
    
    handleDragEnd();
  }, [currentIndex, handleDragEnd, onReorderGlobal]);

  // Width based on duration
  const getItemWidth = (duration: number) => {
    const base = 60;
    const scaled = (duration / 8) * (zoom * 0.8);
    return Math.max(base, scaled);
  };

  if (orderedItems.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
        <Film className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm font-medium">Nenhuma mídia na playlist</p>
        <p className="text-xs mt-1">Adicione mídias às campanhas para visualizá-las aqui</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-background">
      {/* Preview Area */}
      <div className="flex-1 flex items-center justify-center bg-muted/20 relative overflow-hidden">
        {currentMedia && (
          <div className="relative w-full h-full flex items-center justify-center p-4">
            <div className="relative max-w-full max-h-full rounded-lg overflow-hidden shadow-2xl bg-black">
              {currentMedia.item.media?.type === 'video' ? (
                <video
                  key={currentMedia.item.id}
                  src={currentMedia.item.media.file_url || ''}
                  className="max-w-full max-h-[50vh] object-contain"
                  muted
                  autoPlay={isPlaying}
                />
              ) : (
                <img
                  key={currentMedia.item.id}
                  src={currentMedia.item.media?.thumbnail_url || currentMedia.item.media?.file_url || ''}
                  alt={currentMedia.item.media?.name || 'Preview'}
                  className="max-w-full max-h-[50vh] object-contain"
                />
              )}
              
              <button className="absolute top-3 right-3 p-2 bg-black/50 rounded-lg hover:bg-black/70 transition-colors">
                <Maximize2 className="w-4 h-4 text-white" />
              </button>
              
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2.5 h-2.5 rounded-full", currentMedia.color.bg)} />
                  <span className="text-white/70 text-xs">{currentMedia.channel.name}</span>
                  <span className="text-white/50">•</span>
                  <span className="text-white text-sm font-medium truncate">
                    {currentMedia.item.media?.name}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="shrink-0 border-t border-b bg-card px-4 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.max(50, z - 25))}>
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <Slider
            value={[zoom]}
            onValueChange={([v]) => setZoom(v)}
            min={50}
            max={200}
            step={25}
            className="w-20"
          />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.min(200, z + 25))}>
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <span className="text-[10px] text-muted-foreground">{zoom}%</span>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setCurrentIndex(prev => Math.max(0, prev - 1)); setCurrentTime(0); }}>
            <SkipBack className="w-3.5 h-3.5" />
          </Button>
          <Button 
            variant="default" 
            size="icon" 
            className="h-9 w-9 rounded-full"
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setCurrentIndex(prev => Math.min(orderedItems.length - 1, prev + 1)); setCurrentTime(0); }}>
            <SkipForward className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="flex items-center gap-3">
          {/* Settings button for current item */}
          {currentMedia && onUpdateItem && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => setSettingsDialogOpen(true)}
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Configurar
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Configurar duração e agendamento da mídia selecionada
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{formatTime(totalDuration)}</span>
            <span>•</span>
            <span>{currentIndex + 1}/{orderedItems.length}</span>
          </div>
        </div>
      </div>

      {/* Settings Dialog */}
      {currentMedia && (
        <ChannelItemSettingsDialog
          item={currentMedia.item}
          open={settingsDialogOpen}
          onOpenChange={setSettingsDialogOpen}
          onSave={(id, updates) => {
            if (onUpdateItem) {
              onUpdateItem(id, updates);
            }
          }}
        />
      )}

      {/* Channel legend */}
      <div className="shrink-0 bg-muted/20 px-4 py-1.5 flex items-center gap-3">
        {channelsWithItems.map((channel, idx) => {
          const color = channelColors[idx % channelColors.length];
          const count = channel.items?.length || 0;
          if (count === 0) return null;
          return (
            <button
              key={channel.id}
              onClick={() => onSelectChannel(channel)}
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
            >
              <div className={cn("w-2 h-2 rounded-full", color.bg)} />
              <span className="text-[10px] text-muted-foreground">{channel.name} ({count})</span>
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      <div className="shrink-0 bg-muted/10">
        <ScrollArea className="w-full">
          <div className="flex p-2 gap-1 min-w-max">
            {orderedItems.map((mediaItem, index) => {
              const { item, channel, duration, color } = mediaItem;
              const isActive = currentIndex === index;
              const isDragging = draggedIndex === index;
              const isDropTarget = dropTargetIndex === index && draggedIndex !== null && draggedIndex !== index;
              const width = getItemWidth(duration);
              
              return (
                <TooltipProvider key={item.id} delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragLeave={handleDragLeave}
                        onDragEnd={handleDragEnd}
                        onDrop={(e) => handleDrop(e, index)}
                        onClick={() => handleItemClick(index)}
                        className={cn(
                          "relative shrink-0 rounded overflow-hidden cursor-grab active:cursor-grabbing transition-all",
                          "border",
                          isActive ? "ring-2 ring-primary border-primary" : color.border,
                          isDragging && "opacity-40 scale-95",
                          isDropTarget && "ring-2 ring-primary/50",
                          !isDragging && "hover:brightness-110"
                        )}
                        style={{ width, height: 56 }}
                      >
                        {/* Channel color bar */}
                        <div className={cn("absolute top-0 left-0 right-0 h-1 z-10", color.bg)} />
                        
                        {/* Thumbnail */}
                        <div className="absolute inset-0 bg-muted">
                          {item.media?.thumbnail_url || item.media?.file_url ? (
                            item.media.type === 'video' ? (
                              <video src={item.media.file_url || ''} className="w-full h-full object-cover" muted />
                            ) : (
                              <img src={item.media.thumbnail_url || item.media.file_url || ''} alt="" className="w-full h-full object-cover" />
                            )
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              {item.media?.type === 'video' ? <Video className="w-4 h-4 text-muted-foreground" /> : <Image className="w-4 h-4 text-muted-foreground" />}
                            </div>
                          )}
                        </div>

                        {/* Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                        {/* Type icon */}
                        <div className="absolute bottom-1 right-1">
                          {item.media?.type === 'video' ? (
                            <Video className="w-3 h-3 text-white/80" />
                          ) : (
                            <Image className="w-3 h-3 text-white/80" />
                          )}
                        </div>

                        {/* Duration */}
                        <div className="absolute bottom-1 left-1 text-[9px] text-white/80 font-medium">
                          {duration}s
                        </div>

                        {/* Playing indicator */}
                        {isActive && isPlaying && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <Play className="w-4 h-4 text-white fill-white" />
                          </div>
                        )}

                        {/* Progress */}
                        {isActive && (
                          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/50">
                            <div className="h-full bg-primary transition-all" style={{ width: `${(currentTime / duration) * 100}%` }} />
                          </div>
                        )}

                        {/* Drop indicator */}
                        {isDropTarget && draggedIndex !== null && (
                          <div className={cn(
                            "absolute top-0 bottom-0 w-1 bg-primary z-20",
                            draggedIndex > index ? "-left-0.5" : "-right-0.5"
                          )} />
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[200px]">
                      <div className="text-xs space-y-1">
                        <p className="font-medium truncate">{item.media?.name}</p>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <div className={cn("w-1.5 h-1.5 rounded-full", color.bg)} />
                          <span>{channel.name}</span>
                          <span>•</span>
                          <span>{duration}s</span>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </div>
  );
};
