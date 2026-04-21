import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { PlaylistChannel, PlaylistChannelWithItems, PlaylistChannelItem } from "@/hooks/usePlaylistChannels";
import { cn } from "@/lib/utils";
import { Video, Image, Clock, Film, Play, Pause, SkipBack, SkipForward, ZoomIn, ZoomOut, Maximize2, Settings, ChevronRight, ChevronDown, GripHorizontal } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
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
  const [collapsedChannels, setCollapsedChannels] = useState<Set<string>>(new Set());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const initialItems = useMemo(() => {
    const items: MediaItemWithMeta[] = [];
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
    items.sort((a, b) => a.globalIndex - b.globalIndex);
    return items.map((item, idx) => ({ ...item, globalIndex: idx }));
  }, [channelsWithItems]);

  useEffect(() => {
    setOrderedItems(initialItems);
  }, [initialItems]);

  const totalDuration = useMemo(() => {
    return orderedItems.reduce((sum, item) => sum + item.duration, 0);
  }, [orderedItems]);

  const groupedBlocks = useMemo(() => {
    if (orderedItems.length === 0) return [];
    const result: { channel: PlaylistChannelWithItems, items: MediaItemWithMeta[], color: typeof channelColors[0] }[] = [];
    let currentBlock: { channel: PlaylistChannelWithItems, items: MediaItemWithMeta[], color: typeof channelColors[0] } | null = null;
    
    orderedItems.forEach(item => {
      if (!currentBlock || currentBlock.channel.id !== item.channel.id) {
        currentBlock = { channel: item.channel, items: [], color: item.color };
        result.push(currentBlock);
      }
      currentBlock.items.push(item);
    });
    return result;
  }, [orderedItems]);

  const toggleCollapse = (channelId: string) => {
    setCollapsedChannels(prev => {
      const next = new Set(prev);
      if (next.has(channelId)) next.delete(channelId);
      else next.add(channelId);
      return next;
    });
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDropTargetIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (dragIndex !== dropIndex && !isNaN(dragIndex)) {
      const newItems = [...orderedItems];
      const [draggedItem] = newItems.splice(dragIndex, 1);
      newItems.splice(dropIndex, 0, draggedItem);
      const updated = newItems.map((item, idx) => ({ ...item, globalIndex: idx }));
      setOrderedItems(updated);
      if (onReorderGlobal) {
        onReorderGlobal(updated.map((item, idx) => ({
          itemId: item.item.id,
          channelId: item.item.channel_id,
          position: idx,
        })));
      }
    }
    setDraggedIndex(null);
    setDropTargetIndex(null);
  };

  const handleChannelDrop = (e: React.DragEvent, targetChannelIndex: number) => {
    e.preventDefault();
    // For now, moving individual items is supported. 
    // Moving blocks is more complex, but we can implement it by identifying the source channel.
  };

  const getItemWidth = (duration: number) => {
    const base = 60;
    const scaled = (duration / 8) * (zoom * 0.8);
    return Math.max(base, scaled);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-background">
      {/* Controls */}
      <div className="shrink-0 border-b bg-card px-4 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.max(50, z - 25))}>
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <Slider value={[zoom]} onValueChange={([v]) => setZoom(v)} min={50} max={200} step={25} className="w-20" />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.min(200, z + 25))}>
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <span className="text-[10px] text-muted-foreground">{zoom}%</span>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setCurrentIndex(prev => Math.max(0, prev - 1)); setCurrentTime(0); }}>
            <SkipBack className="w-3.5 h-3.5" />
          </Button>
          <Button variant="default" size="icon" className="h-9 w-9 rounded-full" onClick={() => setIsPlaying(!isPlaying)}>
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setCurrentIndex(prev => Math.min(orderedItems.length - 1, prev + 1)); setCurrentTime(0); }}>
            <SkipForward className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="h-7 text-xs font-mono">
            Total: {formatTime(totalDuration)}
          </Badge>
          <span className="text-xs text-muted-foreground">{orderedItems.length} mídias</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        <ScrollArea className="flex-1">
          <div className="p-6 flex flex-col gap-6 min-w-max">
            {groupedBlocks.map((block, bIdx) => {
              const isCollapsed = collapsedChannels.has(block.channel.id);
              const blockDuration = block.items.reduce((sum, i) => sum + i.duration, 0);
              
              return (
                <div key={block.channel.id} className="flex flex-col gap-2">
                  {/* Block Header */}
                  <div className="flex items-center gap-2 group/header">
                    <button 
                      onClick={() => toggleCollapse(block.channel.id)}
                      className="p-1 hover:bg-muted rounded transition-colors"
                    >
                      {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <div className={cn("w-3 h-3 rounded-full", block.color.bg)} />
                    <span 
                      className="font-semibold text-sm cursor-pointer hover:text-primary transition-colors truncate max-w-[300px]"
                      onClick={() => onSelectChannel(block.channel)}
                    >
                      {block.channel.name}
                    </span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 h-4">
                      {formatTime(blockDuration)}
                    </Badge>
                    <GripHorizontal className="w-4 h-4 text-muted-foreground/30 opacity-0 group-hover/header:opacity-100 transition-opacity cursor-grab" />
                  </div>

                  {/* Block Items */}
                  {!isCollapsed && (
                    <div className="flex gap-1.5 pl-6">
                      {block.items.map((mediaItem) => {
                        const { item, duration, color } = mediaItem;
                        const idxInOrdered = orderedItems.findIndex(i => i.item.id === item.id);
                        const isActive = currentIndex === idxInOrdered;
                        const isDragging = draggedIndex === idxInOrdered;
                        const isDropTarget = dropTargetIndex === idxInOrdered && draggedIndex !== null && draggedIndex !== idxInOrdered;
                        const width = getItemWidth(duration);

                        return (
                          <div
                            key={item.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, idxInOrdered)}
                            onDragOver={(e) => handleDragOver(e, idxInOrdered)}
                            onDrop={(e) => handleDrop(e, idxInOrdered)}
                            onClick={() => { setCurrentIndex(idxInOrdered); setCurrentTime(0); }}
                            className={cn(
                              "relative shrink-0 rounded-lg overflow-hidden cursor-grab active:cursor-grabbing transition-all",
                              "border-2",
                              isActive ? "border-primary ring-2 ring-primary/20" : "border-border",
                              isDragging && "opacity-40 scale-95",
                              isDropTarget && "border-primary border-dashed",
                              !isDragging && "hover:border-primary/50"
                            )}
                            style={{ width, height: 70 }}
                          >
                            <div className="absolute inset-0 bg-muted">
                              {item.media?.thumbnail_url || item.media?.file_url ? (
                                <img 
                                  src={item.media.thumbnail_url || item.media.file_url || ''} 
                                  alt="" 
                                  className="w-full h-full object-cover" 
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  {item.media?.type === 'video' ? <Video className="w-5 h-5 text-muted-foreground" /> : <Image className="w-5 h-5 text-muted-foreground" />}
                                </div>
                              )}
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                            <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between text-white">
                              <span className="text-[10px] font-medium truncate flex-1 pr-2">
                                {item.media?.name}
                              </span>
                              <span className="text-[9px] font-mono opacity-80 shrink-0">
                                {duration}s
                              </span>
                            </div>
                            {isActive && (
                              <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.8)] animate-pulse" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Bottom Preview */}
      <div className="h-48 border-t bg-muted/30 relative flex items-center justify-center overflow-hidden">
        {orderedItems[currentIndex] && (
          <div className="relative h-full flex items-center justify-center p-4">
            <div className="relative h-full aspect-video rounded-md overflow-hidden shadow-lg bg-black">
              {orderedItems[currentIndex].item.media?.type === 'video' ? (
                <video
                  key={orderedItems[currentIndex].item.id}
                  src={orderedItems[currentIndex].item.media.file_url || ''}
                  className="h-full w-full object-contain"
                  muted
                  autoPlay={isPlaying}
                />
              ) : (
                <img
                  key={orderedItems[currentIndex].item.id}
                  src={orderedItems[currentIndex].item.media?.thumbnail_url || orderedItems[currentIndex].item.media?.file_url || ''}
                  className="h-full w-full object-contain"
                />
              )}
              <div className="absolute top-2 left-2 flex items-center gap-1.5">
                <div className={cn("w-2 h-2 rounded-full", orderedItems[currentIndex].color.bg)} />
                <span className="text-[10px] text-white/70 font-medium">
                  {orderedItems[currentIndex].channel.name}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
