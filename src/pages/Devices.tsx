import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Monitor,
  Plus,
  MapPin,
  Copy,
  ExternalLink,
  Camera,
  Loader2,
  Trash2,
  Pencil,
  Lock,
  Settings2,
  Image,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useDevices,
  DeviceInsert,
  DeviceUpdate,
  DeviceWithRelations,
} from "@/hooks/useDevices";
import { usePlaylists } from "@/hooks/usePlaylists";
import { formatDistanceToNow, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DeviceFormDialog } from "@/components/devices/DeviceFormDialog";
import { DeviceControlDialog } from "@/components/devices/DeviceControlDialog";
import { DeviceMonitorDialog } from "@/components/devices/DeviceMonitorDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageShell } from "@/components/layout/PageShell";
import { ListViewport } from "@/components/list/ListViewport";
import { ListControls } from "@/components/list/ListControls";
import { UniversalPagination } from "@/components/list/UniversalPagination";
import { useListState } from "@/hooks/useListState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DeviceStatusFilter = "all" | "online" | "offline" | "pending";

interface DeviceFilters {
  status: DeviceStatusFilter;
}

const Devices = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [controlDialogOpen, setControlDialogOpen] = useState(false);
  const [monitorDialogOpen, setMonitorDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<DeviceWithRelations | null>(null);
  const [controlDevice, setControlDevice] = useState<DeviceWithRelations | null>(null);
  const [monitorDevice, setMonitorDevice] = useState<DeviceWithRelations | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deviceToDelete, setDeviceToDelete] = useState<DeviceWithRelations | null>(null);
  const { toast } = useToast();
  const { devices, isLoading, createDevice, updateDevice, deleteDevice, refetch } = useDevices();
  const { playlists } = usePlaylists();

  const {
    state,
    setView,
    setPage,
    setPageSize,
    setSearch,
    setFilters,
    reset,
  } = useListState<DeviceFilters>({
    initialFilters: { status: "all" },
    initialPageSize: 12,
  });

  const getDeviceStatus = (device: DeviceWithRelations) => {
    if (device.status === "pending" && !device.last_seen_at) return "pending";

    if (!device.last_seen_at) return "offline";

    const lastSeenDate = new Date(device.last_seen_at);
    const now = new Date();
    const diffInMinutes = differenceInMinutes(now, lastSeenDate);

    return diffInMinutes < 6 ? "online" : "offline";
  };

  const filteredDevices = useMemo(() => {
    const term = state.search.toLowerCase().trim();
    const statusFilter = state.filters.status;

    return devices.filter((device) => {
      const matchesTerm =
        !term ||
        device.name.toLowerCase().includes(term) ||
        device.store?.name?.toLowerCase().includes(term) ||
        device.device_code.toLowerCase().includes(term);

      const status = getDeviceStatus(device);
      const matchesStatus = statusFilter === "all" || status === statusFilter;

      return matchesTerm && matchesStatus;
    });
  }, [devices, state.search, state.filters]);

  const totalDevices = filteredDevices.length;
  const startIndex = (state.page - 1) * state.pageSize;
  const paginatedDevices =
    totalDevices === 0
      ? []
      : filteredDevices.slice(startIndex, startIndex + state.pageSize);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online": return "bg-green-500";
      case "offline": return "bg-red-500";
      default: return "bg-yellow-500";
    }
  };

  const getStatusVariant = (status: string): "default" | "destructive" | "secondary" => {
    switch (status) {
      case "online": return "default";
      case "offline": return "destructive";
      default: return "secondary";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "online": return "Online";
      case "offline": return "Offline";
      case "pending": return "Pendente";
      default: return status;
    }
  };

  const copyDeviceLink = (deviceCode: string) => {
    const deviceUrl = `${window.location.origin}/play/${deviceCode}`;
    navigator.clipboard.writeText(deviceUrl);
    toast({
      title: "Link copiado!",
      description: "O link do dispositivo foi copiado para a área de transferência.",
    });
  };

  const openDevicePlayer = (deviceCode: string) => {
    const deviceUrl = `/play/${deviceCode}`;
    window.open(deviceUrl, '_blank');
  };

  const formatLastSeen = (lastSeen: string | null) => {
    if (!lastSeen) return "Nunca";
    return formatDistanceToNow(new Date(lastSeen), { addSuffix: true, locale: ptBR });
  };

  const handleAddDevice = () => {
    setEditingDevice(null);
    setDialogOpen(true);
  };

  const handleEditDevice = (device: DeviceWithRelations) => {
    setEditingDevice(device);
    setDialogOpen(true);
  };

  const handleDeleteClick = (device: DeviceWithRelations) => {
    setDeviceToDelete(device);
    setDeleteDialogOpen(true);
  };

  const handleOpenControl = (device: DeviceWithRelations) => {
    setControlDevice(device);
    setControlDialogOpen(true);
  };

  const handleOpenMonitor = (device: DeviceWithRelations) => {
    setMonitorDevice(device);
    setMonitorDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (deviceToDelete) {
      await deleteDevice.mutateAsync(deviceToDelete.id);
      setDeleteDialogOpen(false);
      setDeviceToDelete(null);
    }
  };

  const handleFormSubmit = async (
    data: DeviceInsert | (DeviceUpdate & { id: string })
  ) => {
    if ('id' in data && data.id) {
      const { id, ...updates } = data;
      await updateDevice.mutateAsync({ id, ...updates });
    } else {
      await createDevice.mutateAsync(data as DeviceInsert);
    }
  };

  const handleTogglePriceIntegration = async (device: DeviceWithRelations, enabled: boolean) => {
    await updateDevice.mutateAsync({ id: device.id, price_integration_enabled: enabled });
  };

  return (
    <PageShell
      className="animate-fade-in"
      header={
        <div className="flex items-center justify-between gap-4 py-4">
          <p className="text-muted-foreground">
            Gerencie todos os displays conectados
          </p>
          <Button className="gradient-primary text-white" onClick={handleAddDevice}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Dispositivo
          </Button>
        </div>
      }
      controls={
        <div className="py-2">
          <ListControls
            state={state}
            onSearchChange={setSearch}
            onViewChange={setView}
            onClearFilters={reset}
          >
            <Select
              value={state.filters.status}
              onValueChange={(value) =>
                setFilters({
                  ...state.filters,
                  status: value as DeviceStatusFilter,
                })
              }
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
              </SelectContent>
            </Select>
          </ListControls>
        </div>
      }
      footer={
        <UniversalPagination
          page={state.page}
          pageSize={state.pageSize}
          total={totalDevices}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      }
    >
      <ListViewport
        contentClassName={
          state.view === "grid"
            ? "grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            : "flex flex-col gap-4"
        }
      >
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : totalDevices === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Monitor className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-medium">
                Nenhum dispositivo encontrado
              </h3>
              <p className="max-w-md text-center text-muted-foreground">
                {state.search
                  ? "Nenhum dispositivo corresponde à sua busca."
                  : "Adicione seu primeiro dispositivo para começar a gerenciar seus displays."}
              </p>
              {!state.search && (
                <Button className="mt-4" onClick={handleAddDevice}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Primeiro Dispositivo
                </Button>
              )}
            </CardContent>
          </Card>
        ) : state.view === "list" ? (
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Visualização em lista</CardTitle>
              <CardDescription>
                Dispositivos em formato de tabela com informações-chave
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">ID</TableHead>
                    <TableHead>Dispositivo</TableHead>
                    <TableHead>Loja</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Último acesso</TableHead>
                    <TableHead>Playlist</TableHead>
                    <TableHead>Perfil</TableHead>
                      <TableHead>Integração</TableHead>
                    <TableHead>Resolução</TableHead>
                    <TableHead>Câmera IA</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedDevices.map((device) => {
                    const currentStatus = getDeviceStatus(device);
                    return (
                      <TableRow key={device.id}>
                        <TableCell className="font-mono text-xs">
                          {device.device_code}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 truncate">{device.name}</div>
                            <div className="flex items-center gap-2">
                              {device.is_blocked && (
                                <Badge variant="destructive">Bloqueado</Badge>
                              )}
                              {!device.is_blocked && device.override_media_id && (
                                <Badge variant="secondary">Mídia Avulsa</Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {device.store?.name || "Sem loja"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(currentStatus)}>
                            {getStatusLabel(currentStatus)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {formatLastSeen(device.last_seen_at)}
                        </TableCell>
                        <TableCell>
                          {device.current_playlist?.name || "Nenhuma"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {device.display_profile?.name || "Padrão"}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 truncate">
                              {device.api_integration?.name
                                ? `API: ${device.api_integration.name}`
                                : device.price_check_integration?.name
                                  ? `Legacy: ${device.price_check_integration.name}`
                                  : "Nenhuma"}
                            </div>
                            <Switch
                              checked={(device as any)?.price_integration_enabled !== false}
                              onCheckedChange={(checked) => handleTogglePriceIntegration(device, checked)}
                              disabled={updateDevice.isPending}
                              title="Ativar/Desativar integração de preço"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {device.resolution ||
                            device.display_profile?.resolution ||
                            "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              device.camera_enabled ? "default" : "secondary"
                            }
                          >
                            {device.camera_enabled ? "Ativa" : "Inativa"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {device.camera_enabled && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenMonitor(device)}
                                title="Monitoramento IA"
                              >
                                <Camera className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenControl(device)}
                              title="Controle do dispositivo"
                            >
                              <Settings2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditDevice(device)}
                              title="Editar dispositivo"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteClick(device)}
                              title="Excluir dispositivo"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          paginatedDevices.map((device) => {
            const currentStatus = getDeviceStatus(device);
            return (
              <Card
                key={device.id}
                className="transition-all duration-300 hover:shadow-lg"
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <Monitor className="h-8 w-8 text-primary" />
                        <div
                          className={`absolute -top-1 -right-1 h-3 w-3 rounded-full ${getStatusColor(
                            currentStatus
                          )}`}
                        ></div>
                        {device.camera_enabled && (
                          <Camera className="absolute -bottom-1 -left-1 h-3 w-3 text-blue-500" />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{device.name}</CardTitle>
                        <CardDescription className="flex items-center space-x-1">
                          <MapPin className="h-3 w-3" />
                          <span>{device.store?.name || "Sem loja"}</span>
                        </CardDescription>
                        <CardDescription className="mt-1 text-xs font-mono text-muted-foreground">
                          ID: {device.device_code}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {device.camera_enabled && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenMonitor(device)}
                          title="Monitoramento IA"
                          className="text-blue-500 hover:bg-blue-50 hover:text-blue-600"
                        >
                          <Camera className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenControl(device)}
                        title="Controle do dispositivo"
                      >
                        <Settings2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditDevice(device)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(device)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {device.is_blocked && (
                    <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2">
                      <Lock className="h-4 w-4 text-destructive" />
                      <span className="text-sm font-medium text-destructive">
                        Bloqueado
                      </span>
                    </div>
                  )}

                  {!device.is_blocked && device.override_media_id && (
                    <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-2">
                      <Image className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                        Mídia Avulsa Ativa
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge variant={getStatusVariant(currentStatus)}>
                      {getStatusLabel(currentStatus)}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Último acesso
                    </span>
                    <span className="text-sm">
                      {formatLastSeen(device.last_seen_at)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Resolução
                    </span>
                    <span className="text-sm font-mono">
                      {device.resolution ||
                        device.display_profile?.resolution ||
                        "-"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Playlist Atual
                    </span>
                    <span className="text-sm font-medium">
                      {device.current_playlist?.name || "Nenhuma"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Integração de Preço
                    </span>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-medium truncate">
                        {device.api_integration?.name ||
                          device.price_check_integration?.name ||
                          "Nenhuma"}
                      </span>
                      <Switch
                        checked={(device as any)?.price_integration_enabled !== false}
                        onCheckedChange={(checked) => handleTogglePriceIntegration(device, checked)}
                        disabled={updateDevice.isPending}
                        title="Ativar/Desativar integração de preço"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Câmera IA
                    </span>
                    <Badge
                      variant={device.camera_enabled ? "default" : "secondary"}
                    >
                      {device.camera_enabled ? "Ativa" : "Inativa"}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Perfil</span>
                    <span className="text-sm">
                      {device.display_profile?.name || "Padrão"}
                    </span>
                  </div>

                  <div className="border-t pt-3">
                    <div className="mb-2 text-xs text-muted-foreground">
                      Link do Player:
                    </div>
                    <div className="flex items-center space-x-2">
                      <code className="flex-1 overflow-hidden text-ellipsis rounded bg-muted p-2 text-xs">
                        /play/{device.device_code}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyDeviceLink(device.device_code)}
                        className="h-8 w-8 p-0"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDevicePlayer(device.device_code)}
                        className="h-8 w-8 p-0"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </ListViewport>

      <DeviceFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        device={editingDevice}
        onSubmit={handleFormSubmit}
        isLoading={createDevice.isPending || updateDevice.isPending}
      />

      <DeviceControlDialog
        open={controlDialogOpen}
        onOpenChange={setControlDialogOpen}
        device={controlDevice}
        onUpdate={() => refetch()}
      />

      <DeviceMonitorDialog
        open={monitorDialogOpen}
        onOpenChange={setMonitorDialogOpen}
        device={monitorDevice}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Dispositivo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o dispositivo "
              {deviceToDelete?.name}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
};

export default Devices;
