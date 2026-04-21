import { useState, useEffect } from "react";
import { PlaylistChannelItem, PlaylistChannel } from "@/hooks/usePlaylistChannels";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ScheduleCalendar } from "./ScheduleCalendar";
import { Save, X, Clock, Folder, Image as ImageIcon, Video, FileText, Eye, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditItemDrawerProps {
  item: PlaylistChannelItem | null;
  channel: PlaylistChannel | null;
  channels: PlaylistChannel[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    id: string,
    updates: {
      duration_override: number;
      is_schedule_override: boolean;
      start_date: string | null;
      end_date: string | null;
      start_time: string | null;
      end_time: string | null;
      days_of_week: number[] | null;
    }
  ) => void;
  onChangeChannel?: (channel: PlaylistChannel) => void;
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

export const EditItemDrawer = ({
  item,
  channel,
  channels,
  isOpen,
  onClose,
  onSave,
  onChangeChannel,
}: EditItemDrawerProps) => {
  const [duration, setDuration] = useState(8);
  const [scheduleOverride, setScheduleOverride] = useState(false);
  const [scheduleData, setScheduleData] = useState({
    start_date: null as string | null,
    end_date: null as string | null,
    start_time: "00:00",
    end_time: "23:59",
    days_of_week: [0, 1, 2, 3, 4, 5, 6],
  });

  useEffect(() => {
    if (item) {
      setDuration(item.duration_override || item.media?.duration || 8);
      setScheduleOverride(item.is_schedule_override || false);
      setScheduleData({
        start_date: item.start_date,
        end_date: item.end_date,
        start_time: item.start_time?.slice(0, 5) || "00:00",
        end_time: item.end_time?.slice(0, 5) || "23:59",
        days_of_week: item.days_of_week || [0, 1, 2, 3, 4, 5, 6],
      });
    }
  }, [item]);

  if (!item) return null;

  const Icon = getMediaIcon(item.media?.type);

  const handleSave = () => {
    onSave(item.id, {
      duration_override: duration,
      is_schedule_override: scheduleOverride,
      start_date: scheduleOverride ? scheduleData.start_date : null,
      end_date: scheduleOverride ? scheduleData.end_date : null,
      start_time: scheduleOverride ? `${scheduleData.start_time}:00` : null,
      end_time: scheduleOverride ? `${scheduleData.end_time}:00` : null,
      days_of_week: scheduleOverride ? scheduleData.days_of_week : null,
    });
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[480px] p-0 flex flex-col gap-0"
      >
        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-sm font-normal text-muted-foreground">
                  Editar Conteúdo
                </SheetTitle>
                <p className="text-base font-semibold truncate">
                  {item.media?.name || "Sem nome"}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {/* Preview */}
            <section>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                Preview
              </Label>
              <div className="aspect-video rounded-lg bg-muted overflow-hidden border">
                {item.media?.file_url ? (
                  item.media.type === "video" ? (
                    <video
                      src={item.media.file_url}
                      className="w-full h-full object-contain"
                      controls
                      muted
                    />
                  ) : (
                    <img
                      src={item.media.file_url}
                      alt=""
                      className="w-full h-full object-contain"
                    />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Icon className="w-12 h-12 text-muted-foreground/40" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                <Badge variant="outline" className="h-5 text-[10px] uppercase">
                  {item.media?.type || "—"}
                </Badge>
                {item.media?.resolution && (
                  <span className="font-mono">{item.media.resolution}</span>
                )}
              </div>
            </section>

            <Separator />

            {/* Duration */}
            <section>
              <Label htmlFor="duration" className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Duração de Exibição
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="duration"
                  type="number"
                  min={1}
                  max={3600}
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 8)}
                  className="font-mono text-lg font-bold"
                />
                <span className="text-sm text-muted-foreground">segundos</span>
              </div>
            </section>

            <Separator />

            {/* Linked Campaign */}
            <section>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                <Folder className="w-3 h-3" />
                Campanha Vinculada
              </Label>
              {channel && (
                <button
                  onClick={() => onChangeChannel?.(channel)}
                  className="w-full flex items-center justify-between gap-2 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 rounded bg-primary/10">
                      <Folder className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="text-sm font-medium truncate">
                      {channel.name}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                </button>
              )}
            </section>

            <Separator />

            {/* Schedule Override */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Agendamento Personalizado
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Sobrescreve o agendamento da campanha
                  </p>
                </div>
                <Switch
                  checked={scheduleOverride}
                  onCheckedChange={setScheduleOverride}
                />
              </div>

              {scheduleOverride && (
                <div className="mt-3 p-3 rounded-lg bg-muted/30 border">
                  <ScheduleCalendar
                    startDate={scheduleData.start_date}
                    endDate={scheduleData.end_date}
                    startTime={scheduleData.start_time}
                    endTime={scheduleData.end_time}
                    daysOfWeek={scheduleData.days_of_week}
                    onChange={(updates) =>
                      setScheduleData((prev) => ({ ...prev, ...updates }))
                    }
                  />
                </div>
              )}
            </section>
          </div>
        </ScrollArea>

        <SheetFooter className="border-t p-4 shrink-0 flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSave} className="flex-1 gap-2">
            <Save className="w-4 h-4" />
            Salvar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
