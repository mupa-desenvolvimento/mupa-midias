import { useState, useMemo } from "react";
import { useChannels, Channel, ChannelInsert } from "@/hooks/useChannels";
import { usePlaylists } from "@/hooks/usePlaylists";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Tv, Edit, Trash2, ListVideo, AlertTriangle, Loader2 } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { ListViewport } from "@/components/list/ListViewport";
import { ListControls } from "@/components/list/ListControls";
import { UniversalPagination } from "@/components/list/UniversalPagination";
import { useListState } from "@/hooks/useListState";

const CHANNEL_TYPES = [
  { value: "promocao", label: "Promoção" },
  { value: "institucional", label: "Institucional" },
  { value: "noticias", label: "Notícias" },
  { value: "clima", label: "Clima" },
  { value: "dicas", label: "Dicas" },
  { value: "avisos", label: "Avisos" },
  { value: "custom", label: "Personalizado" },
];

type ChannelStatusFilter = "all" | "active" | "inactive";
type ChannelTypeFilter = "all" | string;

interface ChannelFilters {
  status: ChannelStatusFilter;
  type: ChannelTypeFilter;
}

interface ChannelFormProps {
  formData: ChannelInsert;
  setFormData: React.Dispatch<React.SetStateAction<ChannelInsert>>;
  onSubmit: () => void;
  submitLabel: string;
}

const ChannelForm = ({ formData, setFormData, onSubmit, submitLabel }: ChannelFormProps) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label>Nome *</Label>
      <Input
        value={formData.name}
        onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
        placeholder="Nome da campanha"
      />
    </div>
    <div className="space-y-2">
      <Label>Descrição</Label>
      <Textarea
        value={formData.description || ""}
        onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
        placeholder="Descrição da campanha"
      />
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Tipo</Label>
        <Select value={formData.type} onValueChange={(v) => setFormData((prev) => ({ ...prev, type: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {CHANNEL_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Prioridade (1-10)</Label>
        <Input
          type="number"
          min={1}
          max={10}
          value={formData.priority}
          onChange={(e) => setFormData((prev) => ({ ...prev, priority: parseInt(e.target.value) || 5 }))}
        />
      </div>
    </div>
    <div className="flex items-center space-x-2">
      <Switch
        checked={formData.is_active}
        onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_active: checked }))}
      />
      <Label>Campanha ativa</Label>
    </div>
    <DialogFooter>
      <Button onClick={onSubmit} disabled={!formData.name}>{submitLabel}</Button>
    </DialogFooter>
  </div>
);

