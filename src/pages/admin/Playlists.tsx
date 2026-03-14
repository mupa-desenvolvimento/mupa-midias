import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { usePlaylists, PlaylistWithChannel } from "@/hooks/usePlaylists";
import { useChannels, Channel } from "@/hooks/useChannels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, ListVideo, Edit, Trash2, Calendar, Clock, AlertTriangle, Layers, Loader2 } from "lucide-react";
import { format, parseISO, isAfter, isBefore, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageShell } from "@/components/layout/PageShell";
import { ListViewport } from "@/components/list/ListViewport";
import { ListControls } from "@/components/list/ListControls";
import { UniversalPagination } from "@/components/list/UniversalPagination";
import { useListState } from "@/hooks/useListState";

const DAYS_OF_WEEK = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

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

interface PlaylistFormProps {
  formData: PlaylistFormData;
  setFormData: React.Dispatch<React.SetStateAction<PlaylistFormData>>;
  channels: Channel[];
  onSubmit: () => void;
  submitLabel: string;
}

const PlaylistForm = ({ formData, setFormData, channels, onSubmit, submitLabel }: PlaylistFormProps) => {
  const toggleDayOfWeek = (day: number) => {
    setFormData((prev) => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter((d) => d !== day)
        : [...prev.days_of_week, day].sort(),
    }));
  };

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      <div className="space-y-2">
        <Label>Nome *</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Nome da playlist"
        />
      </div>

      <div className="space-y-2">
        <Label>Descrição</Label>
        <Textarea
          value={formData.description || ""}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Descrição da playlist"
        />
      </div>

      <div className="space-y-2">
        <Label>Canal</Label>
        <Select
          value={formData.channel_id || "none"}
          onValueChange={(v) => setFormData((prev) => ({ ...prev, channel_id: v === "none" ? null : v }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione um canal" />
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

      <div className="border rounded-lg p-4 space-y-4">
        <h4 className="font-medium flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Programação
        </h4>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Data Início</Label>
            <Input
              type="date"
              value={formData.start_date || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, start_date: e.target.value || null }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Data Fim</Label>
            <Input
              type="date"
              value={formData.end_date || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, end_date: e.target.value || null }))}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Dias da Semana</Label>
          <div className="flex flex-wrap gap-2">
            {DAYS_OF_WEEK.map((day) => (
              <label
                key={day.value}
                className={`flex items-center justify-center w-10 h-10 rounded-lg border cursor-pointer transition-colors ${
                  formData.days_of_week.includes(day.value)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-accent"
                }`}
              >
                <Checkbox
                  checked={formData.days_of_week.includes(day.value)}
                  onCheckedChange={() => toggleDayOfWeek(day.value)}
                  className="sr-only"
                />
                <span className="text-xs font-medium">{day.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Horário Início
            </Label>
            <Input
              type="time"
              value={formData.start_time}
              onChange={(e) => setFormData((prev) => ({ ...prev, start_time: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Horário Fim
            </Label>
            <Input
              type="time"
              value={formData.end_time}
              onChange={(e) => setFormData((prev) => ({ ...prev, end_time: e.target.value }))}
            />
          </div>
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
        <Label>Playlist ativa</Label>
      </div>

      <DialogFooter>
        <Button onClick={onSubmit} disabled={!formData.name}>
          {submitLabel}
        </Button>
      </DialogFooter>
    </div>
  );
};

type PlaylistStatusFilter = "all" | "active" | "inactive" | "expired" | "expiring" | "scheduled";

interface PlaylistFilters {
  status: PlaylistStatusFilter;
}

const PlaylistsPage = () => {
  const navigate = useNavigate();
  const { playlists, isLoading, updatePlaylist, deletePlaylist } = usePlaylists();
  const { channels } = useChannels();
  const [editingPlaylist, setEditingPlaylist] = useState<PlaylistWithChannel | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState<PlaylistFormData>({
    name: "",
    description: null,
    channel_id: null,
    is_active: true,
    start_date: null,
    end_date: null,
    days_of_week: [0, 1, 2, 3, 4, 5, 6],
    start_time: "00:00",
    end_time: "23:59",
    priority: 5,
  });

  const {
    state,
    setView,
    setPage,
    setPageSize,
    setSearch,
    setFilters,
    reset,
  } = useListState<PlaylistFilters>({
    initialFilters: { status: "all" },
    initialPageSize: 12,
  });

  const handleUpdate = () => {
    if (!editingPlaylist) return;

    const schedule = {
      start_date: formData.start_date,
      end_date: formData.end_date,
      days_of_week: formData.days_of_week,
      start_time: formData.start_time,
      end_time: formData.end_time,
      priority: formData.priority,
    };

    updatePlaylist.mutate(
      {
        id: editingPlaylist.id,
        name: formData.name,
        description: formData.description,
        channel_id: formData.channel_id,
        is_active: formData.is_active,
        schedule,
      },
      {
        onSuccess: () => {
          setEditingPlaylist(null);
          resetForm();
        },
      }
    );
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deletePlaylist.mutate(deleteId, {
      onSuccess: () => setDeleteId(null),
    });
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: null,
      channel_id: null,
      is_active: true,
      start_date: null,
      end_date: null,
      days_of_week: [0, 1, 2, 3, 4, 5, 6],
      start_time: "00:00",
      end_time: "23:59",
      priority: 5,
    });
  };

  const openEdit = (playlist: PlaylistWithChannel) => {
    const schedule = playlist.schedule as Record<string, unknown> | null;
    setEditingPlaylist(playlist);
    setFormData({
      name: playlist.name,
      description: playlist.description,
      channel_id: playlist.channel_id,
      is_active: playlist.is_active,
      start_date: (schedule?.start_date as string) || null,
      end_date: (schedule?.end_date as string) || null,
      days_of_week: (schedule?.days_of_week as number[]) || [0, 1, 2, 3, 4, 5, 6],
      start_time: (schedule?.start_time as string) || "00:00",
      end_time: (schedule?.end_time as string) || "23:59",
      priority: (schedule?.priority as number) || 5,
    });
  };

  const getPlaylistStatus = (playlist: PlaylistWithChannel) => {
    const schedule = playlist.schedule as Record<string, unknown> | null;
    const now = new Date();

    if (!playlist.is_active) {
      return { status: "inactive", message: "Inativa", color: "secondary" };
    }

    if (schedule?.end_date) {
      const endDate = parseISO(schedule.end_date as string);
      if (isBefore(endDate, now)) {
        return { status: "expired", message: "Expirada", color: "destructive" };
      }
      if (isBefore(endDate, addDays(now, 3))) {
        return { status: "expiring", message: "Expira em breve", color: "warning" };
      }
    }

    if (schedule?.start_date) {
      const startDate = parseISO(schedule.start_date as string);
      if (isAfter(startDate, now)) {
        return { status: "scheduled", message: "Agendada", color: "outline" };
      }
    }

    return { status: "active", message: "Ativa", color: "default" };
  };

  const filteredPlaylists = useMemo(() => {
    const term = state.search.toLowerCase().trim();
    const statusFilter = state.filters.status;

    return playlists.filter((playlist) => {
      const matchesTerm =
        !term ||
        playlist.name.toLowerCase().includes(term) ||
        playlist.channel?.name?.toLowerCase().includes(term);

      const status = getPlaylistStatus(playlist).status as PlaylistStatusFilter;
      const matchesStatus =
        statusFilter === "all" ? true : statusFilter === status;

      return matchesTerm && matchesStatus;
    });
  }, [playlists, state.search, state.filters]);

  const totalPlaylists = filteredPlaylists.length;
  const startIndex = (state.page - 1) * state.pageSize;
  const paginatedPlaylists =
    totalPlaylists === 0
      ? []
      : filteredPlaylists.slice(startIndex, startIndex + state.pageSize);

  return (
    <PageShell
      className="space-y-0"
      header={
        <div className="flex items-center justify-between gap-4 py-4">
          <p className="text-muted-foreground">
            Gerencie as playlists e programação de conteúdo
          </p>
          <Button onClick={() => navigate("/admin/playlists/new")}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Playlist
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
                  status: value as PlaylistStatusFilter,
                })
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativas</SelectItem>
                <SelectItem value="inactive">Inativas</SelectItem>
                <SelectItem value="expiring">Expiram em breve</SelectItem>
                <SelectItem value="expired">Expiradas</SelectItem>
                <SelectItem value="scheduled">Agendadas</SelectItem>
              </SelectContent>
            </Select>
          </ListControls>
        </div>
      }
      footer={
        <UniversalPagination
          page={state.page}
          pageSize={state.pageSize}
          total={totalPlaylists}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      }
    >
      <ListViewport>
        {isLoading ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Carregando...
          </div>
        ) : totalPlaylists === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <ListVideo className="h-12 w-12 opacity-40" />
            <p>Nenhuma playlist encontrada</p>
            <Button variant="outline" size="sm" onClick={() => navigate("/admin/playlists/new")}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Playlist
            </Button>
          </div>
        ) : state.view === "list" ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead>Dias</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedPlaylists.map((playlist) => {
                const status = getPlaylistStatus(playlist);
                const schedule = playlist.schedule as Record<string, unknown> | null;
                return (
                  <TableRow key={playlist.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ListVideo className="w-4 h-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{playlist.name}</p>
                          {playlist.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{playlist.description}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {playlist.channel ? (
                        <Badge variant="outline" className="text-xs">{playlist.channel.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={status.color as "default" | "secondary" | "destructive" | "outline"}
                        className={status.status === "expiring" ? "bg-yellow-500 text-white" : ""}
                      >
                        {status.message}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {schedule?.start_time ? `${schedule.start_time} - ${schedule.end_time}` : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-0.5">
                        {DAYS_OF_WEEK.map((day) => (
                          <span
                            key={day.value}
                            className={`rounded px-1 text-[10px] font-medium ${
                              (schedule?.days_of_week as number[])?.includes(day.value)
                                ? "bg-primary/20 text-primary"
                                : "text-muted-foreground/40"
                            }`}
                          >
                            {day.label[0]}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-center">
                      {(schedule?.priority as number) || 5}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/admin/playlists/${playlist.id}/edit`)} className="gap-1">
                          <Layers className="h-3.5 w-3.5" />
                          <span className="hidden xl:inline">Conteúdo</span>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(playlist)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteId(playlist.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {paginatedPlaylists.map((playlist) => {
              const status = getPlaylistStatus(playlist);
              const schedule = playlist.schedule as Record<string, unknown> | null;
              return (
                <Card key={playlist.id} className="flex flex-col">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <ListVideo className="w-5 h-5 text-primary shrink-0" />
                        <CardTitle className="text-base truncate">{playlist.name}</CardTitle>
                      </div>
                      <Badge
                        variant={status.color as "default" | "secondary" | "destructive" | "outline"}
                        className={`shrink-0 ${status.status === "expiring" ? "bg-yellow-500 text-white" : ""}`}
                      >
                        {status.message}
                      </Badge>
                    </div>
                    {playlist.description && (
                      <CardDescription className="line-clamp-2 text-xs">{playlist.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="flex-1 space-y-2 text-sm">
                    {playlist.channel && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs">Canal</span>
                        <Badge variant="outline" className="text-xs">{playlist.channel.name}</Badge>
                      </div>
                    )}
                    {schedule?.start_date && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs">Período</span>
                        <span className="text-xs">
                          {format(parseISO(schedule.start_date as string), "dd/MM/yy", { locale: ptBR })}
                          {schedule.end_date && ` – ${format(parseISO(schedule.end_date as string), "dd/MM/yy", { locale: ptBR })}`}
                        </span>
                      </div>
                    )}
                    {schedule?.start_time && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs">Horário</span>
                        <span className="text-xs">{schedule.start_time as string} – {schedule.end_time as string}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs">Dias</span>
                      <div className="flex gap-0.5">
                        {DAYS_OF_WEEK.map((day) => (
                          <span
                            key={day.value}
                            className={`rounded px-1 text-[10px] font-medium ${
                              (schedule?.days_of_week as number[])?.includes(day.value)
                                ? "bg-primary/20 text-primary"
                                : "text-muted-foreground/40"
                            }`}
                          >
                            {day.label[0]}
                          </span>
                        ))}
                      </div>
                    </div>

                    {(status.status === "expiring" || status.status === "expired") && (
                      <div className={`flex items-center gap-2 rounded p-2 text-xs ${
                        status.status === "expired" ? "bg-destructive/10 text-destructive" : "bg-yellow-500/10 text-yellow-600"
                      }`}>
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        {status.status === "expired" ? "Playlist expirada" : "Expira em breve"}
                      </div>
                    )}
                  </CardContent>
                  <div className="flex justify-end gap-1 p-3 pt-0 border-t mt-auto">
                    <Button variant="outline" size="sm" onClick={() => navigate(`/admin/playlists/${playlist.id}/edit`)} className="gap-1">
                      <Layers className="h-3.5 w-3.5" />
                      Conteúdo
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(playlist)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteId(playlist.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </ListViewport>

      <Dialog
        open={!!editingPlaylist}
        onOpenChange={(open) => !open && setEditingPlaylist(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Playlist</DialogTitle>
          </DialogHeader>
          <PlaylistForm
            formData={formData}
            setFormData={setFormData}
            channels={channels}
            onSubmit={handleUpdate}
            submitLabel="Salvar"
          />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Playlist</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta playlist? Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
};

export default PlaylistsPage;
