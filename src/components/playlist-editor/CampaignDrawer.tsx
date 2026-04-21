import { useState, useCallback, useEffect } from "react";
import { PlaylistChannel, usePlaylistChannelItems } from "@/hooks/usePlaylistChannels";
import { MediaItem } from "@/hooks/useMediaItems";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ScheduleCalendar } from "./ScheduleCalendar";
import { MediaLibrary } from "./MediaLibrary";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Folder,
  Save,
  X,
  Plus,
  Clock,
  GripVertical,
  Trash2,
  Image as ImageIcon,
  Video,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CampaignDrawerProps {
  channel: PlaylistChannel | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateChannel: (id: string, updates: Partial<PlaylistChannel>) => void;
}

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

export const CampaignDrawer = ({
  channel,
  isOpen,
  onClose,
  onUpdateChannel,
}: CampaignDrawerProps) => {
  const [name, setName] = useState("");
  const [scheduleData, setScheduleData] = useState({
    start_date: null as string | null,
    end_date: null as string | null,
    start_time: "00:00",
    end_time: "23:59",
    days_of_week: [0, 1, 2, 3, 4, 5, 6],
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const {
    items,
    addItem,
    removeItem,
    updateItem,
    reorderItems,
    getTotalDuration,
  } = usePlaylistChannelItems(channel?.id || null);

  useEffect(() => {
    if (channel) {
      setName(channel.name);
      setScheduleData({
        start_date: channel.start_date,
        end_date: channel.end_date,
        start_time: channel.start_time?.slice(0, 5) || "00:00",
        end_time: channel.end_time?.slice(0, 5) || "23:59",
        days_of_week: channel.days_of_week || [0, 1, 2, 3, 4, 5, 6],
      });
      setHasChanges(false);
    }
  }, [channel]);

  const handleSave = () => {
    if (!channel || !name.trim()) return;
    onUpdateChannel(channel.id, {
      name,
      start_date: scheduleData.start_date,
      end_date: scheduleData.end_date,
      start_time: `${scheduleData.start_time}:00`,
      end_time: `${scheduleData.end_time}:00`,
      days_of_week: scheduleData.days_of_week,
    });
    setHasChanges(false);
  };

  const handleAddMedia = useCallback(
    (media: MediaItem) => {
      if (!channel) return;
      const dur = media.duration ?? 8;
      addItem.mutate({
        channel_id: channel.id,
        media_id: media.id,
        position: items.length,
        duration_override: dur,
      });
    },
    [channel, items.length, addItem]
  );

  const handleRemoveItem = (id: string) => {
    removeItem.mutate(id);
  };

  // Drag-and-drop reorder inside drawer
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData("text/plain", index.toString());
    setDraggedIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (!isNaN(dragIndex) && dragIndex !== dropIndex) {
      const newItems = [...items];
      const [moved] = newItems.splice(dragIndex, 1);
      newItems.splice(dropIndex, 0, moved);
      reorderItems.mutate(newItems.map((it, idx) => ({ id: it.id, position: idx })));
    }
    setDraggedIndex(null);
  };

  if (!channel) return null;

  const totalDuration = getTotalDuration();
  const totalMin = Math.floor(totalDuration / 60);
  const totalSec = totalDuration % 60;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[520px] p-0 flex flex-col gap-0"
      >
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b shrink-0 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <Folder className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-sm text-muted-foreground font-normal">
                  Editar Campanha
                </SheetTitle>
                <Input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setHasChanges(true);
                  }}
                  placeholder="Nome da campanha"
                  className="text-base font-semibold border-0 px-0 h-auto py-1 shadow-none focus-visible:ring-0 focus-visible:border-b focus-visible:rounded-none"
                />
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <Badge variant="outline" className="gap-1 font-mono h-5 text-[10px]">
              <Clock className="w-2.5 h-2.5" />
              {totalMin}:{String(totalSec).padStart(2, "0")}
            </Badge>
            <span>{items.length} {items.length === 1 ? "mídia" : "mídias"}</span>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {/* Schedule */}
            <section>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Agendamento
              </h3>
              <ScheduleCalendar
                startDate={scheduleData.start_date}
                endDate={scheduleData.end_date}
                startTime={scheduleData.start_time}
                endTime={scheduleData.end_time}
                daysOfWeek={scheduleData.days_of_week}
                onChange={(updates) => {
                  setScheduleData((prev) => ({ ...prev, ...updates }));
                  setHasChanges(true);
                }}
              />
            </section>

            <Separator />

            {/* Content */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Folder className="w-4 h-4 text-primary" />
                  Conteúdo da Campanha
                </h3>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1.5 h-8">
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[380px] p-0" side="left" align="start">
                    <div className="h-[480px]">
                      <MediaLibrary
                        onDragStart={() => {}}
                        onSelect={handleAddMedia}
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {items.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed py-8 px-4 text-center">
                  <div className="inline-flex p-2 rounded-full bg-muted mb-2">
                    <Plus className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">Nenhuma mídia adicionada</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Use o botão "Adicionar" para incluir mídias
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {items.map((item, index) => {
                    const Icon = getMediaIcon(item.media?.type);
                    const duration = item.duration_override || item.media?.duration || 8;
                    return (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, index)}
                        className={cn(
                          "group flex items-center gap-2 p-2 rounded-lg border bg-card hover:bg-accent/30 transition-colors",
                          draggedIndex === index && "opacity-40"
                        )}
                      >
                        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 cursor-grab shrink-0" />

                        {/* Thumbnail */}
                        <div className="w-12 h-12 rounded bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                          {item.media?.file_url ? (
                            item.media.type === "video" ? (
                              <video src={item.media.file_url} className="w-full h-full object-cover" muted />
                            ) : (
                              <img
                                src={item.media.file_url}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            )
                          ) : (
                            <Icon className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">
                            {item.media?.name || "Sem nome"}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Icon className="w-2.5 h-2.5" />
                              {item.media?.type || "—"}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {duration}s
                            </span>
                          </div>
                        </div>

                        {/* Position */}
                        <span className="text-[10px] text-muted-foreground/60 font-mono w-6 text-right">
                          #{index + 1}
                        </span>

                        {/* Remove */}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemoveItem(item.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </ScrollArea>

        {/* Footer */}
        <SheetFooter className="border-t p-4 shrink-0 flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Fechar
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 gap-2"
            disabled={!hasChanges || !name.trim()}
          >
            <Save className="w-4 h-4" />
            Salvar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
