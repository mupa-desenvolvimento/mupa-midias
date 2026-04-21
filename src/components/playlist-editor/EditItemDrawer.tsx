import { useState, useEffect } from "react";
import { PlaylistChannelItem, PlaylistChannel } from "@/hooks/usePlaylistChannels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ScheduleCalendar } from "./ScheduleCalendar";
import {
  AppDrawer,
  AppDrawerHeader,
  AppDrawerBody,
  AppDrawerFooter,
  AppDrawerSection,
} from "@/components/ui/app-drawer";
import { Save, Clock, Folder, Image as ImageIcon, Video, FileText, ArrowRight } from "lucide-react";

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
    <AppDrawer open={isOpen} onClose={onClose} width={480} ariaDescription="Editar conteúdo">
      <AppDrawerHeader
        onClose={onClose}
        icon={<Icon className="w-4 h-4 text-primary" />}
        subtitle="Editar Conteúdo"
        title={item.media?.name || "Sem nome"}
      />

      <AppDrawerBody>
        <AppDrawerSection title="Preview">
          <div className="aspect-video rounded-lg bg-muted overflow-hidden border border-border">
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
          <div className="flex items-center gap-2 mt-3">
            <Badge variant="outline" className="h-5 text-[10px] uppercase">
              {item.media?.type || "—"}
            </Badge>
            {item.media?.resolution && (
              <span className="font-mono text-[10px] text-muted-foreground">
                {item.media.resolution}
              </span>
            )}
          </div>
        </AppDrawerSection>

        <Separator />

        <AppDrawerSection
          title="Duração de Exibição"
          icon={<Clock className="w-3.5 h-3.5 text-primary" />}
        >
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
        </AppDrawerSection>

        <Separator />

        <AppDrawerSection
          title="Campanha Vinculada"
          icon={<Folder className="w-3.5 h-3.5 text-primary" />}
        >
          {channel && (
            <button
              onClick={() => onChangeChannel?.(channel)}
              className="w-full flex items-center justify-between gap-2 p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors group"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="p-1.5 rounded bg-primary/10 shrink-0">
                  <Folder className="w-3.5 h-3.5 text-primary" />
                </div>
                <span
                  className="text-sm font-medium truncate-title text-foreground"
                  title={channel.name}
                >
                  {channel.name}
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
            </button>
          )}
        </AppDrawerSection>

        <Separator />

        <AppDrawerSection
          title="Agendamento Personalizado"
          icon={<Clock className="w-3.5 h-3.5 text-primary" />}
          action={
            <Switch
              checked={scheduleOverride}
              onCheckedChange={setScheduleOverride}
            />
          }
        >
          <p className="text-xs text-muted-foreground -mt-1 mb-3">
            Sobrescreve o agendamento da campanha
          </p>
          {scheduleOverride && (
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
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
        </AppDrawerSection>
      </AppDrawerBody>

      <AppDrawerFooter>
        <Button
          variant="outline"
          onClick={onClose}
          className="flex-1 sm:flex-initial sm:min-w-[120px]"
        >
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          className="flex-1 sm:flex-initial sm:min-w-[140px] gap-2"
        >
          <Save className="w-4 h-4" />
          Salvar
        </Button>
      </AppDrawerFooter>
    </AppDrawer>
  );
};
