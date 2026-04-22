import { DeviceWithRelations } from "@/hooks/useDevices";
import { usePlaylists } from "@/hooks/usePlaylists";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Monitor,
  MapPin,
  Copy,
  ExternalLink,
  Camera,
  Lock,
  Image,
  Pencil,
  Trash2,
  Settings2,
  Wifi,
  WifiOff,
  Clock,
  ListMusic,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow, differenceInMinutes, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useState, useCallback } from "react";
import { useFirebaseDevices } from "@/hooks/useFirebaseDevices";

interface DeviceDetailSheetProps {
  device: DeviceWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (device: DeviceWithRelations) => void;
  onDelete: (device: DeviceWithRelations) => void;
  onControl: (device: DeviceWithRelations) => void;
  onMonitor: (device: DeviceWithRelations) => void;
  onUpdatePlaylist: (deviceId: string, playlistId: string | null) => Promise<void>;
}

export const DeviceDetailSheet = ({
  device,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onControl,
  onMonitor,
  onUpdatePlaylist,
}: DeviceDetailSheetProps) => {
  const { toast } = useToast();
  const { playlists } = usePlaylists();
  const { firebaseData } = useFirebaseDevices();
  const [changingPlaylist, setChangingPlaylist] = useState(false);

  if (!device) return null;

  const getDeviceStatus = () => {
    const firebaseInfo = Object.values(firebaseData || {}).find(f => f.device_id === device.id);
    const lastUpdate = firebaseInfo?.["last-update"] || device.last_seen_at;

    if (device.status === "pending" && !lastUpdate) return "pending";
    if (!lastUpdate) return "offline";

    try {
      const lastSeenDate = typeof lastUpdate === 'string' ? parseISO(lastUpdate) : new Date(lastUpdate);
      const now = new Date();
      const diffInMinutes = differenceInMinutes(now, lastSeenDate);
      return diffInMinutes < 5 ? "online" : "offline";
    } catch (e) {
      console.error("Error parsing date in Sheet:", lastUpdate, e);
      return "offline";
    }
  };

  const status = getDeviceStatus();

  const statusConfig = {
    online: { label: "Online", variant: "default" as const, icon: Wifi, color: "text-green-500" },
    offline: { label: "Offline", variant: "destructive" as const, icon: WifiOff, color: "text-red-500" },
    pending: { label: "Pendente", variant: "secondary" as const, icon: Clock, color: "text-yellow-500" },
  };

  const currentStatusConfig = statusConfig[status] || statusConfig.offline;
  const StatusIcon = currentStatusConfig.icon;

  const copyDeviceLink = () => {
    const deviceUrl = `${window.location.origin}/play/${device.device_code}`;
    navigator.clipboard.writeText(deviceUrl);
    toast({ title: "Link copiado!", description: "Link do dispositivo copiado." });
  };

  const openDevicePlayer = () => {
    const width = window.screen.availWidth;
    const height = window.screen.availHeight;
    window.open(
      `/play/${device.device_code}`,
      `player_${device.device_code}`,
      `width=${width},height=${height},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=no`
    );
  };

  const handlePlaylistChange = async (value: string) => {
    setChangingPlaylist(true);
    try {
      await onUpdatePlaylist(device.id, value === "__none__" ? null : value);
      toast({ title: "Playlist atualizada", description: `Playlist do dispositivo "${device.name}" atualizada.` });
    } catch {
      toast({ title: "Erro", description: "Falha ao atualizar playlist.", variant: "destructive" });
    } finally {
      setChangingPlaylist(false);
    }
  };

  const formatLastSeen = () => {
    const firebaseInfo = Object.values(firebaseData || {}).find(f => f.device_id === device.id);
    const lastUpdate = firebaseInfo?.["last-update"] || device.last_seen_at;
    if (!lastUpdate) return "Nunca conectado";
    return formatDistanceToNow(new Date(lastUpdate), { addSuffix: true, locale: ptBR });
  };

  const InfoRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-sm font-medium text-right max-w-[60%] truncate">{children}</div>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b px-6 pt-6 pb-4">
          <SheetHeader className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Monitor className="h-6 w-6 text-primary" />
                </div>
                <div className={`absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background ${
                  status === "online" ? "bg-green-500" : status === "offline" ? "bg-red-500" : "bg-yellow-500"
                }`} />
              </div>
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-lg truncate">{device.name}</SheetTitle>
                <SheetDescription className="font-mono text-xs">{device.device_code}</SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* Quick Actions */}
          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => { onOpenChange(false); onControl(device); }}>
              <Settings2 className="h-3.5 w-3.5 mr-1.5" /> Controle
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={() => { onOpenChange(false); onEdit(device); }}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
            </Button>
            {device.camera_enabled && (
              <Button variant="outline" size="sm" onClick={() => { onOpenChange(false); onMonitor(device); }}>
                <Camera className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Alerts */}
          {device.is_blocked && (
            <div className="flex items-center gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5">
              <Lock className="h-4 w-4 text-destructive shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">Dispositivo Bloqueado</p>
                {device.blocked_message && (
                  <p className="text-xs text-destructive/80 mt-0.5">{device.blocked_message}</p>
                )}
              </div>
            </div>
          )}

          {!device.is_blocked && device.override_media_id && (
            <div className="flex items-center gap-2.5 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2.5">
              <Image className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">Mídia Avulsa Ativa</p>
            </div>
          )}

          {/* Status Section */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Status</h4>
            <div className="rounded-lg border bg-card p-3 space-y-0.5">
              <InfoRow label="Conexão">
                <div className="flex items-center gap-1.5">
                  <StatusIcon className={`h-3.5 w-3.5 ${currentStatusConfig.color}`} />
                  <Badge variant={currentStatusConfig.variant} className="text-xs">
                    {currentStatusConfig.label}
                  </Badge>
                </div>
              </InfoRow>
              <InfoRow label="Último acesso">{formatLastSeen(device.last_seen_at)}</InfoRow>
              <InfoRow label="Ativo">
                <Badge variant={device.is_active ? "default" : "secondary"}>
                  {device.is_active ? "Sim" : "Não"}
                </Badge>
              </InfoRow>
            </div>
          </div>

          {/* Playlist Section */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Playlist</h4>
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-2">
                <ListMusic className="h-4 w-4 text-muted-foreground shrink-0" />
                <Select
                  value={device.current_playlist_id || "__none__"}
                  onValueChange={handlePlaylistChange}
                  disabled={changingPlaylist}
                >
                  <SelectTrigger className="h-9 flex-1">
                    {changingPlaylist ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span className="text-sm">Atualizando...</span>
                      </div>
                    ) : (
                      <SelectValue placeholder="Selecionar playlist" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhuma playlist</SelectItem>
                    {playlists.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Location Section */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Localização</h4>
            <div className="rounded-lg border bg-card p-3 space-y-0.5">
              <InfoRow label="Loja">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  {device.store?.name || "Sem loja"}
                </div>
              </InfoRow>
              <InfoRow label="Empresa">{device.company?.name || "—"}</InfoRow>
            </div>
          </div>

          {/* Technical Section */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Técnico</h4>
            <div className="rounded-lg border bg-card p-3 space-y-0.5">
              <InfoRow label="Resolução">
                <span className="font-mono text-xs">
                  {device.resolution || device.display_profile?.resolution || "—"}
                </span>
              </InfoRow>
              <InfoRow label="Perfil de Exibição">{device.display_profile?.name || "Padrão"}</InfoRow>
              <InfoRow label="Câmera IA">
                <Badge variant={device.camera_enabled ? "default" : "secondary"}>
                  {device.camera_enabled ? "Ativa" : "Inativa"}
                </Badge>
              </InfoRow>
              <InfoRow label="Integração">
                {device.api_integration?.name
                  ? `API: ${device.api_integration.name}`
                  : device.price_check_integration?.name
                    ? `Legacy: ${device.price_check_integration.name}`
                    : "Nenhuma"}
              </InfoRow>
            </div>
          </div>

          {/* Player Link */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Link do Player</h4>
            <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
              <code className="flex-1 overflow-hidden text-ellipsis text-xs text-muted-foreground font-mono">
                /play/{device.device_code}
              </code>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={copyDeviceLink}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={openDevicePlayer}>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <Separator />

          {/* Danger Zone */}
          <Button
            variant="outline"
            className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => { onOpenChange(false); onDelete(device); }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir Dispositivo
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
