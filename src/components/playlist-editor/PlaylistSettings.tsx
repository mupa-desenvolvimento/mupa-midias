import { PlaylistWithChannel } from "@/hooks/usePlaylists";
import { Channel } from "@/hooks/useChannels";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Calendar, 
  Clock, 
  Settings, 
  AlertTriangle, 
  CheckCircle,
  Zap,
  Monitor,
  Maximize,
  Move
} from "lucide-react";

const SCALE_OPTIONS = [
  { value: 'cover', label: 'Preencher Tela', description: 'Expande para cobrir toda a tela (pode cortar)' },
  { value: 'contain', label: 'Tamanho Original', description: 'Mantém proporção, pode ter barras' },
  { value: 'fill', label: 'Esticar', description: 'Estica para preencher toda a tela' },
] as const;
import { format, parseISO, isBefore, addDays } from "date-fns";

const DAYS_OF_WEEK = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

interface PlaylistSettingsProps {
  playlist: {
    name: string;
    description: string | null;
    channel_id: string | null;
    is_active: boolean;
    is_default: boolean;
    start_date: string | null;
    end_date: string | null;
    days_of_week: number[];
    start_time: string;
    end_time: string;
    priority: number;
    content_scale: 'cover' | 'contain' | 'fill';
  };
  channels: Channel[];
  itemCount: number;
  totalDuration: number;
  onChange: (updates: Partial<PlaylistSettingsProps["playlist"]>) => void;
  connectedDevicesCount?: number;
}

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${mins}m ${secs}s`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
};

export const PlaylistSettings = ({
  playlist,
  channels,
  itemCount,
  totalDuration,
  onChange,
  connectedDevicesCount = 0,
}: PlaylistSettingsProps) => {
  const toggleDayOfWeek = (day: number) => {
    const newDays = playlist.days_of_week.includes(day)
      ? playlist.days_of_week.filter((d) => d !== day)
      : [...playlist.days_of_week, day].sort();
    onChange({ days_of_week: newDays });
  };

  const getValidationWarnings = () => {
    const warnings: string[] = [];
    const now = new Date();

    if (itemCount === 0) {
      warnings.push("Playlist sem conteúdo");
    }

    if (playlist.end_date) {
      const endDate = parseISO(playlist.end_date);
      if (isBefore(endDate, now)) {
        warnings.push("Data de fim já passou");
      } else if (isBefore(endDate, addDays(now, 3))) {
        warnings.push("Expira em menos de 3 dias");
      }
    }

    if (playlist.days_of_week.length === 0) {
      warnings.push("Nenhum dia da semana selecionado");
    }

    return warnings;
  };

  const warnings = getValidationWarnings();

  return (
    <div className="h-full flex flex-col bg-card border-l">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Configurações
        </h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Status Summary */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Itens</span>
              <Badge variant="outline">{itemCount}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Duração total</span>
              <Badge variant="outline">{formatDuration(totalDuration)}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Dispositivos</span>
              <Badge variant="outline" className="gap-1">
                <Monitor className="w-3 h-3" />
                {connectedDevicesCount}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              {playlist.is_active ? (
                <Badge className="bg-green-500/10 text-green-600 border-green-200">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Ativa
                </Badge>
              ) : (
                <Badge variant="secondary">Inativa</Badge>
              )}
            </div>
          </div>

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="space-y-2">
              {warnings.map((warning, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-2 rounded-lg bg-yellow-500/10 text-yellow-600 text-sm"
                >
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {warning}
                </div>
              ))}
            </div>
          )}

          <Separator />

          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={playlist.name}
                onChange={(e) => onChange({ name: e.target.value })}
                placeholder="Nome da playlist"
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={playlist.description || ""}
                onChange={(e) => onChange({ description: e.target.value || null })}
                placeholder="Descrição opcional"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Campanha</Label>
              <Select
                value={playlist.channel_id || "none"}
                onValueChange={(value) => onUpdate({ channel_id: value === "none" ? null : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma campanha" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {channels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      {channel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Schedule */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4" />
              Programação
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Data Início</Label>
                <Input
                  type="date"
                  value={playlist.start_date || ""}
                  onChange={(e) => onChange({ start_date: e.target.value || null })}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Data Fim</Label>
                <Input
                  type="date"
                  value={playlist.end_date || ""}
                  onChange={(e) => onChange({ end_date: e.target.value || null })}
                  className="h-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Dias da Semana</Label>
              <div className="flex flex-wrap gap-1">
                {DAYS_OF_WEEK.map((day) => (
                  <label
                    key={day.value}
                    className={`flex items-center justify-center w-9 h-9 rounded-lg border cursor-pointer transition-colors text-xs font-medium ${
                      playlist.days_of_week.includes(day.value)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-accent"
                    }`}
                  >
                    <Checkbox
                      checked={playlist.days_of_week.includes(day.value)}
                      onCheckedChange={() => toggleDayOfWeek(day.value)}
                      className="sr-only"
                    />
                    {day.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Início
                </Label>
                <Input
                  type="time"
                  value={playlist.start_time}
                  onChange={(e) => onChange({ start_time: e.target.value })}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Fim
                </Label>
                <Input
                  type="time"
                  value={playlist.end_time}
                  onChange={(e) => onChange({ end_time: e.target.value })}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Display Settings */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2 text-sm">
              <Maximize className="w-4 h-4" />
              Exibição
            </h4>

            <div className="space-y-2">
              <Label className="text-xs">Escala do Conteúdo</Label>
              <div className="space-y-2">
                {SCALE_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      playlist.content_scale === option.value
                        ? "bg-primary/10 border-primary"
                        : "bg-background hover:bg-accent"
                    }`}
                  >
                    <input
                      type="radio"
                      name="content_scale"
                      value={option.value}
                      checked={playlist.content_scale === option.value}
                      onChange={(e) => onChange({ content_scale: e.target.value as 'cover' | 'contain' | 'fill' })}
                      className="sr-only"
                    />
                    <Move className={`w-4 h-4 ${playlist.content_scale === option.value ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{option.label}</p>
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <Separator />

          {/* Priority & Status */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs">
                <Zap className="w-3 h-3" />
                Prioridade (1-10)
              </Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={playlist.priority}
                onChange={(e) => onChange({ priority: parseInt(e.target.value) || 5 })}
                className="h-9"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="space-y-0.5">
                <Label className="font-medium">Playlist padrão</Label>
                <p className="text-xs text-muted-foreground">
                  Atribuída automaticamente a novos dispositivos
                </p>
              </div>
              <Switch
                checked={playlist.is_default}
                onCheckedChange={(checked) => onChange({ is_default: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="space-y-0.5">
                <Label className="font-medium">Playlist ativa</Label>
                <p className="text-xs text-muted-foreground">
                  Ativar ou desativar exibição
                </p>
              </div>
              <Switch
                checked={playlist.is_active}
                onCheckedChange={(checked) => onChange({ is_active: checked })}
              />
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
