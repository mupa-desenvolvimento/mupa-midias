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
      {/* Sequential Timeline Header */}
      <div className="px-4 py-2 border-b bg-muted/30 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Linha do Tempo (Sequencial)</h3>
        </div>
        
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Execução baseada em ordem global
          </span>
        </div>
      </div>

      <AllMediaTimeline
        channelsWithItems={channelsWithItems || []}
        onSelectChannel={onSelectChannel}
        onReorderGlobal={onReorderGlobal}
        onUpdateItem={onUpdateItem}
      />
    </div>
  );
};
