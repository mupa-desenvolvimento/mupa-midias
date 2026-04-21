import { useState, useRef, useEffect, useCallback } from "react";
import { PlaylistChannel, PlaylistChannelWithItems, PlaylistChannelItem } from "@/hooks/usePlaylistChannels";
import { cn } from "@/lib/utils";
import { Clock, Shield, Play, Radio, Film, AlertCircle, ChevronDown, ChevronRight, Image, Video, Layers, LayoutList } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ResizableChannelBlock } from "./ResizableChannelBlock";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AllMediaTimeline } from "./AllMediaTimeline";

interface ChannelsTimelineProps {
  channels: PlaylistChannel[];
  channelsWithItems?: PlaylistChannelWithItems[];
  onSelectChannel: (channel: PlaylistChannel) => void;
  onUpdateChannel?: (channelId: string, updates: { start_time?: string; end_time?: string }) => void;
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
  activeChannelId: string | null;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const ChannelsTimeline = ({
  channels,
  channelsWithItems,
  onSelectChannel,
  onUpdateChannel,
  onReorderGlobal,
  onUpdateItem,
  activeChannelId,
}: ChannelsTimelineProps) => {
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"channels" | "all-media">("all-media");

  // Measure container width for resize calculations
  useEffect(() => {
    const updateWidth = () => {
      if (timelineContainerRef.current) {
        setContainerWidth(timelineContainerRef.current.offsetWidth);
      }
    };
    
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const handleChannelResize = useCallback((channelId: string, startTime: string, endTime: string) => {
    if (onUpdateChannel) {
      onUpdateChannel(channelId, { start_time: startTime, end_time: endTime });
    }
  }, [onUpdateChannel]);

  const toggleChannelExpanded = (channelId: string) => {
    setExpandedChannels(prev => {
      const next = new Set(prev);
      if (next.has(channelId)) {
        next.delete(channelId);
      } else {
        next.add(channelId);
      }
      return next;
    });
  };

  // Convert time string to minutes from midnight
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
    return hours * 60 + minutes;
  };

  // Convert minutes to percentage of 24h
  const minutesToPercent = (minutes: number): number => {
    return (minutes / 1440) * 100;
  };

  // Check if channel is currently active
  const isChannelActive = (channel: PlaylistChannel) => {
    if (!channel.is_active) return false;

    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.toTimeString().slice(0, 5);

    if (!channel.days_of_week.includes(currentDay)) return false;

    const startTime = channel.start_time.slice(0, 5);
    const endTime = channel.end_time.slice(0, 5);

    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    }

    return currentTime >= startTime && currentTime <= endTime;
  };

  // Get current time position
  const getCurrentTimePosition = (): number => {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    return minutesToPercent(minutes);
  };

  // Calculate channel block position and width
  const getChannelStyle = (channel: PlaylistChannel) => {
    const startMinutes = timeToMinutes(channel.start_time);
    const endMinutes = timeToMinutes(channel.end_time);
    
    // Handle overnight schedules
    if (startMinutes > endMinutes) {
      return {
        isOvernight: true,
        firstBlock: {
          left: minutesToPercent(startMinutes),
          width: minutesToPercent(1440 - startMinutes),
        },
        secondBlock: {
          left: 0,
          width: minutesToPercent(endMinutes),
        },
      };
    }

    return {
      isOvernight: false,
      left: minutesToPercent(startMinutes),
      width: minutesToPercent(endMinutes - startMinutes),
    };
  };

  // Functional color palette based on status
  const getChannelColors = (channel: PlaylistChannel) => {
    if (!channel.is_active) {
      return { 
        bg: "bg-muted/60", 
        border: "border-muted-foreground/30", 
        text: "text-muted-foreground",
        label: "bg-muted"
      };
    }
    if (channel.is_fallback) {
      return { 
        bg: "bg-yellow-500/80", 
        border: "border-yellow-400", 
        text: "text-white",
        label: "bg-yellow-500"
      };
    }
    if (isChannelActive(channel)) {
      return { 
        bg: "bg-green-500/90", 
        border: "border-green-400", 
        text: "text-white",
        label: "bg-green-500"
      };
    }
    // Scheduled (default)
    return { 
      bg: "bg-blue-500/80", 
      border: "border-blue-400", 
      text: "text-white",
      label: "bg-blue-500"
    };
  };

  const getStatusIcon = (channel: PlaylistChannel) => {
    if (!channel.is_active) return <AlertCircle className="w-3.5 h-3.5" />;
    if (channel.is_fallback) return <Shield className="w-3.5 h-3.5" />;
    if (isChannelActive(channel)) return <Play className="w-3.5 h-3.5" />;
    return <Clock className="w-3.5 h-3.5" />;
  };

  const hasNoMedia = (channel: PlaylistChannel) => !channel.item_count || channel.item_count === 0;

  const currentTimePosition = getCurrentTimePosition();
  const ROW_HEIGHT = 56;
  const MEDIA_ROW_HEIGHT = 40;

  // Use channelsWithItems if available, otherwise fall back to channels
  const displayChannels: (PlaylistChannel | PlaylistChannelWithItems)[] = channelsWithItems || channels;

  // Type guard to check if channel has items
  const channelHasItems = (channel: PlaylistChannel | PlaylistChannelWithItems): channel is PlaylistChannelWithItems => {
    return 'items' in channel && Array.isArray(channel.items) && channel.items.length > 0;
  };

  // Get items from a channel if it has them
  const getChannelItems = (channel: PlaylistChannel | PlaylistChannelWithItems): PlaylistChannelItem[] => {
    if (channelHasItems(channel)) {
      return channel.items;
    }
    return [];
  };

  return (
    <div className="bg-card border rounded-lg overflow-hidden flex flex-col h-full">
      {/* Header with View Mode Toggle */}
      <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "channels" | "all-media")}>
            <TabsList className="h-8">
              <TabsTrigger value="all-media" className="text-xs gap-1.5 h-7 px-3">
                <Layers className="w-3.5 h-3.5" />
                Todas Mídias
              </TabsTrigger>
              <TabsTrigger value="channels" className="text-xs gap-1.5 h-7 px-3">
                <LayoutList className="w-3.5 h-3.5" />
                Por Campanha
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {viewMode === "channels" && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-green-500" />
              <span>Ao Vivo</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-blue-500" />
              <span>Programado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-yellow-500" />
              <span>Fallback</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-muted border" />
              <span>Inativo</span>
            </div>
          </div>
        )}
      </div>

      {/* All Media Timeline View */}
      {viewMode === "all-media" && (
        <AllMediaTimeline
          channelsWithItems={channelsWithItems || []}
          onSelectChannel={onSelectChannel}
          onReorderGlobal={onReorderGlobal}
          onUpdateItem={onUpdateItem}
        />
      )}

      {/* Channels Timeline View */}
      {viewMode === "channels" && (
        <div className="flex flex-1 min-h-0">
          {/* Channel Labels (Fixed Left Column) */}
          <div className="w-48 shrink-0 border-r bg-muted/20 flex flex-col">
            {/* Hour header spacer */}
            <div className="h-10 border-b flex items-center justify-center text-xs text-muted-foreground font-medium shrink-0">
              Campanhas
            </div>
            
            {/* Channel labels - scrollable */}
            <ScrollArea className="flex-1">
              {displayChannels.map((channel) => {
                const colors = getChannelColors(channel);
                const isLive = isChannelActive(channel);
                const noMedia = hasNoMedia(channel);
                const isExpanded = expandedChannels.has(channel.id);
                const hasItems = channelHasItems(channel);
                const items = getChannelItems(channel);
                
                return (
                  <div key={channel.id}>
                    {/* Channel row */}
                    <div
                      className={cn(
                        "border-b flex items-center gap-2 px-3 cursor-pointer hover:bg-muted/50 transition-colors",
                        activeChannelId === channel.id && "bg-muted",
                        isLive && "bg-green-500/5"
                      )}
                      style={{ height: ROW_HEIGHT }}
                    >
                      {/* Expand/collapse button */}
                      {hasItems ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleChannelExpanded(channel.id);
                          }}
                          className="p-0.5 hover:bg-muted rounded shrink-0"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                        </button>
                      ) : (
                        <div className="w-4" />
                      )}
                      
                      <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", colors.label)} />
                      <div className="flex-1 min-w-0" onClick={() => onSelectChannel(channel)}>
                        <p className="text-xs font-medium truncate">{channel.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {channel.start_time.slice(0, 5)}–{channel.end_time.slice(0, 5)}
                          </span>
                          <span className={cn(
                            "text-[10px] flex items-center gap-0.5 font-medium",
                            noMedia ? "text-red-500" : "text-muted-foreground"
                          )}>
                            <Film className="w-2.5 h-2.5" />
                            {channel.item_count || 0}
                          </span>
                        </div>
                      </div>
                      {getStatusIcon(channel)}
                    </div>

                    {/* Expanded media items */}
                    {isExpanded && hasItems && (
                      <div className="bg-muted/10">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="border-b border-border/50 flex items-center gap-2 px-3 pl-10 text-xs text-muted-foreground"
                            style={{ height: MEDIA_ROW_HEIGHT }}
                          >
                            {/* Thumbnail */}
                            <div className="w-8 h-6 rounded bg-muted overflow-hidden shrink-0">
                              {item.media?.thumbnail_url ? (
                                <img 
                                  src={item.media.thumbnail_url} 
                                  alt={item.media.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : item.media?.type === 'video' ? (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Video className="w-3 h-3" />
                                </div>
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Image className="w-3 h-3" />
                                </div>
                              )}
                            </div>
                            <span className="truncate flex-1">{item.media?.name || 'Mídia'}</span>
                            <span className="text-[10px] font-mono shrink-0">
                              {item.duration_override || item.media?.duration || 8}s
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              
              {/* Empty state spacer */}
              {channels.length === 0 && (
                <div className="h-24 flex items-center justify-center text-xs text-muted-foreground">
                  Sem campanhas
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Scrollable Timeline Area */}
          <ScrollArea className="flex-1">
            <div className="min-w-[1200px]" ref={timelineContainerRef}>
              {/* Hour markers */}
              <div className="flex border-b h-10 sticky top-0 bg-card z-10">
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="flex-1 border-r border-border/50 text-xs text-muted-foreground flex items-center justify-center font-medium"
                  >
                    {String(hour).padStart(2, "0")}:00
                  </div>
                ))}
              </div>

              {/* Channels rows */}
              <div className="relative">
                {displayChannels.map((channel, index) => {
                  const style = getChannelStyle(channel);
                  const colors = getChannelColors(channel);
                  const isSelected = activeChannelId === channel.id;
                  const isLive = isChannelActive(channel);
                  const noMedia = hasNoMedia(channel);
                  const isExpanded = expandedChannels.has(channel.id);
                  const hasItems = channelHasItems(channel);
                  const items = getChannelItems(channel);

                  return (
                    <div key={channel.id}>
                      {/* Channel block row */}
                      <div
                        className={cn(
                          "relative border-b transition-colors",
                          index % 2 === 0 ? "bg-muted/5" : "bg-transparent",
                          isLive && "bg-green-500/5"
                        )}
                        style={{ height: ROW_HEIGHT }}
                      >
                        {/* Hour grid lines */}
                        <div className="absolute inset-0 flex pointer-events-none">
                          {HOURS.map((hour) => (
                            <div
                              key={hour}
                              className="flex-1 border-r border-border/20"
                            />
                          ))}
                        </div>

                        {/* Current time indicator */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
                          style={{ left: `${currentTimePosition}%` }}
                        />

                        {/* Channel block(s) - Resizable */}
                        {style.isOvernight ? (
                          // For overnight schedules, show both blocks but not resizable
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn(
                                    "absolute top-1/2 -translate-y-1/2 h-10 rounded-md border-2 cursor-pointer transition-all flex items-center px-2 gap-1.5 overflow-hidden",
                                    colors.bg,
                                    colors.border,
                                    colors.text,
                                    isSelected && "ring-2 ring-white ring-offset-2 ring-offset-background shadow-lg",
                                    isLive && "shadow-[0_0_16px_rgba(34,197,94,0.3)]",
                                    noMedia && "border-dashed"
                                  )}
                                  style={{
                                    left: `${style.firstBlock.left}%`,
                                    width: `${style.firstBlock.width}%`,
                                  }}
                                  onClick={() => onSelectChannel(channel)}
                                >
                                  {getStatusIcon(channel)}
                                  <span className="text-xs font-semibold truncate drop-shadow-sm">
                                    {channel.name}
                                  </span>
                                  <span className="text-[10px] opacity-80 ml-auto shrink-0 flex items-center gap-0.5">
                                    <Film className="w-3 h-3" />
                                    {channel.item_count || 0}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <div className="space-y-1">
                                  <p className="font-semibold">{channel.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {channel.start_time.slice(0, 5)} – {channel.end_time.slice(0, 5)}
                                  </p>
                                </div>
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn(
                                    "absolute top-1/2 -translate-y-1/2 h-10 rounded-md border-2 cursor-pointer transition-all flex items-center px-2 gap-1 overflow-hidden",
                                    colors.bg,
                                    colors.border,
                                    colors.text,
                                    isSelected && "ring-2 ring-white ring-offset-2 ring-offset-background",
                                    noMedia && "border-dashed"
                                  )}
                                  style={{
                                    left: `${style.secondBlock.left}%`,
                                    width: `${style.secondBlock.width}%`,
                                  }}
                                  onClick={() => onSelectChannel(channel)}
                                >
                                  <span className="text-xs font-medium truncate">
                                    ↪ {channel.name}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p className="font-medium">{channel.name} (continuação)</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <ResizableChannelBlock
                            channel={channel}
                            style={{ left: style.left, width: style.width }}
                            colors={colors}
                            isSelected={isSelected}
                            isLive={isLive}
                            noMedia={noMedia}
                            onSelect={() => onSelectChannel(channel)}
                            onResize={(startTime, endTime) => handleChannelResize(channel.id, startTime, endTime)}
                            containerWidth={containerWidth}
                          />
                        )}
                      </div>

                      {/* Expanded media items timeline */}
                      {isExpanded && hasItems && (
                        <div className="bg-muted/10">
                          {items.map((item, itemIndex) => {
                            // Calculate this item's position relative to the channel's time block
                            const channelStyle = getChannelStyle(channel);
                            if (channelStyle.isOvernight) return null; // Skip for overnight channels

                            const totalDuration = items.reduce((sum, i) => 
                              sum + (i.duration_override || i.media?.duration || 8), 0
                            );
                            
                            let offsetBefore = 0;
                            for (let i = 0; i < itemIndex; i++) {
                              offsetBefore += items[i].duration_override || items[i].media?.duration || 8;
                            }
                            const itemDuration = item.duration_override || item.media?.duration || 8;
                            
                            const itemStartPercent = (offsetBefore / totalDuration) * channelStyle.width;
                            const itemWidthPercent = (itemDuration / totalDuration) * channelStyle.width;

                            return (
                              <div
                                key={item.id}
                                className="relative border-b border-border/30"
                                style={{ height: MEDIA_ROW_HEIGHT }}
                              >
                                {/* Hour grid lines */}
                                <div className="absolute inset-0 flex pointer-events-none opacity-30">
                                  {HOURS.map((hour) => (
                                    <div
                                      key={hour}
                                      className="flex-1 border-r border-border/20"
                                    />
                                  ))}
                                </div>

                                {/* Current time indicator */}
                                <div
                                  className="absolute top-0 bottom-0 w-0.5 bg-red-500/50 z-10"
                                  style={{ left: `${currentTimePosition}%` }}
                                />

                                {/* Media item block */}
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        className={cn(
                                          "absolute top-1/2 -translate-y-1/2 h-7 rounded border flex items-center gap-1 px-1.5 overflow-hidden",
                                          "bg-primary/20 border-primary/40 text-foreground"
                                        )}
                                        style={{
                                          left: `${channelStyle.left + itemStartPercent}%`,
                                          width: `${Math.max(itemWidthPercent, 0.5)}%`,
                                        }}
                                      >
                                        {/* Mini thumbnail */}
                                        <div className="w-5 h-5 rounded bg-muted overflow-hidden shrink-0">
                                          {item.media?.thumbnail_url ? (
                                            <img 
                                              src={item.media.thumbnail_url} 
                                              alt=""
                                              className="w-full h-full object-cover"
                                            />
                                          ) : item.media?.type === 'video' ? (
                                            <div className="w-full h-full flex items-center justify-center bg-muted">
                                              <Video className="w-2.5 h-2.5 text-muted-foreground" />
                                            </div>
                                          ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-muted">
                                              <Image className="w-2.5 h-2.5 text-muted-foreground" />
                                            </div>
                                          )}
                                        </div>
                                        {itemWidthPercent > 3 && (
                                          <span className="text-[10px] truncate">
                                            {item.media?.name}
                                          </span>
                                        )}
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <div className="space-y-1">
                                        <p className="font-medium">{item.media?.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                          Duração: {itemDuration}s
                                        </p>
                                        <p className="text-xs text-muted-foreground capitalize">
                                          Tipo: {item.media?.type}
                                        </p>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Empty state */}
                {channels.length === 0 && (
                  <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">
                    Adicione canais para visualizar a programação
                  </div>
                )}
              </div>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}
    </div>
  );
};
