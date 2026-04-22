import { useState, useCallback } from "react";
import {
  PlaylistChannel,
  PlaylistChannelItem,
} from "@/hooks/usePlaylistChannels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  Image as ImageIcon,
  Video,
  FileText,
  Edit,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FlatItem {
  item: PlaylistChannelItem;
  channel: PlaylistChannel;
}

interface MobileTimelineProps {
  items: FlatItem[];
  currentPreviewIndex: number;
  selectedItemId: string | null;
  isPlaying: boolean;
  totalDuration: number;
  onSelectItem: (id: string, index: number) => void;
  onEditItem: (item: PlaylistChannelItem) => void;
  onRemoveItem: (id: string) => void;
  onReorderGlobal: (
    updates: { itemId: string; channelId: string; position: number }[]
  ) => void;
}

const campaignColors = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-violet-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-pink-500",
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

export const MobileTimeline = ({
  items,
  currentPreviewIndex,
  selectedItemId,
  isPlaying,
  totalDuration,
  onSelectItem,
  onEditItem,
  onRemoveItem,
  onReorderGlobal,
}: MobileTimelineProps) => {
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const moveItem = useCallback(
    (fromIndex: number, direction: -1 | 1) => {
      const toIndex = fromIndex + direction;
      if (toIndex < 0 || toIndex >= items.length) return;
      const newItems = [...items];
      const [moved] = newItems.splice(fromIndex, 1);
      newItems.splice(toIndex, 0, moved);
      onReorderGlobal(
        newItems.map((it, idx) => ({
          itemId: it.item.id,
          channelId: it.item.channel_id,
          position: idx,
        }))
      );
    },
    [items, onReorderGlobal]
  );

  // Build a stable map of channel -> color index based on order of appearance
  const channelColorMap = new Map<string, number>();
  items.forEach((entry) => {
    if (!channelColorMap.has(entry.channel.id)) {
      channelColorMap.set(entry.channel.id, channelColorMap.size);
    }
  });

  return (
    <div className="h-full flex flex-col bg-muted/10">
      {/* Timeline summary header */}
      <div className="shrink-0 px-4 py-2 border-b bg-card/60 flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">
          {items.length} {items.length === 1 ? "item" : "itens"}
        </span>
        <Badge variant="outline" className="h-5 gap-1 font-mono text-[10px]">
          <Clock className="w-3 h-3" />
          {formatDuration(totalDuration)}
        </Badge>
      </div>

      {/* Vertical scrollable list */}
      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <div className="text-sm text-muted-foreground">
            Nenhuma mídia adicionada.
            <br />
            Toque em <span className="font-medium">Mídias</span> abaixo para
            começar.
          </div>
        </div>
      ) : (
        <div
          className="flex-1 overflow-y-auto overscroll-contain px-3 py-2 space-y-2"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {items.map((entry, index) => {
            const { item, channel } = entry;
            const isCurrent = currentPreviewIndex === index;
            const isSelected = selectedItemId === item.id;
            const isExpanded = expandedItemId === item.id;
            const Icon = getMediaIcon(item.media?.type);
            const duration =
              item.duration_override || item.media?.duration || 8;
            const colorIdx = channelColorMap.get(channel.id) ?? 0;
            const channelColor = campaignColors[colorIdx % campaignColors.length];

            return (
              <div
                key={item.id}
                className={cn(
                  "relative rounded-xl border bg-card overflow-hidden transition-all",
                  isCurrent && "ring-2 ring-primary",
                  isSelected && !isCurrent && "ring-1 ring-primary/40",
                  isPlaying && isCurrent && "shadow-lg shadow-primary/20"
                )}
              >
                {/* Main row — touch target ≥ 64px */}
                <div className="flex items-center gap-3 p-3">
                  {/* Channel color stripe */}
                  <div
                    className={cn("w-1 h-14 rounded-full shrink-0", channelColor)}
                    aria-hidden
                  />

                  {/* Thumbnail */}
                  <button
                    type="button"
                    onClick={() => onSelectItem(item.id, index)}
                    className="relative w-16 h-16 rounded-lg overflow-hidden bg-muted shrink-0 active:opacity-70 transition-opacity"
                    aria-label="Selecionar item"
                  >
                    {item.media?.file_url ? (
                      item.media.type === "video" ? (
                        <video
                          src={item.media.file_url}
                          className="w-full h-full object-cover"
                          muted
                          playsInline
                        />
                      ) : (
                        <img
                          src={item.media.thumbnail_url || item.media.file_url}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      )
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon className="w-6 h-6 text-muted-foreground/50" />
                      </div>
                    )}
                    {isCurrent && isPlaying && (
                      <div className="absolute inset-0 bg-primary/30 flex items-center justify-center">
                        <Play className="w-5 h-5 text-white drop-shadow-lg" />
                      </div>
                    )}
                  </button>

                  {/* Info */}
                  <button
                    type="button"
                    onClick={() => onSelectItem(item.id, index)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className="text-sm font-medium truncate leading-tight">
                      {item.media?.name || "Sem título"}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge
                        variant="outline"
                        className="h-4 px-1.5 text-[9px] font-medium border-0 bg-muted"
                      >
                        {channel.name}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {formatDuration(duration)}
                      </span>
                    </div>
                  </button>

                  {/* Expand actions toggle — 44px touch target */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 shrink-0 -mr-1"
                    onClick={() =>
                      setExpandedItemId(isExpanded ? null : item.id)
                    }
                    aria-label={isExpanded ? "Recolher ações" : "Expandir ações"}
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </Button>
                </div>

                {/* Expanded action row */}
                {isExpanded && (
                  <div className="border-t grid grid-cols-4 gap-1 p-2 bg-muted/30">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-11 flex-col gap-0.5 text-[10px]"
                      onClick={() => moveItem(index, -1)}
                      disabled={index === 0}
                    >
                      <ChevronUp className="w-4 h-4" />
                      Subir
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-11 flex-col gap-0.5 text-[10px]"
                      onClick={() => moveItem(index, 1)}
                      disabled={index === items.length - 1}
                    >
                      <ChevronDown className="w-4 h-4" />
                      Descer
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-11 flex-col gap-0.5 text-[10px]"
                      onClick={() => {
                        onEditItem(item);
                        setExpandedItemId(null);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-11 flex-col gap-0.5 text-[10px] text-destructive hover:text-destructive"
                      onClick={() => {
                        onRemoveItem(item.id);
                        setExpandedItemId(null);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                      Remover
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
