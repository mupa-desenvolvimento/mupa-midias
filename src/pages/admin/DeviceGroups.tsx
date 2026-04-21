import { useState, useMemo, useCallback } from "react";
import { useDeviceGroups, DeviceGroupWithDetails, DeviceGroupInsert, DeviceGroupChannel } from "@/hooks/useDeviceGroups";
import { useChannels } from "@/hooks/useChannels";
import { useStores } from "@/hooks/useStores";
import { useDevices } from "@/hooks/useDevices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Layers, Edit, Trash2, Monitor, Tv, AlertTriangle, Link2, Loader2, Star, GripVertical, CheckSquare, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/layout/PageShell";
import { ListViewport } from "@/components/list/ListViewport";
import { ListControls } from "@/components/list/ListControls";
import { UniversalPagination } from "@/components/list/UniversalPagination";
import { useListState } from "@/hooks/useListState";
import { DeviceGroupsTree } from "@/components/devices/DeviceGroupsTree";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { DeviceAvailablePanel } from "@/components/devices/management/DeviceAvailablePanel";
import { DndContext, DragEndEvent, DragOverlay, useSensor, useSensors, PointerSensor, KeyboardSensor, defaultDropAnimationSideEffects } from "@dnd-kit/core";
import { useToast } from "@/hooks/use-toast";
import { DeviceDraggableItem } from "@/components/devices/management/DeviceDraggableItem";

const SCREEN_TYPES = [
  { value: "tv", label: "TV", icon: Tv },
  { value: "totem", label: "Totem", icon: Monitor },
  { value: "terminal", label: "Terminal", icon: Monitor },
];

type ScreenTypeFilter = "all" | "tv" | "totem" | "terminal";

interface GroupFilters {
  screenType: ScreenTypeFilter;
}

