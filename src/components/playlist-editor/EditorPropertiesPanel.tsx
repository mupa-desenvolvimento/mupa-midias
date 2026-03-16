import { useState, useMemo } from "react";
import { useMediaItems, MediaItem } from "@/hooks/useMediaItems";
import { useAutoContent, AutoContentItem } from "@/hooks/useAutoContent";
import { Channel } from "@/hooks/useChannels";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Image,
  Video,
  FileText,
  Newspaper,
  CloudSun,
  Clock,
  Calendar,
  Zap,
  Monitor,
  X,
  GripVertical,
  Sparkles,
  Instagram,
  QrCode,
  Lightbulb,
  Cake,
  Apple,
  MessageCircleHeart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MEDIA_FILTER_OPTIONS } from "@/constants/contentTypes";

interface PlaylistFormData {
  name: string;
  description: string | null;
  channel_id: string | null;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  priority: number;
}

interface EditorPropertiesPanelProps {
  activePanel: "media" | "settings";
  formData: PlaylistFormData;
  channels: Channel[];
  itemCount: number;
  totalDuration: number;
  connectedDevicesCount: number;
  onFormChange: (updates: Partial<PlaylistFormData>) => void;
  onAddMedia: (media: MediaItem, position: number) => void;
  itemsLength: number;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "D" },
  { value: 1, label: "S" },
  { value: 2, label: "T" },
  { value: 3, label: "Q" },
  { value: 4, label: "Q" },
  { value: 5, label: "S" },
  { value: 6, label: "S" },
];

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
};

const getMediaIcon = (type: string) => {
  const map: Record<string, any> = {
    video: Video,
    image: Image,
    news: Newspaper,
    weather: CloudSun,
    motivational: MessageCircleHeart,
    curiosity: Lightbulb,
    birthday: Cake,
    nutrition: Apple,
    instagram: Instagram,
    campaign: QrCode,
  };
  return map[type] || FileText;
};

const getAutoContentLabel = (type: string) => {
  switch (type) {
    case "weather": return "Clima";
    case "news": return "Notícias";
    case "quote": return "Frases";
    case "curiosity": return "Curiosidades";
    case "birthday": return "Aniversários";
    case "nutrition": return "Nutrição";
    case "instagram": return "Instagram";
    case "qr_campaign": return "Campanhas QR";
    default: return type;
  }
};