const ChannelsPage = () => {
  const { channels, isLoading, createChannel, updateChannel, deleteChannel } = useChannels();
  const { playlists } = usePlaylists();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState<ChannelInsert>({
    name: "",
    description: "",
    type: "custom",
    priority: 5,
    is_active: true,
  });

  const {
    state,
    setView,
    setPage,
    setPageSize,
    setSearch,
    setFilters,
    reset,
  } = useListState<ChannelFilters>({
    initialFilters: { status: "all", type: "all" },
    initialPageSize: 12,
  });

  const filteredChannels = useMemo(() => {
    const term = state.search.toLowerCase().trim();
    const statusFilter = state.filters.status;
    const typeFilter = state.filters.type;

    return channels.filter((channel) => {
      const matchesTerm =
        !term ||
        channel.name.toLowerCase().includes(term) ||
        channel.type.toLowerCase().includes(term) ||
        (channel.description || "").toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && channel.is_active) ||
        (statusFilter === "inactive" && !channel.is_active);

      const matchesType = typeFilter === "all" || channel.type === typeFilter;

      return matchesTerm && matchesStatus && matchesType;
    });
  }, [channels, state.search, state.filters]);

  const totalChannels = filteredChannels.length;
  const startIndex = (state.page - 1) * state.pageSize;
  const paginatedChannels =
    totalChannels === 0
      ? []
      : filteredChannels.slice(startIndex, startIndex + state.pageSize);

  const handleCreate = () => {
    createChannel.mutate(formData, {
      onSuccess: () => {
        setIsCreateOpen(false);
        resetForm();
      },
    });
  };

  const handleUpdate = () => {
    if (!editingChannel) return;
    updateChannel.mutate(
      { id: editingChannel.id, ...formData },
      {
        onSuccess: () => {
          setEditingChannel(null);
          resetForm();
        },
      }
    );
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteChannel.mutate(deleteId, {
      onSuccess: () => setDeleteId(null),
    });
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      type: "custom",
      priority: 5,
      is_active: true,
    });
  };

  const openEdit = (channel: Channel) => {
    setEditingChannel(channel);
    setFormData({
      name: channel.name,
      description: channel.description || "",
      type: channel.type,
      priority: channel.priority,
      is_active: channel.is_active,
    });
  };

  const getChannelPlaylists = (channelId: string) => {
    return playlists.filter((p) => p.channel_id === channelId);
  };

  const getChannelStatus = (channel: Channel) => {
    const channelPlaylists = getChannelPlaylists(channel.id);
    if (channelPlaylists.length === 0) {
      return { status: "warning", message: "Sem playlists" };
    }
    const activePlaylists = channelPlaylists.filter((p) => p.is_active);
    if (activePlaylists.length === 0) {
      return { status: "error", message: "Nenhuma playlist ativa" };
    }
    return { status: "success", message: `${activePlaylists.length} playlist(s) ativa(s)` };
  };

  const renderGridView = () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {paginatedChannels.map((channel) => {
        const status = getChannelStatus(channel);
        const playlistCount = getChannelPlaylists(channel.id).length;

        return (
          <Card key={channel.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <Tv className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">{channel.name}</CardTitle>
                </div>
                <Badge variant={channel.is_active ? "default" : "secondary"}>
                  {channel.is_active ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <CardDescription>{channel.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tipo:</span>
                <Badge variant="outline">
                  {CHANNEL_TYPES.find((t) => t.value === channel.type)?.label || channel.type}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Prioridade:</span>
                <span>{channel.priority}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <ListVideo className="w-4 h-4" />
                  Playlists:
                </span>
                <span>{playlistCount}</span>
              </div>

              {status.status !== "success" && (
                <div
                  className={`flex items-center gap-2 p-2 rounded text-sm ${
                    status.status === "error"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-yellow-500/10 text-yellow-600"
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" />
                  {status.message}
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <Button variant="ghost" size="sm" onClick={() => openEdit(channel)}>
                  <Edit className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleteId(channel.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  const renderListView = () => (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campanha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Playlists</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedChannels.map((channel) => {
              const status = getChannelStatus(channel);
              const playlistCount = getChannelPlaylists(channel.id).length;

              return (
                <TableRow key={channel.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Tv className="h-4 w-4 text-primary" />
                      <div>
                        <div>{channel.name}</div>
                        {channel.description && (
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">{channel.description}</div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {CHANNEL_TYPES.find((t) => t.value === channel.type)?.label || channel.type}
                    </Badge>
                  </TableCell>
                  <TableCell>{channel.priority}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{playlistCount}</span>
                      {status.status !== "success" && (
                        <AlertTriangle className={`w-4 h-4 ${status.status === "error" ? "text-destructive" : "text-yellow-500"}`} />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={channel.is_active ? "default" : "secondary"}>
                      {channel.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(channel)} title="Editar">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(channel.id)} title="Excluir">
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
    <PageShell
      className="animate-fade-in"
      header={
        <div className="flex items-center justify-between gap-4 py-4">
          <p className="text-muted-foreground">
            Gerencie as campanhas de conteúdo
          </p>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Campanha
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Campanha</DialogTitle>
              </DialogHeader>
              <ChannelForm formData={formData} setFormData={setFormData} onSubmit={handleCreate} submitLabel="Criar" />
            </DialogContent>
          </Dialog>
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
                setFilters({ ...state.filters, status: value as ChannelStatusFilter })
              }
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={state.filters.type}
              onValueChange={(value) =>
                setFilters({ ...state.filters, type: value })
              }
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {CHANNEL_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ListControls>
        </div>
      }
      footer={
        <UniversalPagination
          page={state.page}
          pageSize={state.pageSize}
          total={totalChannels}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      }
    >
      <ListViewport>
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : totalChannels === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Tv className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhuma campanha encontrada</h3>
              <p className="text-muted-foreground text-center">
                {state.search
                  ? "Nenhuma campanha corresponde à sua busca."
                  : "Crie sua primeira campanha para organizar conteúdo."}
              </p>
              {!state.search && (
                <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Primeira Campanha
                </Button>
              )}
            </CardContent>
          </Card>
        ) : state.view === "list" ? (
          renderListView()
        ) : (
          renderGridView()
        )}
      </ListViewport>

      {/* Edit Dialog */}
      <Dialog open={!!editingChannel} onOpenChange={(open) => !open && setEditingChannel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Campanha</DialogTitle>
          </DialogHeader>
          <ChannelForm formData={formData} setFormData={setFormData} onSubmit={handleUpdate} submitLabel="Salvar" />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Canal</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este canal? Esta ação não pode ser desfeita.
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

export default ChannelsPage;