const DeviceGroupsPage = () => {
  const {
    deviceGroups,
    isLoading,
    createDeviceGroup,
    updateDeviceGroup,
    deleteDeviceGroup,
    assignChannelToGroup,
    removeChannelFromGroup,
  } = useDeviceGroups();
  const { channels } = useChannels();
  const { stores } = useStores();
  const { updateDevice } = useDevices();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<DeviceGroupWithDetails | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [channelDialogGroup, setChannelDialogGroup] = useState<DeviceGroupWithDetails | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [activeDevice, setActiveDevice] = useState<any>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const [formData, setFormData] = useState<DeviceGroupInsert>({
    name: "",
    description: null,
    store_id: null,
    screen_type: "tv",
    is_default: false,
  });

  const {
    state,
    setView,
    setPage,
    setPageSize,
    setSearch,
    setFilters,
    reset,
  } = useListState<GroupFilters>({
    initialFilters: { screenType: "all" },
    initialPageSize: 12,
  });

  const { data: groupChannels = [] } = useQuery({
    queryKey: ["device-group-channels", channelDialogGroup?.id],
    queryFn: async () => {
      if (!channelDialogGroup) return [];
      const { data, error } = await supabase
        .from("device_group_channels")
        .select(`*, channel:distribution_channels(id, name, type)`)
        .eq("group_id", channelDialogGroup.id)
        .order("position", { ascending: true });
      if (error) throw error;
      return data as DeviceGroupChannel[];
    },
    enabled: !!channelDialogGroup,
  });

  const filteredGroups = useMemo(() => {
    const term = state.search.toLowerCase().trim();
    const typeFilter = state.filters.screenType;

    return deviceGroups.filter((group) => {
      const matchesTerm =
        !term ||
        group.name.toLowerCase().includes(term) ||
        (group.description || "").toLowerCase().includes(term) ||
        (group.store?.name || "").toLowerCase().includes(term);

      const matchesType =
        typeFilter === "all" || group.screen_type === typeFilter;

      return matchesTerm && matchesType;
    });
  }, [deviceGroups, state.search, state.filters]);

  const totalGroups = filteredGroups.length;
  const startIndex = (state.page - 1) * state.pageSize;
  const paginatedGroups =
    totalGroups === 0
      ? []
      : filteredGroups.slice(startIndex, startIndex + state.pageSize);

  const handleCreate = () => {
    createDeviceGroup.mutate(formData, {
      onSuccess: () => {
        setIsCreateOpen(false);
        resetForm();
      },
    });
  };

  const handleUpdate = () => {
    if (!editingGroup) return;
    updateDeviceGroup.mutate(
      { id: editingGroup.id, ...formData },
      {
        onSuccess: () => {
          setEditingGroup(null);
          resetForm();
        },
      }
    );
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteDeviceGroup.mutate(deleteId, {
      onSuccess: () => setDeleteId(null),
    });
  };

  const handleAssignChannel = () => {
    if (!channelDialogGroup || !selectedChannelId) return;
    const position = groupChannels.length;
    assignChannelToGroup.mutate(
      { groupId: channelDialogGroup.id, channelId: selectedChannelId, position },
      {
        onSuccess: () => {
          setSelectedChannelId("");
          queryClient.invalidateQueries({ queryKey: ["device-group-channels", channelDialogGroup.id] });
        },
      }
    );
  };

  const handleRemoveChannel = (channelId: string) => {
    if (!channelDialogGroup) return;
    removeChannelFromGroup.mutate(
      { groupId: channelDialogGroup.id, channelId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["device-group-channels", channelDialogGroup.id] });
        },
      }
    );
  };

  const handleDragStart = (event: any) => {
    const { active } = event;
    if (active.data.current?.type === "device") {
      setActiveDevice(active.data.current.device);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDevice(null);

    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    if (!activeData || activeData.type !== "device") return;

    const deviceIds = selectedDeviceIds.includes(activeData.device.id)
      ? selectedDeviceIds
      : [activeData.device.id];

    try {
      if (overData?.type === "group" || overData?.type === "store-bucket") {
        const targetGroupId = overData.groupId;
        const targetStoreId = overData.storeId;

        // Update group membership for all selected devices
        for (const deviceId of deviceIds) {
          // 1. Remove from all groups (as per requirement: no duplication)
          await supabase
            .from("device_group_members")
            .delete()
            .eq("device_id", deviceId);

          // 2. Add to the target group
          await supabase
            .from("device_group_members")
            .insert({
              device_id: deviceId,
              group_id: targetGroupId,
            });

          // 3. Update device table (store_id and legacy group_id)
          const updates: any = { group_id: targetGroupId };
          if (targetStoreId && targetStoreId !== "__no_store__") {
            updates.store_id = targetStoreId;
          }
          
          await supabase
            .from("devices")
            .update(updates)
            .eq("id", deviceId);
        }

        toast({
          title: "Dispositivos movidos",
          description: `${deviceIds.length} dispositivo(s) movido(s) para o grupo com sucesso.`,
        });
      } else if (overData?.type === "available") {
        // Remove from all groups
        for (const deviceId of deviceIds) {
          await supabase
            .from("device_group_members")
            .delete()
            .eq("device_id", deviceId);
          
          await supabase
            .from("devices")
            .update({ group_id: null })
            .eq("id", deviceId);
        }

        toast({
          title: "Dispositivos removidos",
          description: `${deviceIds.length} dispositivo(s) removido(s) do grupo.`,
        });
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["device-group-members-tree"] });
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      setSelectedDeviceIds([]);
    } catch (error: any) {
      console.error("Error moving devices:", error);
      toast({
        title: "Erro ao mover dispositivos",
        description: error.message,
        variant: "destructive",
      });
    }
  };

    setFormData({
      name: "",
      description: null,
      store_id: null,
      screen_type: "tv",
      is_default: false,
    });
  };

  const openEdit = (group: DeviceGroupWithDetails) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description,
      store_id: group.store_id,
      screen_type: group.screen_type,
      is_default: group.is_default || false,
    });
  };

  const availableChannels = channels.filter(
    (c) => !groupChannels.some((gc) => gc.distribution_channel_id === c.id)
  );

  const renderGroupForm = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Nome *</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Nome do grupo"
        />
      </div>
      <div className="space-y-2">
        <Label>Descrição</Label>
        <Textarea
          value={formData.description || ""}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Descrição do grupo"
        />
      </div>
      <div className="space-y-2">
        <Label>Tipo de Tela</Label>
        <Select
          value={formData.screen_type}
          onValueChange={(v) => setFormData({ ...formData, screen_type: v })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {SCREEN_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Loja (opcional)</Label>
        <Select
          value={formData.store_id || "none"}
          onValueChange={(v) => setFormData({ ...formData, store_id: v === "none" ? null : v })}
        >
          <SelectTrigger><SelectValue placeholder="Selecione uma loja" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhuma (grupo global)</SelectItem>
            {stores.map((store) => (
              <SelectItem key={store.id} value={store.id}>
                {store.name} ({store.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center space-x-2 pt-2">
        <Checkbox
          id="is_default"
          checked={formData.is_default || false}
          onCheckedChange={(checked) => setFormData({ ...formData, is_default: !!checked })}
        />
        <Label htmlFor="is_default" className="flex items-center gap-1.5 cursor-pointer">
          <Star className="h-4 w-4 text-amber-500" />
          Grupo padrão (novos dispositivos serão atribuídos automaticamente)
        </Label>
      </div>
    </div>
  );

  const renderTreeView = () => (
    <DeviceGroupsTree
      groups={paginatedGroups}
      onEdit={openEdit}
      onDelete={(id) => setDeleteId(id)}
      onManageChannels={(group) => setChannelDialogGroup(group)}
    />
  );

  const renderListView = () => (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Grupo</TableHead>
              <TableHead>Tipo de Tela</TableHead>
              <TableHead>Loja</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedGroups.map((group) => {
              const screenType = SCREEN_TYPES.find((t) => t.value === group.screen_type);
              const ScreenIcon = screenType?.icon || Monitor;

              return (
                <TableRow key={group.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-primary" />
                      {group.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="flex items-center gap-1 w-fit">
                      <ScreenIcon className="w-3 h-3" />
                      {screenType?.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {group.store ? (
                      <Badge variant="secondary">{group.store.name}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">Global</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {group.description || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setChannelDialogGroup(group)} title="Gerenciar Campanhas">
                        <Link2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(group)} title="Editar">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(group.id)} title="Excluir">
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
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <PageShell
        className="animate-fade-in"
        header={
          <div className="flex items-center justify-between gap-4 py-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-bold tracking-tight">Gerenciamento de Grupos</h1>
              <p className="text-muted-foreground">
                Organize dispositivos e atribua campanhas de forma visual
              </p>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm} className="gradient-primary text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Grupo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Grupo</DialogTitle>
                </DialogHeader>
                {renderGroupForm()}
                <DialogFooter>
                  <Button onClick={handleCreate} disabled={!formData.name}>Criar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
        controls={
          <div className="flex flex-col gap-3 py-2">
            <ListControls
              state={state}
              onSearchChange={setSearch}
              onViewChange={setView}
              onClearFilters={reset}
            >
              <Select
                value={state.filters.screenType}
                onValueChange={(value) =>
                  setFilters({ ...state.filters, screenType: value as ScreenTypeFilter })
                }
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Tipo de Tela" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {SCREEN_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ListControls>

            {selectedDeviceIds.length > 0 && (
              <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CheckSquare className="h-4 w-4 text-primary" />
                  <span>{selectedDeviceIds.length} dispositivo(s) selecionado(s)</span>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <p className="text-xs text-muted-foreground mr-2 italic">
                    Arraste para mover para um grupo
                  </p>
                  <Button variant="ghost" size="sm" className="h-8" onClick={() => setSelectedDeviceIds([])}>
                    <X className="h-3.5 w-3.5 mr-1" />
                    Limpar
                  </Button>
                </div>
              </div>
            )}
          </div>
        }
        footer={
          <UniversalPagination
            page={state.page}
            pageSize={state.pageSize}
            total={totalGroups}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        }
      >
        <div className="h-[calc(100vh-280px)] -mx-6 -mb-6">
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
              <DeviceAvailablePanel 
                selectedIds={selectedDeviceIds}
                onSelectDevices={setSelectedDeviceIds}
              />
            </ResizablePanel>
            
            <ResizableHandle withHandle />
            
            <ResizablePanel defaultSize={80}>
              <ListViewport className="h-full p-6">
                {isLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : totalGroups === 0 ? (
                  <Card className="col-span-full">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Layers className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">Nenhum grupo encontrado</h3>
                      <p className="text-muted-foreground text-center">
                        {state.search
                          ? "Nenhum grupo corresponde à sua busca."
                          : "Crie seu primeiro grupo para organizar dispositivos."}
                      </p>
                      {!state.search && (
                        <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
                          <Plus className="mr-2 h-4 w-4" />
                          Criar Primeiro Grupo
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ) : state.view === "list" ? (
                  renderListView()
                ) : (
                  <DeviceGroupsTree
                    groups={paginatedGroups}
                    onEdit={openEdit}
                    onDelete={(id) => setDeleteId(id)}
                    onManageChannels={(group) => setChannelDialogGroup(group)}
                    selectedIds={selectedDeviceIds}
                    onToggleSelect={(id) => {
                      setSelectedDeviceIds(prev => 
                        prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
                      );
                    }}
                  />
                )}
              </ListViewport>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        <DragOverlay>
          {activeDevice ? (
            <DeviceDraggableItem 
              device={activeDevice} 
              className="w-64 opacity-80 shadow-2xl cursor-grabbing border-primary" 
            />
          ) : null}
        </DragOverlay>

      {/* Edit Dialog */}
      <Dialog open={!!editingGroup} onOpenChange={(open) => !open && setEditingGroup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Grupo</DialogTitle>
          </DialogHeader>
          {renderGroupForm()}
          <DialogFooter>
            <Button onClick={handleUpdate} disabled={!formData.name}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Channel Assignment Dialog */}
      <Dialog open={!!channelDialogGroup} onOpenChange={(open) => !open && setChannelDialogGroup(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Campanhas do Grupo: {channelDialogGroup?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione uma campanha" />
                </SelectTrigger>
                <SelectContent>
                  {availableChannels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      {channel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleAssignChannel} disabled={!selectedChannelId}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {groupChannels.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                Nenhuma campanha atribuída a este grupo
              </div>
            ) : (
              <div className="space-y-2">
                {groupChannels.map((gc, index) => (
                  <div
                    key={gc.id}
                    className="flex items-center justify-between p-2 rounded border bg-accent/30"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4">{index + 1}</span>
                      <span className="font-medium">{gc.channel?.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {gc.channel?.type}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveChannel(gc.distribution_channel_id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Grupo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este grupo? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
};

export default DeviceGroupsPage;
