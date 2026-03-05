import { useState, useMemo } from "react";
import { useMediaItems, MediaItem } from "@/hooks/useMediaItems";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Image, Video, FileText, Grip, Clock, Newspaper } from "lucide-react";

interface MediaLibraryProps {
  onDragStart: (media: MediaItem) => void;
}

const getMediaIcon = (type: string) => {
  switch (type) {
    case "video":
      return <Video className="w-4 h-4" />;
    case "image":
      return <Image className="w-4 h-4" />;
    case "news":
      return <Newspaper className="w-4 h-4" />;
    default:
      return <FileText className="w-4 h-4" />;
  }
};

const formatDuration = (seconds: number | null) => {
  if (!seconds) return "8s";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const MediaLibrary = ({ onDragStart }: MediaLibraryProps) => {
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
    onDragStart(media);
  };

  return (
    <div className="h-full flex flex-col bg-card border-r">
      <div className="p-4 border-b space-y-3">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          Biblioteca de Mídias
        </h3>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Filtrar por tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="image">Imagens</SelectItem>
            <SelectItem value="video">Vídeos</SelectItem>
            <SelectItem value="news">Notícias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="flex-1 min-h-0" showScrollbar="always">
        {isLoading ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            Carregando...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            Nenhuma mídia encontrada
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredItems.map((media) => (
              <div
                key={media.id}
                draggable
                onDragStart={(e) => handleDragStart(e, media)}
                className="group flex items-center gap-3 p-2 rounded-lg border border-transparent hover:border-border hover:bg-accent/50 cursor-grab active:cursor-grabbing transition-all"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-md bg-muted overflow-hidden relative">
                  {media.file_url ? (
                    media.type === "video" ? (
                      <video
                        src={media.file_url}
                        className="w-full h-full object-cover"
                        muted
                      />
                    ) : (
                      <img
                        src={media.file_url}
                        alt={media.name}
                        className="w-full h-full object-cover"
                      />
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      {getMediaIcon(media.type)}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{media.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                      {media.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDuration(media.duration)}
                    </span>
                  </div>
                </div>

                <Grip className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="p-3 border-t bg-muted/30">
        <p className="text-xs text-muted-foreground text-center">
          Arraste para adicionar à timeline
        </p>
      </div>
    </div>
  );
};
