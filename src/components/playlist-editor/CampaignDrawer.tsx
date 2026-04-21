import { useState, useCallback, useEffect } from "react";
import { PlaylistChannel, usePlaylistChannelItems } from "@/hooks/usePlaylistChannels";
import { MediaItem } from "@/hooks/useMediaItems";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EditorTimeline } from "./EditorTimeline";
import { Radio, Clock, Save, X, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
// ... removed invalid import
import { MediaLibrary } from "./MediaLibrary";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface CampaignDrawerProps {
  channel: PlaylistChannel | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateChannel: (id: string, updates: Partial<PlaylistChannel>) => void;
  playlistName: string;
}

export const CampaignDrawer = ({
  channel,
  isOpen,
  onClose,
  onUpdateChannel,
  playlistName,
}: CampaignDrawerProps) => {
  const [name, setName] = useState("");
  const { 
    items, 
    isLoading: itemsLoading, 
    addItem, 
    removeItem, 
    updateItem, 
    reorderItems,
    getTotalDuration 
  } = usePlaylistChannelItems(channel?.id || "");

  useEffect(() => {
    if (channel) {
      setName(channel.name);
    }
  }, [channel]);

  const handleSave = () => {
    if (channel && name.trim()) {
      onUpdateChannel(channel.id, { name });
    }
  };

  const handleAddMedia = useCallback(async (media: MediaItem, position: number) => {
    if (!channel) return;
    const itemDuration = (media.type === "video" && media.duration) ? media.duration : (media.duration ?? 8);
    
    addItem.mutate({
      channel_id: channel.id,
      media_id: media.id,
      position,
      duration_override: itemDuration,
    });
  }, [channel, addItem]);

  const handleReorderItems = useCallback((orderedItems: { id: string; position: number }[]) => {
    reorderItems.mutate(orderedItems);
  }, [reorderItems]);

  const handleUpdateDuration = useCallback((id: string, duration: number) => {
    updateItem.mutate({ id, duration_override: duration });
  }, [updateItem]);

  const handleRemoveItem = useCallback((id: string) => {
    removeItem.mutate(id);
  }, [removeItem]);

  if (!channel) return null;

  const totalDuration = getTotalDuration();

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-[500px] sm:w-[600px] p-0 flex flex-col">
        <SheetHeader className="p-6 border-b shrink-0">
          <div className="flex items-center justify-between mb-4">
            <SheetTitle className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-primary" />
              Editar Campanha
            </SheetTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Nome da Campanha
              </label>
              <Input 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Ofertas de Verão"
                className="text-lg font-semibold"
              />
            </div>
            
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="gap-1 font-normal">
                  <Clock className="w-3 h-3" />
                  {channel.start_time.slice(0, 5)} - {channel.end_time.slice(0, 5)}
                </Badge>
                <span>{items.length} mídias</span>
              </div>
              <span className="font-mono">
                Duração total: {Math.floor(totalDuration / 60)}:{String(totalDuration % 60).padStart(2, '0')}
              </span>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="p-6 flex items-center justify-between bg-muted/30 border-b shrink-0">
            <h3 className="text-sm font-semibold">Conteúdo da Campanha</h3>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Adicionar Mídia
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" side="left" align="start">
                <div className="h-[500px]">
                  <MediaLibrary onDragStart={handleAddMedia} onSelect={handleAddMedia} />
                </div>
              </PopoverContent>
            </Popover>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-6">
              <EditorTimeline
                items={items.map(i => ({ ...i, playlist_id: channel.playlist_id })) as any}
                selectedItemId={null}
                currentPreviewIndex={-1}
                onSelectItem={() => {}}
                onSetPreviewIndex={() => {}}
                onAddMedia={handleAddMedia}
                onRemoveItem={handleRemoveItem}
                onDuplicateItem={() => {}}
                onUpdateDuration={handleUpdateDuration}
                onUpdateItemSettings={() => {}}
                onReorderItems={handleReorderItems}
                totalDuration={totalDuration}
                isPlaying={false}
              />
            </div>
          </ScrollArea>
        </div>

        <SheetFooter className="p-6 border-t shrink-0">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSave} className="flex-1 gap-2">
            <Save className="w-4 h-4" />
            Salvar Alterações
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