const MediaLibraryPanel = ({ onAddMedia, itemsLength }: { 
  onAddMedia: (media: MediaItem, position: number) => void;
  itemsLength: number;
}) => {
  const { mediaItems, isLoading } = useMediaItems();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filteredItems = useMemo(() => {
    return mediaItems.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "all" || item.type === typeFilter;
      const isActive = item.status === "active";
      return matchesSearch && matchesType && isActive;
    });
  }, [mediaItems, search, typeFilter]);

  const handleDragStart = (e: React.DragEvent, media: MediaItem) => {
    e.dataTransfer.setData("application/json", JSON.stringify(media));
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Search & Filter */}
      <div className="p-3 space-y-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar mídia..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        <div className="flex gap-1 flex-wrap">
          {MEDIA_FILTER_OPTIONS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setTypeFilter(filter.value)}
              className={cn(
                "flex-1 h-7 text-xs rounded transition-colors",
                typeFilter === filter.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Media Grid - Scroll local com scrollbar sempre visível */}
      <ScrollArea className="flex-1 min-h-0" showScrollbar="always">
        {isLoading ? (
          <div className="p-4 text-center text-muted-foreground text-sm">Carregando...</div>
        ) : filteredItems.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">Nenhuma mídia</div>
        ) : (
          <div className="grid grid-cols-2 gap-2 p-3">
            {filteredItems.map((media) => {
              const Icon = getMediaIcon(media.type);
              
              return (
                <div
                  key={media.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, media)}
                  className="group relative rounded-lg overflow-hidden bg-muted cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-primary/50 transition-all"
                  style={{ width: '100%', height: 100 }}
                >
                  {media.file_url ? (
                    media.type === "video" ? (
                      <video
                        src={media.file_url}
                        className="w-full h-full object-cover"
                        muted
                        preload="metadata"
                      />
                    ) : (
                      <img
                        src={media.file_url}
                        alt={media.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Icon className="w-8 h-8" />
                    </div>
                  )}
                  
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  {/* Info */}
                  <div className="absolute bottom-0 left-0 right-0 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[10px] text-white truncate">{media.name}</p>
                    <div className="flex items-center gap-1 text-[9px] text-white/60">
                      <Icon className="w-2.5 h-2.5" />
                      <span>{formatDuration(media.duration || 10)}</span>
                    </div>
                  </div>

                  {/* Drag indicator */}
                  <div className="absolute top-1 right-1 p-1 bg-black/50 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    <GripVertical className="w-3 h-3 text-white/70" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <p className="text-[10px] text-muted-foreground text-center">
          Arraste para adicionar à timeline
        </p>
      </div>
    </div>
  );
};

const AutoContentPanel = ({
  onAddAutoContent,
  onAddMedia,
  itemsLength,
}: {
  onAddAutoContent: (item: AutoContentItem) => void;
  onAddMedia: (media: MediaItem, position: number) => void;
  itemsLength: number;
}) => {
  const { items, isLoadingItems } = useAutoContent();
  const { mediaItems, isLoading: isLoadingMedia } = useMediaItems();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filteredItems = useMemo(() => {
    // Clone items to avoid mutating source
    const currentItems = [...items];
    
    // Inject default News item if missing
    if (!currentItems.some(i => i.type === 'news')) {
      currentItems.push({
        id: 'default-news',
        tenant_id: 'default',
        type: 'news',
        title: 'Notícias Recentes',
        description: 'Exibe as últimas notícias configuradas no painel de Notícias.',
        status: 'active',
        source: 'mock',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        category: null,
        image_url: null,
        payload_json: null,
        expires_at: null
      });
    }

    return currentItems.filter((item) => {
      const matchesStatus = item.status === "active";
      const matchesSearch =
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        (item.description || "").toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "all" || item.type === typeFilter;
      return matchesStatus && matchesSearch && matchesType;
    });
  }, [items, search, typeFilter]);

  const filteredNewsSlides = useMemo(() => {
    const q = search.toLowerCase();
    const matchesType = typeFilter === "all" || typeFilter === "news";

    if (!matchesType) return [];

    return mediaItems
      .filter((m) => m.status === "active" && m.type === "news")
      .filter((m) => {
        const meta = m.metadata as any;
        const isSlide = !!(meta && typeof meta === "object" && ("layout" in meta || "news_category" in meta));
        if (!isSlide) return false;
        if (!q) return true;
        return (m.name || "").toLowerCase().includes(q);
      });
  }, [mediaItems, search, typeFilter]);

  const filteredWeatherSlides = useMemo(() => {
    const q = search.toLowerCase();
    const matchesType = typeFilter === "all" || typeFilter === "weather";

    if (!matchesType) return [];

    return mediaItems
      .filter((m) => m.status === "active" && m.type === "weather")
      .filter((m) => {
        if (!q) return true;
        return (m.name || "").toLowerCase().includes(q);
      });
  }, [mediaItems, search, typeFilter]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="p-3 space-y-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conteúdo automático..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <div className="flex gap-1">
          {[
            { value: "all", label: "Todos" },
            { value: "weather", label: "Clima" },
            { value: "news", label: "Notícias" },
            { value: "quote", label: "Frases" },
            { value: "curiosity", label: "Curiosidades" },
            { value: "birthday", label: "Aniversários" },
            { value: "nutrition", label: "Nutrição" },
            { value: "instagram", label: "Instagram" },
            { value: "qr_campaign", label: "QR Code" },
          ].map((filter) => (
            <button
              key={filter.value}
              onClick={() => setTypeFilter(filter.value)}
              className={cn(
                "flex-1 h-7 text-[10px] rounded transition-colors",
                typeFilter === filter.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0" showScrollbar="always">
        {isLoadingItems || isLoadingMedia ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            Carregando...
          </div>
        ) : filteredItems.length === 0 && filteredNewsSlides.length === 0 && filteredWeatherSlides.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            Nenhum conteúdo automático
          </div>
        ) : (
          <div className="flex flex-col gap-2 p-3">
            {filteredWeatherSlides.length > 0 && (
              <div className="pt-1 pb-1">
                <p className="text-[10px] text-muted-foreground">Slides de Clima</p>
              </div>
            )}
            {filteredWeatherSlides.map((media) => {
              const meta = media.metadata as any;
              const subtitle = meta?.weather_location_id ? "Clima (local configurado)" : null;

              return (
                <div
                  key={media.id}
                  className="flex items-start gap-3 p-2 rounded-lg border border-border bg-muted/60"
                >
                  <div className="w-12 h-12 rounded-md bg-background flex items-center justify-center text-primary flex-shrink-0">
                    <CloudSun className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium truncate">{media.name}</p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        Clima
                      </span>
                    </div>
                    {subtitle ? (
                      <p className="text-[10px] text-muted-foreground line-clamp-2">
                        {subtitle}
                      </p>
                    ) : null}
                    <div className="flex items-center justify-end pt-1">
                      <button
                        onClick={() => onAddMedia(media, itemsLength)}
                        className="inline-flex items-center justify-center h-7 px-2 rounded-md text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        Adicionar na playlist
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredNewsSlides.length > 0 && (
              <div className="pt-1 pb-1">
                <p className="text-[10px] text-muted-foreground">Slides de Notícias</p>
              </div>
            )}
            {filteredNewsSlides.map((media) => {
              const meta = media.metadata as any;
              const layout = meta?.layout as string | undefined;
              const category = meta?.news_category as string | null | undefined;
              const subtitle = [
                category ? `Categoria: ${category}` : null,
                layout ? `Layout: ${layout}` : null,
              ].filter(Boolean).join(" • ");

              return (
                <div
                  key={media.id}
                  className="flex items-start gap-3 p-2 rounded-lg border border-border bg-muted/60"
                >
                  <div className="w-12 h-12 rounded-md bg-background flex items-center justify-center text-primary flex-shrink-0">
                    <Newspaper className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium truncate">{media.name}</p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        Notícias
                      </span>
                    </div>
                    {subtitle ? (
                      <p className="text-[10px] text-muted-foreground line-clamp-2">
                        {subtitle}
                      </p>
                    ) : null}
                    <div className="flex items-center justify-end pt-1">
                      <button
                        onClick={() => onAddMedia(media, itemsLength)}
                        className="inline-flex items-center justify-center h-7 px-2 rounded-md text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        Adicionar na playlist
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 p-2 rounded-lg border border-border bg-muted/60"
              >
                <div className="w-12 h-12 rounded-md bg-background flex items-center justify-center text-primary flex-shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium truncate">{item.title}</p>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {getAutoContentLabel(item.type)}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-[10px] text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  <div className="flex items-center justify-end pt-1">
                    <button
                      onClick={() => onAddAutoContent(item)}
                      className="inline-flex items-center justify-center h-7 px-2 rounded-md text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      Adicionar na playlist
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

const SettingsPanel = ({
  formData,
  channels,
  itemCount,
  totalDuration,
  connectedDevicesCount,
  onFormChange,
}: {
  formData: PlaylistFormData;
  channels: Channel[];
  itemCount: number;
  totalDuration: number;
  connectedDevicesCount: number;
  onFormChange: (updates: Partial<PlaylistFormData>) => void;
}) => {
  const toggleDayOfWeek = (day: number) => {
    const newDays = formData.days_of_week.includes(day)
      ? formData.days_of_week.filter((d) => d !== day)
      : [...formData.days_of_week, day].sort();
    onFormChange({ days_of_week: newDays });
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 rounded-lg bg-muted text-center">
            <p className="text-lg font-semibold">{itemCount}</p>
            <p className="text-[10px] text-muted-foreground">Itens</p>
          </div>
          <div className="p-3 rounded-lg bg-muted text-center">
            <p className="text-lg font-semibold">{formatDuration(totalDuration)}</p>
            <p className="text-[10px] text-muted-foreground">Duração</p>
          </div>
          <div className="p-3 rounded-lg bg-muted text-center">
            <p className="text-lg font-semibold">{connectedDevicesCount}</p>
            <p className="text-[10px] text-muted-foreground">Devices</p>
          </div>
        </div>

        {/* Basic Info */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome do Projeto</Label>
            <Input
              value={formData.name}
              onChange={(e) => onFormChange({ name: e.target.value })}
              placeholder="Nome da playlist"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Descrição</Label>
            <Textarea
              value={formData.description || ""}
              onChange={(e) => onFormChange({ description: e.target.value || null })}
              placeholder="Opcional"
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Canal</Label>
            <Select
              value={formData.channel_id || "none"}
              onValueChange={(v) => onFormChange({ channel_id: v === "none" ? null : v })}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Selecione" />
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

        {/* Schedule */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            <span>Programação</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Início</Label>
              <Input
                type="date"
                value={formData.start_date || ""}
                onChange={(e) => onFormChange({ start_date: e.target.value || null })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Fim</Label>
              <Input
                type="date"
                value={formData.end_date || ""}
                onChange={(e) => onFormChange({ end_date: e.target.value || null })}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground">Dias da Semana</Label>
            <div className="flex gap-1">
              {DAYS_OF_WEEK.map((day) => (
                <button
                  key={day.value}
                  onClick={() => toggleDayOfWeek(day.value)}
                  className={cn(
                    "flex-1 h-8 rounded text-xs font-medium transition-colors",
                    formData.days_of_week.includes(day.value)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Horário Início
              </Label>
              <Input
                type="time"
                value={formData.start_time}
                onChange={(e) => onFormChange({ start_time: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Horário Fim
              </Label>
              <Input
                type="time"
                value={formData.end_time}
                onChange={(e) => onFormChange({ end_time: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Priority & Status */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              Prioridade (1-10)
            </Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={formData.priority}
              onChange={(e) => onFormChange({ priority: parseInt(e.target.value) || 5 })}
              className="h-9 text-sm"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
            <div>
              <p className="text-sm font-medium">Ativa</p>
              <p className="text-[10px] text-muted-foreground">Exibir nos dispositivos</p>
            </div>
            <Switch
              checked={formData.is_active}
              onCheckedChange={(checked) => onFormChange({ is_active: checked })}
            />
          </div>
        </div>
      </div>
    </ScrollArea>
  );
};

export const EditorPropertiesPanel = ({
  activePanel,
  formData,
  channels,
  itemCount,
  totalDuration,
  connectedDevicesCount,
  onFormChange,
  onAddMedia,
  itemsLength,
  onAddAutoContent,
}: EditorPropertiesPanelProps & {
  onAddAutoContent: (item: AutoContentItem) => void;
}) => {
  const [mediaTab, setMediaTab] = useState<"library" | "auto">("library");

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="h-10 flex items-center justify-between px-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {activePanel === "media" ? "Conteúdos" : "Configurações"}
          </span>
          {activePanel === "media" && (
            <div className="flex gap-1">
              <button
                onClick={() => setMediaTab("library")}
                className={cn(
                  "h-7 px-2 rounded text-[10px] font-medium transition-colors",
                  mediaTab === "library"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                Mídias
              </button>
              <button
                onClick={() => setMediaTab("auto")}
                className={cn(
                  "h-7 px-2 rounded text-[10px] font-medium transition-colors inline-flex items-center gap-1",
                  mediaTab === "auto"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <Sparkles className="w-3 h-3" />
                Automático
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden min-h-0">
        {activePanel === "media" ? (
          mediaTab === "library" ? (
            <MediaLibraryPanel onAddMedia={onAddMedia} itemsLength={itemsLength} />
          ) : (
            <AutoContentPanel onAddAutoContent={onAddAutoContent} onAddMedia={onAddMedia} itemsLength={itemsLength} />
          )
        ) : (
          <SettingsPanel
            formData={formData}
            channels={channels}
            itemCount={itemCount}
            totalDuration={totalDuration}
            connectedDevicesCount={connectedDevicesCount}
            onFormChange={onFormChange}
          />
        )}
      </div>
    </div>
  );
};
