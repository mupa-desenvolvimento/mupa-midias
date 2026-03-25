import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  Lock,
  Unlock,
  Image,
  Play,
  Clock,
  Monitor,
  Loader2,
  Send,
  X,
} from "lucide-react";
import { DeviceWithRelations } from "@/hooks/useDevices";
import { useMediaItems } from "@/hooks/useMediaItems";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/services/firebase";
import { ref, update } from "firebase/database";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow, addHours } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DeviceControlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device: DeviceWithRelations | null;
  onUpdate: () => void;
}

export function DeviceControlDialog({
  open,
  onOpenChange,
  device,
  onUpdate,
}: DeviceControlDialogProps) {
  const { toast } = useToast();
  const { mediaItems, isLoading: mediaLoading } = useMediaItems();
  
  const [playlistItems, setPlaylistItems] = useState<any[]>([]);
  const [playlistItemsLoading, setPlaylistItemsLoading] = useState(false);
  
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState("");
  const [overrideMediaId, setOverrideMediaId] = useState<string | null>(null);
  const [overrideDuration, setOverrideDuration] = useState("1"); // horas
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Carregar estado inicial do dispositivo
  useEffect(() => {
    if (device) {
      setIsBlocked((device as any).is_blocked || false);
      setBlockedMessage((device as any).blocked_message || "Dispositivo bloqueado pelo administrador");
      setOverrideMediaId((device as any).override_media_id || null);
    }
  }, [device]);

  // Carregar itens da playlist (suportando canais e itens diretos)
  useEffect(() => {
    async function loadPlaylistItems() {
      if (!device?.current_playlist_id) {
        setPlaylistItems([]);
        return;
      }

      setPlaylistItemsLoading(true);
      try {
        // Primeiro verificar se a playlist tem canais
        const { data: playlist } = await supabase
          .from("playlists")
          .select("has_channels")
          .eq("id", device.current_playlist_id)
          .single();

        if (playlist?.has_channels) {
          // Buscar canais primeiro
          const { data: channels } = await supabase
            .from("playlist_channels")
            .select("id")
            .eq("playlist_id", device.current_playlist_id);

          if (channels && channels.length > 0) {
            const channelIds = channels.map(c => c.id);
            const { data: items } = await supabase
              .from("playlist_channel_items")
              .select(`
                id,
                position,
                duration_override,
                media:media_items(id, name, type, file_url, duration, thumbnail_url)
              `)
              .in("channel_id", channelIds)
              .order("position", { ascending: true });

            setPlaylistItems(items || []);
          } else {
            setPlaylistItems([]);
          }
        } else {
          // Playlist tradicional - buscar de playlist_items
          const { data: items } = await supabase
            .from("playlist_items")
            .select(`
              id,
              position,
              duration_override,
              media:media_items(id, name, type, file_url, duration, thumbnail_url)
            `)
            .eq("playlist_id", device.current_playlist_id)
            .order("position", { ascending: true });

          setPlaylistItems(items || []);
        }
      } catch (error) {
        console.error("Erro ao carregar itens:", error);
        setPlaylistItems([]);
      } finally {
        setPlaylistItemsLoading(false);
      }
    }

    loadPlaylistItems();
  }, [device?.current_playlist_id]);

  const handleSendUpdate = async () => {
    if (!device) return;
    
    setIsSyncing(true);
    try {
      // 1. Atualizar no Supabase (mantendo compatibilidade)
      const { error } = await supabase
        .from("devices")
        .update({ 
          last_sync_requested_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", device.id);

      if (error) throw error;

      // 2. Atualizar no Firebase Realtime Database
      const deviceRef = ref(db, `${device.device_code}`);
      const companyInfo = device.company ? `${device.company.id}_${device.company.name}` : "";
      const deviceInfo = device.store ? `Loja: ${device.store.name}` : "Sem grupo";

      await update(deviceRef, {
        "atualizacao_plataforma": "true",
        "empresa_id": companyInfo,
        "device_id": device.id,
        "last-update": new Date().toISOString(),
        "grupo_device": deviceInfo
      });

      toast({
        title: "Atualização enviada",
        description: "O dispositivo receberá a atualização em instantes.",
      });
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Erro ao enviar atualização",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleBlock = async () => {
    if (!device) return;
    
    setIsSaving(true);
    try {
      const newBlockedState = !isBlocked;
      const { error } = await supabase
        .from("devices")
        .update({ 
          is_blocked: newBlockedState,
          blocked_message: blockedMessage,
          updated_at: new Date().toISOString()
        })
        .eq("id", device.id);

      if (error) throw error;

      setIsBlocked(newBlockedState);
      toast({
        title: newBlockedState ? "Dispositivo bloqueado" : "Dispositivo desbloqueado",
        description: newBlockedState 
          ? "O dispositivo exibirá a mensagem de bloqueio."
          : "O dispositivo voltará a exibir o conteúdo normal.",
      });
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Erro ao alterar bloqueio",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBlockMessage = async () => {
    if (!device) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("devices")
        .update({ 
          blocked_message: blockedMessage,
          updated_at: new Date().toISOString()
        })
        .eq("id", device.id);

      if (error) throw error;

      toast({
        title: "Mensagem atualizada",
        description: "A mensagem de bloqueio foi salva.",
      });
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar mensagem",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetOverrideMedia = async () => {
    if (!device || !overrideMediaId) return;
    
    setIsSaving(true);
    try {
      const expiresAt = addHours(new Date(), parseInt(overrideDuration));
      
      const { error } = await supabase
        .from("devices")
        .update({ 
          override_media_id: overrideMediaId,
          override_media_expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", device.id);

      if (error) throw error;

      toast({
        title: "Mídia avulsa definida",
        description: `A mídia será exibida por ${overrideDuration} hora(s).`,
      });
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Erro ao definir mídia",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearOverrideMedia = async () => {
    if (!device) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("devices")
        .update({ 
          override_media_id: null,
          override_media_expires_at: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", device.id);

      if (error) throw error;

      setOverrideMediaId(null);
      toast({
        title: "Mídia avulsa removida",
        description: "O dispositivo voltará a exibir a playlist normal.",
      });
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Erro ao remover mídia",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const currentOverrideMedia = mediaItems.find(m => m.id === (device as any)?.override_media_id);
  const overrideExpiresAt = (device as any)?.override_media_expires_at;

  if (!device) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Controle: {device.name}
          </DialogTitle>
          <DialogDescription>
            Gerencie o conteúdo e configurações do dispositivo
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="content" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="content">
              <Play className="h-4 w-4 mr-2" />
              Conteúdo
            </TabsTrigger>
            <TabsTrigger value="override">
              <Image className="h-4 w-4 mr-2" />
              Mídia Avulsa
            </TabsTrigger>
            <TabsTrigger value="control">
              <Lock className="h-4 w-4 mr-2" />
              Controle
            </TabsTrigger>
          </TabsList>

          {/* Aba Conteúdo */}
          <TabsContent value="content" className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <h4 className="font-medium">Playlist Atual</h4>
                <p className="text-sm text-muted-foreground">
                  {device.current_playlist?.name || "Nenhuma playlist atribuída"}
                </p>
              </div>
              <Button 
                onClick={handleSendUpdate} 
                disabled={isSyncing}
                className="gap-2"
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Enviar Atualização
              </Button>
            </div>

            {currentOverrideMedia && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Image className="h-4 w-4 text-yellow-500" />
                    <span className="font-medium text-yellow-700 dark:text-yellow-400">
                      Mídia Avulsa Ativa
                    </span>
                  </div>
                  <Badge variant="secondary">
                    {currentOverrideMedia.name}
                  </Badge>
                </div>
                {overrideExpiresAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Expira {formatDistanceToNow(new Date(overrideExpiresAt), { addSuffix: true, locale: ptBR })}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Conteúdos na Playlist
              </h4>
              
              {playlistItemsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : playlistItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Image className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum conteúdo na playlist</p>
                </div>
              ) : (
                <ScrollArea className="h-[250px] rounded-md border">
                  <div className="p-4 space-y-2">
                    {playlistItems.map((item, index) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                        {(item.media as any)?.thumbnail_url ? (
                          <img
                            src={(item.media as any).thumbnail_url}
                            alt={item.media?.name}
                            className="w-12 h-12 object-cover rounded"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                            <Image className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.media?.name || "Mídia"}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.duration_override || item.media?.duration || 10}s • {item.media?.type || "image"}
                          </p>
                        </div>
                        <Badge variant="outline" className="flex-shrink-0">
                          {item.media?.type === "video" ? "Vídeo" : "Imagem"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </TabsContent>

          {/* Aba Mídia Avulsa */}
          <TabsContent value="override" className="space-y-4">
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Envie uma mídia avulsa que será exibida temporariamente, sobrepondo a playlist atual.
                </p>
              </div>

              {currentOverrideMedia ? (
                <div className="p-4 border rounded-lg space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {currentOverrideMedia.thumbnail_url ? (
                        <img
                          src={currentOverrideMedia.thumbnail_url}
                          alt={currentOverrideMedia.name}
                          className="w-20 h-20 object-cover rounded"
                        />
                      ) : (
                        <div className="w-20 h-20 bg-muted rounded flex items-center justify-center">
                          <Image className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <h4 className="font-medium">{currentOverrideMedia.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {currentOverrideMedia.type}
                        </p>
                        {overrideExpiresAt && (
                          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                            Expira: {format(new Date(overrideExpiresAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleClearOverrideMedia}
                      disabled={isSaving}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Remover
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Selecione a Mídia</Label>
                    <Select
                      value={overrideMediaId || ""}
                      onValueChange={(value) => setOverrideMediaId(value || null)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha uma mídia..." />
                      </SelectTrigger>
                      <SelectContent>
                        {mediaItems
                          .filter(m => m.status === "active")
                          .map((media) => (
                            <SelectItem key={media.id} value={media.id}>
                              {media.name} ({media.type})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Duração (horas)</Label>
                    <Select
                      value={overrideDuration}
                      onValueChange={setOverrideDuration}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 hora</SelectItem>
                        <SelectItem value="2">2 horas</SelectItem>
                        <SelectItem value="4">4 horas</SelectItem>
                        <SelectItem value="8">8 horas</SelectItem>
                        <SelectItem value="12">12 horas</SelectItem>
                        <SelectItem value="24">24 horas</SelectItem>
                        <SelectItem value="48">48 horas</SelectItem>
                        <SelectItem value="168">1 semana</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={handleSetOverrideMedia}
                    disabled={!overrideMediaId || isSaving}
                    className="w-full"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Enviar Mídia Avulsa
                  </Button>
                </>
              )}
            </div>
          </TabsContent>

          {/* Aba Controle */}
          <TabsContent value="control" className="space-y-4">
            <div className="p-4 border rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium flex items-center gap-2">
                    {isBlocked ? (
                      <Lock className="h-4 w-4 text-destructive" />
                    ) : (
                      <Unlock className="h-4 w-4 text-green-500" />
                    )}
                    Bloqueio do Dispositivo
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Quando bloqueado, o dispositivo exibe apenas a mensagem de bloqueio
                  </p>
                </div>
                <Switch
                  checked={isBlocked}
                  onCheckedChange={handleToggleBlock}
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-2">
                <Label>Mensagem de Bloqueio</Label>
                <div className="flex gap-2">
                  <Input
                    value={blockedMessage}
                    onChange={(e) => setBlockedMessage(e.target.value)}
                    placeholder="Mensagem exibida quando bloqueado..."
                    disabled={isSaving}
                  />
                  <Button
                    variant="outline"
                    onClick={handleSaveBlockMessage}
                    disabled={isSaving}
                  >
                    Salvar
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-4 border rounded-lg space-y-4">
              <div className="space-y-2">
                <Label className="text-base font-medium flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Forçar Atualização
                </Label>
                <p className="text-sm text-muted-foreground">
                  Envia um sinal para o dispositivo atualizar seu conteúdo imediatamente
                </p>
              </div>
              
              <Button
                onClick={handleSendUpdate}
                disabled={isSyncing}
                variant="outline"
                className="w-full"
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Enviar Atualização Agora
              </Button>
            </div>

            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>Status atual:</strong>{" "}
                {isBlocked ? (
                  <span className="text-destructive">Bloqueado</span>
                ) : currentOverrideMedia ? (
                  <span className="text-yellow-600 dark:text-yellow-400">
                    Exibindo mídia avulsa
                  </span>
                ) : (
                  <span className="text-green-600 dark:text-green-400">
                    Exibindo playlist normal
                  </span>
                )}
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
