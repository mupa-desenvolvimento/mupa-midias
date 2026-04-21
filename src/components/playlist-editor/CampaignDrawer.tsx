import { useState, useCallback, useEffect } from "react";
import { PlaylistChannel, usePlaylistChannelItems } from "@/hooks/usePlaylistChannels";
import { MediaItem } from "@/hooks/useMediaItems";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScheduleCalendar } from "./ScheduleCalendar";
import { MediaLibrary } from "./MediaLibrary";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AppDrawer,
  AppDrawerHeader,
  AppDrawerBody,
  AppDrawerFooter,
  AppDrawerSection,
} from "@/components/ui/app-drawer";
import {
  Folder,
  Save,
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
    <AppDrawer open={isOpen} onClose={onClose} width={520} ariaDescription="Editar campanha">
      <AppDrawerHeader
        onClose={onClose}
        icon={<Folder className="w-4 h-4 text-primary" />}
        titleSlot={
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium leading-tight">
              Editar Campanha
            </p>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setHasChanges(true);
              }}
              placeholder="Nome da campanha"
              className="text-base font-semibold border-0 px-0 h-auto py-1 mt-0.5 shadow-none focus-visible:ring-0 focus-visible:border-b focus-visible:rounded-none truncate-title"
            />
          </div>
        }
        meta={
          <>
            <Badge variant="outline" className="gap-1 font-mono h-5 text-[10px]">
              <Clock className="w-2.5 h-2.5" />
              {totalMin}:{String(totalSec).padStart(2, "0")}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {items.length} {items.length === 1 ? "mídia" : "mídias"}
            </span>
          </>
        }
      />

      <AppDrawerBody>
        <AppDrawerSection
          title="Agendamento"
          icon={<Clock className="w-3.5 h-3.5 text-primary" />}
        >
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
        </AppDrawerSection>

        <Separator />

        <AppDrawerSection
          title="Conteúdo da Campanha"
          icon={<Folder className="w-3.5 h-3.5 text-primary" />}
          action={
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5 h-8">
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[380px] p-0" side="left" align="start">
                <div className="h-[480px]">
                  <MediaLibrary onDragStart={() => {}} onSelect={handleAddMedia} />
                </div>
              </PopoverContent>
            </Popover>
          }
        >
          {items.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-border py-10 px-4 text-center bg-muted/20">
              <div className="inline-flex p-2.5 rounded-full bg-muted mb-3">
                <Plus className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">Nenhuma mídia adicionada</p>
              <p className="text-xs text-muted-foreground mt-1">
                Use o botão "Adicionar" para incluir mídias
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {items.map((item, index) => {
                const Icon = getMediaIcon(item.media?.type);
                const duration = item.duration_override || item.media?.duration || 8;
                return (
                  <li
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(e, index)}
                    className={cn(
                      "group flex items-center gap-3 p-2.5 rounded-lg border border-border bg-card hover:bg-accent/40 transition-colors min-w-0",
                      draggedIndex === index && "opacity-40"
                    )}
                  >
                    <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50 cursor-grab shrink-0" />

                    <div className="w-12 h-12 rounded-md bg-muted overflow-hidden shrink-0 flex items-center justify-center border border-border/50">
                      {item.media?.file_url ? (
                        item.media.type === "video" ? (
                          <video
                            src={item.media.file_url}
                            className="w-full h-full object-cover"
                            muted
                          />
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

                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium truncate-title text-foreground"
                        title={item.media?.name || "Sem nome"}
                      >
                        {item.media?.name || "Sem nome"}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 uppercase tracking-wide">
                          <Icon className="w-2.5 h-2.5" />
                          {item.media?.type || "—"}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {duration}s
                        </span>
                      </div>
                    </div>

                    <span className="text-[10px] text-muted-foreground/60 font-mono w-7 text-right shrink-0">
                      #{index + 1}
                    </span>

                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemoveItem(item.id)}
                      aria-label="Remover mídia"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </AppDrawerSection>
      </AppDrawerBody>

      <AppDrawerFooter>
        <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-initial sm:min-w-[120px]">
          Fechar
        </Button>
        <Button
          onClick={handleSave}
          className="flex-1 sm:flex-initial sm:min-w-[140px] gap-2"
          disabled={!hasChanges || !name.trim()}
        >
          <Save className="w-4 h-4" />
          Salvar
        </Button>
      </AppDrawerFooter>
    </AppDrawer>
  );
};
