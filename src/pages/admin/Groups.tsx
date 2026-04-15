import { useState, useMemo } from "react";
import { useGroups, GroupWithDetails } from "@/hooks/useGroups";
import { useGroupDevices } from "@/hooks/useGroupDevices";
import { useDevices } from "@/hooks/useDevices";
import { usePlaylists } from "@/hooks/usePlaylists";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Folder, Edit, Trash2, Link2, ChevronRight, ChevronDown, Loader2, Monitor, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface GroupItemProps {
  group: GroupWithDetails;
  level: number;
  allGroups: GroupWithDetails[];
  onEdit: (group: GroupWithDetails) => void;
  onDelete: (id: string) => void;
  onCreateSubgroup: (parentId: string) => void;
  onLinkDevice: (groupId: string) => void;
  getDevicesForGroup: (groupId: string) => { id: string; device_id: string; device?: { id: string; name: string; device_code: string; status: string } | null }[];
  onUnlinkDevice: (groupId: string, deviceId: string) => void;
}

const GroupItem = ({ group, level, allGroups, onEdit, onDelete, onCreateSubgroup, onLinkDevice, getDevicesForGroup, onUnlinkDevice }: GroupItemProps) => {
  const [expanded, setExpanded] = useState(true);
  const children = allGroups.filter(g => g.parent_id === group.id);
  const hasChildren = children.length > 0;
  const linkedDevices = getDevicesForGroup(group.id);

  const getEffectivePlaylist = (g: GroupWithDetails): { name: string; isInherited: boolean } => {
    if (g.playlist) return { name: g.playlist.name, isInherited: false };
    if (!g.parent_id) return { name: "Nenhuma", isInherited: false };
    const parent = allGroups.find(p => p.id === g.parent_id);
    if (!parent) return { name: "Nenhuma", isInherited: false };
    const parentPlaylist = getEffectivePlaylist(parent);
    return { name: parentPlaylist.name, isInherited: true };
  };

  const { name: effectivePlaylistName, isInherited } = getEffectivePlaylist(group);

  return (
    <div className="w-full">
      <div 
        className={cn(
          "flex flex-col gap-3 p-4 rounded-xl border bg-card hover:shadow-md transition-all mb-3",
          level > 0 && "ml-4 sm:ml-8"
        )}
      >
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-[200px]">
            <button 
              onClick={() => setExpanded(!expanded)}
              className={cn(
                "p-1.5 hover:bg-accent rounded-full transition-all flex items-center justify-center", 
                !hasChildren && !linkedDevices.length && "invisible"
              )}
            >
              {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            </button>
            
            <div className="p-2 bg-muted/50 rounded-lg">
              <Folder className="w-5 h-5 text-primary shrink-0" />
            </div>
            
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-base truncate">{group.name}</span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                Playlist: <span className="font-medium text-foreground/80">{effectivePlaylistName}</span>
                {isInherited && <Badge variant="secondary" className="text-[10px] py-0 px-1 font-normal ml-1">Herdado</Badge>}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 ml-auto">
            {linkedDevices.length > 0 && (
              <Badge variant="outline" className="gap-1 text-xs">
                <Monitor className="w-3 h-3" />
                {linkedDevices.length} dispositivo{linkedDevices.length > 1 ? 's' : ''}
              </Badge>
            )}

            <Button variant="secondary" size="sm" onClick={() => onCreateSubgroup(group.id)} className="gap-2 h-9 px-4">
              <Plus className="w-4 h-4" />
              <span className="hidden md:inline font-medium">Criar subgrupo</span>
            </Button>

            <Button variant="outline" size="sm" className="gap-2 h-9 px-4" onClick={() => onLinkDevice(group.id)}>
              <Link2 className="w-4 h-4" />
              <span className="hidden md:inline font-medium">Vincular</span>
            </Button>

            <div className="flex items-center gap-1 ml-1 border-l pl-3">
              <Button variant="ghost" size="icon" onClick={() => onEdit(group)} className="h-9 w-9 hover:bg-primary/10 hover:text-primary">
                <Edit className="w-4.5 h-4.5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onDelete(group.id)} className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="w-4.5 h-4.5" />
              </Button>
            </div>
          </div>
        </div>

        {expanded && linkedDevices.length > 0 && (
          <div className="flex flex-wrap gap-2 ml-12 pt-1 border-t border-dashed">
            {linkedDevices.map(gd => (
              <div key={gd.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border text-sm">
                <Monitor className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-medium">{gd.device?.name || 'Dispositivo'}</span>
                <span className="text-xs text-muted-foreground">({gd.device?.device_code})</span>
                <Badge variant={gd.device?.status === 'active' ? 'default' : 'secondary'} className="text-[10px] py-0 px-1.5">
                  {gd.device?.status || 'pending'}
                </Badge>
                <button onClick={() => onUnlinkDevice(group.id, gd.device_id)} className="ml-1 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {expanded && hasChildren && (
        <div className="border-l-2 border-muted/20 ml-6 sm:ml-10 pl-2 sm:pl-4 transition-all">
          {children.map(child => (
            <GroupItem 
              key={child.id} 
              group={child} 
              level={level + 1} 
              allGroups={allGroups}
              onEdit={onEdit}
              onDelete={onDelete}
              onCreateSubgroup={onCreateSubgroup}
              onLinkDevice={onLinkDevice}
              getDevicesForGroup={getDevicesForGroup}
              onUnlinkDevice={onUnlinkDevice}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const GroupsPage = () => {
  const { groups, isLoading, createGroup, updateGroup, deleteGroup } = useGroups();
  const { devices } = useDevices();
  const { groupDevices, linkDevice, unlinkDevice, getDevicesForGroup } = useGroupDevices();
  const { playlists } = usePlaylists();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<GroupWithDetails | null>(null);
  const [linkGroupId, setLinkGroupId] = useState<string | null>(null);
  const [deviceSearch, setDeviceSearch] = useState("");
  
  const [formData, setFormData] = useState({
    name: "",
    parent_id: "none",
    playlist_id: "none",
    inherit_playlist: true
  });

  const rootGroups = useMemo(() => groups.filter(g => !g.parent_id), [groups]);

  // Filter devices not already linked to this group
  const availableDevices = useMemo(() => {
    if (!linkGroupId) return [];
    const linkedIds = new Set(getDevicesForGroup(linkGroupId).map(gd => gd.device_id));
    return devices.filter(d => !linkedIds.has(d.id) && d.name.toLowerCase().includes(deviceSearch.toLowerCase()));
  }, [linkGroupId, devices, groupDevices, deviceSearch]);

  const handleOpenCreate = (parentId?: string) => {
    setEditingGroup(null);
    setFormData({ name: "", parent_id: parentId || "none", playlist_id: "none", inherit_playlist: true });
    setIsDialogOpen(true);
  };

  const handleEdit = (group: GroupWithDetails) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      parent_id: group.parent_id || "none",
      playlist_id: group.playlist_id || "none",
      inherit_playlist: !group.playlist_id
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    const data = {
      name: formData.name,
      parent_id: formData.parent_id === "none" ? null : formData.parent_id,
      playlist_id: formData.inherit_playlist ? null : (formData.playlist_id === "none" ? null : formData.playlist_id)
    };

    if (editingGroup) {
      updateGroup.mutate({ id: editingGroup.id, ...data }, { onSuccess: () => setIsDialogOpen(false) });
    } else {
      createGroup.mutate(data, { onSuccess: () => setIsDialogOpen(false) });
    }
  };

  const handleLinkDevice = (deviceId: string) => {
    if (!linkGroupId) return;
    linkDevice.mutate({ groupId: linkGroupId, deviceId });
  };

  const handleUnlinkDevice = (groupId: string, deviceId: string) => {
    unlinkDevice.mutate({ groupId, deviceId });
  };

  if (isLoading) {
    return (
      <PageShell header={<div><h1 className="text-2xl font-bold">Grupos</h1><p className="text-muted-foreground text-sm">Gerencie a estrutura hierárquica de grupos e playlists</p></div>}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PageShell>
    );
  }

  const linkGroupName = linkGroupId ? groups.find(g => g.id === linkGroupId)?.name : "";

  return (
    <PageShell 
      header={
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Grupos</h1>
            <p className="text-muted-foreground text-sm">Gerencie a estrutura hierárquica de grupos e playlists</p>
          </div>
          <Button onClick={() => handleOpenCreate()} className="gap-2">
            <Plus className="w-4 h-4" />
            Criar Grupo
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {rootGroups.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center h-64 text-center">
              <Folder className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
              <h3 className="text-lg font-medium">Nenhum grupo encontrado</h3>
              <p className="text-muted-foreground mb-4">Comece criando o primeiro grupo da sua estrutura.</p>
              <Button onClick={() => handleOpenCreate()}>Criar Primeiro Grupo</Button>
            </CardContent>
          </Card>
        ) : (
          rootGroups.map(group => (
            <GroupItem 
              key={group.id} 
              group={group} 
              level={0} 
              allGroups={groups}
              onEdit={handleEdit}
              onDelete={setDeleteId}
              onCreateSubgroup={handleOpenCreate}
              onLinkDevice={id => { setLinkGroupId(id); setDeviceSearch(""); }}
              getDevicesForGroup={getDevicesForGroup}
              onUnlinkDevice={handleUnlinkDevice}
            />
          ))
        )}
      </div>

      {/* Create/Edit Group Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Editar Grupo" : "Criar Novo Grupo"}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Grupo *</Label>
              <Input id="name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Lojas Sul, Terminais de Consulta..." />
            </div>

            <div className="space-y-2">
              <Label>Grupo Pai</Label>
              <Select value={formData.parent_id} onValueChange={v => setFormData({ ...formData, parent_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione um grupo pai" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem pai (Raiz)</SelectItem>
                  {groups.filter(g => g.id !== editingGroup?.id).map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4 border rounded-lg p-4 bg-muted/10">
              <Label className="text-sm font-semibold">Configuração de Playlist</Label>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <input type="radio" id="inherit" checked={formData.inherit_playlist} onChange={() => setFormData({ ...formData, inherit_playlist: true })} />
                  <Label htmlFor="inherit" className="font-normal cursor-pointer">Herdar playlist do grupo pai</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="radio" id="custom" checked={!formData.inherit_playlist} onChange={() => setFormData({ ...formData, inherit_playlist: false })} />
                  <Label htmlFor="custom" className="font-normal cursor-pointer">Selecionar outra playlist</Label>
                </div>
              </div>
              {!formData.inherit_playlist && (
                <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <Select value={formData.playlist_id} onValueChange={v => setFormData({ ...formData, playlist_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione uma playlist" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {playlists.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!formData.name}>{editingGroup ? "Salvar Alterações" : "Criar Grupo"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Device Dialog */}
      <Dialog open={!!linkGroupId} onOpenChange={() => setLinkGroupId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Vincular Dispositivo ao Grupo "{linkGroupName}"</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar dispositivo por nome..." 
                value={deviceSearch} 
                onChange={e => setDeviceSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="max-h-[320px] overflow-y-auto space-y-1 border rounded-lg p-2">
              {availableDevices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {deviceSearch ? "Nenhum dispositivo encontrado" : "Todos os dispositivos já estão vinculados"}
                </p>
              ) : (
                availableDevices.map(device => (
                  <button
                    key={device.id}
                    onClick={() => handleLinkDevice(device.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent transition-colors text-left"
                  >
                    <Monitor className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm truncate block">{device.name}</span>
                      <span className="text-xs text-muted-foreground">{device.device_code}</span>
                    </div>
                    <Badge variant={device.status === 'active' ? 'default' : 'secondary'} className="text-[10px] py-0 px-1.5 shrink-0">
                      {device.status}
                    </Badge>
                    <Plus className="w-4 h-4 text-primary shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Grupo?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. Todos os subgrupos também serão excluídos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteGroup.mutate(deleteId, { onSuccess: () => setDeleteId(null) })} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
};

export default GroupsPage;
