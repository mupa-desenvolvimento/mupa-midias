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
  Users,
  Terminal,
  RotateCcw,
  Power,
  Trash2,
} from "lucide-react";
import { DeviceWithRelations } from "@/hooks/useDevices";
import { useMediaItems } from "@/hooks/useMediaItems";
import { useDeviceGroups } from "@/hooks/useDeviceGroups";
import { useDeviceCommands, type DeviceCommand } from "@/hooks/useDeviceCommands";
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
  const { deviceGroups, isLoading: groupsLoading } = useDeviceGroups();
  const { commands, sendCommand } = useDeviceCommands(device?.id);
  
  const [playlistItems, setPlaylistItems] = useState<any[]>([]);
  const [playlistItemsLoading, setPlaylistItemsLoading] = useState(false);
  
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState("");
  const [overrideMediaId, setOverrideMediaId] = useState<string | null>(null);
  const [overrideDuration, setOverrideDuration] = useState("1");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isChangingGroup, setIsChangingGroup] = useState(false);

  // Carregar estado inicial do dispositivo
  useEffect(() => {
    if (device) {
      setIsBlocked((device as any).is_blocked || false);
      setBlockedMessage((device as any).blocked_message || "Dispositivo bloqueado pelo administrador");
      setOverrideMediaId((device as any).override_media_id || null);
      setSelectedGroupId((device as any).group_id || null);
    }
  }, [device]);

  const handleChangeGroup = async (groupId: string | null) => {
    if (!device) return;
    
    setIsChangingGroup(true);
    try {
      // 1. Get the channel/playlist associated with the group
      let playlistId: string | null = null;
      
      if (groupId) {
        // Check if the group has a direct channel_id
        const group = deviceGroups.find(g => g.id === groupId);
        if ((group as any)?.channel_id) {
          // Find a playlist linked to this channel
          const { data: playlist } = await supabase
            .from("playlists")
            .select("id")
            .eq("channel_id", (group as any).channel_id)
            .eq("is_active", true)
            .order("priority", { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (playlist) playlistId = playlist.id;
        }
        
        // If no playlist found via channel, check device_group_channels
        if (!playlistId) {
          const { data: groupChannels } = await supabase
            .from("device_group_channels")
            .select("distribution_channel_id")
            .eq("group_id", groupId)
            .order("position", { ascending: true })
            .limit(1);
          
          if (groupChannels && groupChannels.length > 0) {
            const channelId = groupChannels[0].distribution_channel_id;
            const { data: playlist } = await supabase
              .from("playlists")
              .select("id")
              .eq("channel_id", channelId)
              .eq("is_active", true)
              .order("priority", { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (playlist) playlistId = playlist.id;
          }
        }
      }

      // 2. Update device group_id and playlist
      const updatePayload: Record<string, any> = {
        group_id: groupId,
        updated_at: new Date().toISOString(),
      };
      
      if (playlistId) {
        updatePayload.current_playlist_id = playlistId;
      }

      const { error } = await supabase
        .from("devices")
        .update(updatePayload)
        .eq("id", device.id);

      if (error) throw error;

      // 3. Update group membership
      if (groupId) {
        await supabase
          .from("device_group_members")
          .upsert({ device_id: device.id, group_id: groupId }, { onConflict: "device_id,group_id" });
      }

      setSelectedGroupId(groupId);

      // 4. Auto-send update to device
      const deviceRef = ref(db, `${device.device_code}`);
      const companyInfo = device.company ? `${device.company.id}_${device.company.name}` : "";
      const groupName = groupId ? deviceGroups.find(g => g.id === groupId)?.name || "" : "";

      await update(deviceRef, {
        "atualizacao_plataforma": "true",
        "empresa_id": companyInfo,
        "device_id": device.id,
        "last-update": new Date().toISOString(),
        "grupo_device": groupName || "Sem grupo"
      });

      toast({
        title: "Grupo alterado",
        description: playlistId 
          ? "Grupo e playlist atualizados. Atualização enviada ao dispositivo."
          : "Grupo atualizado. Atualização enviada ao dispositivo.",
      });
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Erro ao alterar grupo",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsChangingGroup(false);
    }
  };

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
          <TabsList className="grid w-full grid-cols-4">
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
              Bloqueio
            </TabsTrigger>
            <TabsTrigger value="remote">
              <Terminal className="h-4 w-4 mr-2" />
              Remoto
            </TabsTrigger>
          </TabsList>

          {/* Aba Conteúdo */}
          <TabsContent value="content" className="space-y-4">
            {/* Group selector */}
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Grupo do Dispositivo
              </Label>
              <div className="flex gap-2">
                <Select
                  value={selectedGroupId || "none"}
                  onValueChange={(value) => handleChangeGroup(value === "none" ? null : value)}
                  disabled={isChangingGroup || groupsLoading}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione um grupo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem grupo</SelectItem>
                    {deviceGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                        {group.store?.name ? ` (${group.store.name})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isChangingGroup && (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mt-2" />
                )}
              </div>
            </div>

            <ScrollArea className="h-[350px] pr-4">
              {playlistItemsLoading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Carregando itens da playlist...</p>
                </div>
              ) : playlistItems.length > 0 ? (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Itens da Playlist Atual
                  </Label>
                  {playlistItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-2 rounded-lg border bg-card"
                    >
                      <div className="h-10 w-16 bg-muted rounded overflow-hidden shrink-0">
                        {item.media?.thumbnail_url ? (
                          <img
                            src={item.media.thumbnail_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <Image className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.media?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.media?.type} • {item.duration_override || item.media?.duration}s
                        </p>
                      </div>
                      <Badge variant="secondary">#{item.position}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-2 border-2 border-dashed rounded-lg">
                  <Play className="h-8 w-8 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Nenhuma playlist vinculada</p>
                    <p className="text-xs text-muted-foreground max-w-[200px]">
                      Vincule este dispositivo a um grupo ou canal para exibir conteúdo
                    </p>
                  </div>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Aba Mídia Avulsa */}
          <TabsContent value="override" className="space-y-4">
            <div className="p-4 border rounded-lg space-y-4 bg-yellow-50/50 dark:bg-yellow-900/10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                  <Image className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <h4 className="font-medium text-yellow-900 dark:text-yellow-400">Exibição Prioritária</h4>
                  <p className="text-xs text-yellow-700 dark:text-yellow-500/80">
                    Defina uma mídia para ser exibida continuamente, ignorando a playlist.
                  </p>
                </div>
              </div>

              {currentOverrideMedia ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-background rounded-lg border border-yellow-200 dark:border-yellow-900/30">
                    <div className="h-12 w-20 bg-muted rounded overflow-hidden">
                      {currentOverrideMedia.thumbnail_url ? (
                        <img src={currentOverrideMedia.thumbnail_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center"><Image className="h-5 w-5" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{currentOverrideMedia.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Expira em: {overrideExpiresAt ? formatDistanceToNow(new Date(overrideExpiresAt), { locale: ptBR, addSuffix: true }) : '—'}
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleClearOverrideMedia}
                      disabled={isSaving}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Selecionar Mídia</Label>
                    <Select
                      value={overrideMediaId || ""}
                      onValueChange={setOverrideMediaId}
                      disabled={mediaLoading || isSaving}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha uma mídia da biblioteca..." />
                      </SelectTrigger>
                      <SelectContent>
                        {mediaItems.map((media) => (
                          <SelectItem key={media.id} value={media.id}>
                            {media.name} ({media.type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Duração da Exibição</Label>
                    <Select
                      value={overrideDuration}
                      onValueChange={setOverrideDuration}
                      disabled={isSaving}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tempo..." />
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

          {/* Aba Bloqueio */}
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

          <TabsContent value="remote" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="flex flex-col items-center justify-center h-24 gap-2"
                onClick={() => sendCommand.mutate({ deviceId: device.id, command: "sync" })}
                disabled={sendCommand.isPending}
              >
                <RefreshCw className="h-6 w-6" />
                <div className="text-sm font-medium">Atualizar conteúdo</div>
              </Button>
              
              <Button
                variant="outline"
                className="flex flex-col items-center justify-center h-24 gap-2"
                onClick={() => sendCommand.mutate({ deviceId: device.id, command: "restart_app" })}
                disabled={sendCommand.isPending}
              >
                <RotateCcw className="h-6 w-6" />
                <div className="text-sm font-medium">Reiniciar app</div>
              </Button>
              
              <Button
                variant="outline"
                className="flex flex-col items-center justify-center h-24 gap-2 text-destructive hover:text-destructive"
                onClick={() => sendCommand.mutate({ deviceId: device.id, command: "close_app" })}
                disabled={sendCommand.isPending}
              >
                <Power className="h-6 w-6" />
                <div className="text-sm font-medium">Fechar app</div>
              </Button>
              
              <Button
                variant="outline"
                className="flex flex-col items-center justify-center h-24 gap-2"
                onClick={() => sendCommand.mutate({ deviceId: device.id, command: "clear_data" })}
                disabled={sendCommand.isPending}
              >
                <Trash2 className="h-6 w-6" />
                <div className="text-sm font-medium">Limpar dados</div>
              </Button>
            </div>

            <div className="space-y-2 pt-4 border-t">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                Últimos Comandos
              </Label>
              <ScrollArea className="h-[200px] w-full rounded-md border p-4">
                {commands.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum comando enviado recentemente.</p>
                ) : (
                  <div className="space-y-3">
                    {commands.map((cmd: any) => (
                      <div key={cmd.id} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded-lg">
                        <div className="flex flex-col">
                          <span className="font-mono font-medium">{cmd.command}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(cmd.created_at), "HH:mm:ss 'em' dd/MM")}
                          </span>
                        </div>
                        <Badge variant={
                          cmd.status === "executed" ? "default" :
                          cmd.status === "failed" ? "destructive" : "secondary"
                        }>
                          {cmd.status === "pending" ? "Pendente" :
                           cmd.status === "executed" ? "Executado" : "Falhou"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              <p className="text-xs text-muted-foreground italic">
                O dispositivo verifica comandos a cada 30 segundos ou ao carregar a interface.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
