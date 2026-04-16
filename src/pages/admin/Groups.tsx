import { useState, useMemo } from "react";
import { useGroups, GroupWithDetails } from "@/hooks/useGroups";
import { useGroupDevices } from "@/hooks/useGroupDevices";
import { useDevices } from "@/hooks/useDevices";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useStores } from "@/hooks/useStores";
import { useStoreInternalGroups } from "@/hooks/useStoreInternalGroups";
import { useGroupStores } from "@/hooks/useGroupStores";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Folder, Edit, Trash2, Link2, ChevronRight, ChevronDown, Loader2, Monitor, X, Search, Store, Globe, Package } from "lucide-react";
import { cn } from "@/lib/utils";

// ===== Global Group Tree Item =====
interface GroupItemProps {
  group: GroupWithDetails;
  level: number;
  allGroups: GroupWithDetails[];
  onEdit: (group: GroupWithDetails) => void;
  onDelete: (id: string) => void;
  onCreateSubgroup: (parentId: string) => void;
  onLinkDevice: (groupId: string) => void;
  onLinkInternalGroups: (groupId: string) => void;
  getDevicesForGroup: (groupId: string) => { id: string; device_id: string; device?: { id: string; name: string; device_code: string; status: string } | null }[];
  onUnlinkDevice: (groupId: string, deviceId: string) => void;
  getStoresForGroup: (groupId: string) => { id: string; store_id: string; store?: { id: string; name: string; code: string } | null }[];
  onUnlinkStore: (groupId: string, storeId: string) => void;
}

const GroupItem = ({ group, level, allGroups, onEdit, onDelete, onCreateSubgroup, onLinkDevice, onLinkInternalGroups, getDevicesForGroup, onUnlinkDevice, getStoresForGroup, onUnlinkStore }: GroupItemProps) => {
  const [expanded, setExpanded] = useState(true);
  const children = allGroups.filter(g => g.parent_id === group.id);
  const hasChildren = children.length > 0;
  const linkedDevices = getDevicesForGroup(group.id);
  const linkedStores = getStoresForGroup(group.id);

  const getEffectivePlaylist = (g: GroupWithDetails): { name: string; isInherited: boolean } => {
    if (g.playlist) return { name: g.playlist.name, isInherited: false };
    if (!g.parent_id) return { name: "Nenhuma", isInherited: false };
    const parent = allGroups.find(p => p.id === g.parent_id);
    if (!parent) return { name: "Nenhuma", isInherited: false };
    const parentPlaylist = getEffectivePlaylist(parent);
    return { name: parentPlaylist.name, isInherited: true };
  };

  const { name: effectivePlaylistName, isInherited } = getEffectivePlaylist(group);
  const hasContent = hasChildren || linkedDevices.length > 0 || linkedStores.length > 0;

  return (
    <div className="w-full">
      <div className={cn("flex flex-col gap-3 p-4 rounded-xl border bg-card hover:shadow-md transition-all mb-3", level > 0 && "ml-4 sm:ml-8")}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-[200px]">
            <button onClick={() => setExpanded(!expanded)} className={cn("p-1.5 hover:bg-accent rounded-full transition-all flex items-center justify-center", !hasContent && "invisible")}>
              {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            </button>
            <div className="p-2 bg-muted/50 rounded-lg">
              <Globe className="w-5 h-5 text-primary shrink-0" />
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
              <Badge variant="outline" className="gap-1 text-xs"><Monitor className="w-3 h-3" />{linkedDevices.length} disp.</Badge>
            )}
            {linkedStores.length > 0 && (
              <Badge variant="outline" className="gap-1 text-xs border-primary/30 text-primary"><Store className="w-3 h-3" />{linkedStores.length} loja(s)</Badge>
            )}
            <Button variant="secondary" size="sm" onClick={() => onCreateSubgroup(group.id)} className="gap-2 h-9 px-4">
              <Plus className="w-4 h-4" /><span className="hidden md:inline font-medium">Subgrupo</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-2 h-9 px-4" onClick={() => onLinkInternalGroups(group.id)}>
              <Package className="w-4 h-4" /><span className="hidden md:inline font-medium">Lojas</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-2 h-9 px-4" onClick={() => onLinkDevice(group.id)}>
              <Link2 className="w-4 h-4" /><span className="hidden md:inline font-medium">Dispositivos</span>
            </Button>
            <div className="flex items-center gap-1 ml-1 border-l pl-3">
              <Button variant="ghost" size="icon" onClick={() => onEdit(group)} className="h-9 w-9 hover:bg-primary/10 hover:text-primary"><Edit className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => onDelete(group.id)} className="h-9 w-9 text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>

        {/* Lojas vinculadas */}
        {expanded && linkedStores.length > 0 && (
          <div className="ml-12 pt-2 border-t border-dashed space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lojas vinculadas</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {linkedStores.map(ls => (
                <div key={ls.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                  <Store className="w-3.5 h-3.5 text-primary" />
                  <span className="font-medium">{ls.store?.name}</span>
                  <span className="text-xs text-muted-foreground">({ls.store?.code})</span>
                  <button onClick={() => onUnlinkStore(group.id, ls.store_id)} className="ml-1 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Direct devices */}
        {expanded && linkedDevices.length > 0 && (
          <div className="flex flex-wrap gap-2 ml-12 pt-1 border-t border-dashed">
            {linkedDevices.map(gd => (
              <div key={gd.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border text-sm">
                <Monitor className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-medium">{gd.device?.name || 'Dispositivo'}</span>
                <span className="text-xs text-muted-foreground">({gd.device?.device_code})</span>
                <Badge variant={gd.device?.status === 'active' ? 'default' : 'secondary'} className="text-[10px] py-0 px-1.5">{gd.device?.status || 'pending'}</Badge>
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
            <GroupItem key={child.id} group={child} level={level + 1} allGroups={allGroups} onEdit={onEdit} onDelete={onDelete} onCreateSubgroup={onCreateSubgroup} onLinkDevice={onLinkDevice} onLinkInternalGroups={onLinkInternalGroups} getDevicesForGroup={getDevicesForGroup} onUnlinkDevice={onUnlinkDevice} getStoresForGroup={getStoresForGroup} onUnlinkStore={onUnlinkStore} />
          ))}
        </div>
      )}
    </div>
  );
};

// ===== Main Page =====
const GroupsPage = () => {
  const { groups, isLoading, createGroup, updateGroup, deleteGroup } = useGroups();
  const { devices } = useDevices();
  const { groupDevices, linkDevice, unlinkDevice, getDevicesForGroup } = useGroupDevices();
  const { groupStores, linkStore, unlinkStore, getStoresForGroup } = useGroupStores();
  const { playlists } = usePlaylists();
  const { stores, updateStore } = useStores();
  const {
    internalGroups, createInternalGroup, updateInternalGroup, createBulkInternalGroups, deleteInternalGroup,
    linkDeviceToInternalGroup, unlinkDeviceFromInternalGroup, getDevicesForInternalGroup,
    getTargetsForGlobalGroup, getInternalGroupsForStore, addGlobalGroupTarget, removeGlobalGroupTarget,
  } = useStoreInternalGroups();

  const [activeTab, setActiveTab] = useState("global");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<GroupWithDetails | null>(null);
  const [linkGroupId, setLinkGroupId] = useState<string | null>(null);
  const [deviceSearch, setDeviceSearch] = useState("");
  const [segmentGroupId, setSegmentGroupId] = useState<string | null>(null);
  const [segmentSearch, setSegmentSearch] = useState("");
  const [segmentTab, setSegmentTab] = useState("stores");

  // Internal group bulk creation
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkName, setBulkName] = useState("");
  const [bulkSelectedStores, setBulkSelectedStores] = useState<string[]>([]);

  // Internal group device linking
  const [internalLinkGroupId, setInternalLinkGroupId] = useState<string | null>(null);
  const [internalDeviceSearch, setInternalDeviceSearch] = useState("");

  const [formData, setFormData] = useState({ name: "", parent_id: "none", playlist_id: "none", inherit_playlist: true });

  const rootGroups = useMemo(() => groups.filter(g => !g.parent_id), [groups]);

  const availableDevices = useMemo(() => {
    if (!linkGroupId && !segmentGroupId) return [];
    const targetGroupId = linkGroupId || segmentGroupId;
    const linkedIds = new Set(getDevicesForGroup(targetGroupId!).map(gd => gd.device_id));
    return devices.filter(d => !linkedIds.has(d.id) && d.name.toLowerCase().includes(segmentTab === "devices" ? segmentSearch.toLowerCase() : deviceSearch.toLowerCase()));
  }, [linkGroupId, segmentGroupId, devices, groupDevices, deviceSearch, segmentSearch, segmentTab]);

  const filteredStores = useMemo(() => {
    return stores.filter(s => s.name.toLowerCase().includes(segmentSearch.toLowerCase()) || s.code.toLowerCase().includes(segmentSearch.toLowerCase()));
  }, [stores, segmentSearch]);

  // Devices available for internal group linking (only from same store)
  const internalAvailableDevices = useMemo(() => {
    if (!internalLinkGroupId) return [];
    const ig = internalGroups.find(g => g.id === internalLinkGroupId);
    if (!ig) return [];
    const linkedIds = new Set(getDevicesForInternalGroup(internalLinkGroupId).map(d => d.device_id));
    return devices.filter(d => d.store_id === ig.store_id && !linkedIds.has(d.id) && d.name.toLowerCase().includes(internalDeviceSearch.toLowerCase()));
  }, [internalLinkGroupId, internalGroups, devices, internalDeviceSearch]);

  const handleOpenCreate = (parentId?: string) => {
    setEditingGroup(null);
    setFormData({ name: "", parent_id: parentId || "none", playlist_id: "none", inherit_playlist: true });
    setIsDialogOpen(true);
  };

  const handleEdit = (group: GroupWithDetails) => {
    setEditingGroup(group);
    setFormData({ name: group.name, parent_id: group.parent_id || "none", playlist_id: group.playlist_id || "none", inherit_playlist: !group.playlist_id });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    const data = { name: formData.name, parent_id: formData.parent_id === "none" ? null : formData.parent_id, playlist_id: formData.inherit_playlist ? null : (formData.playlist_id === "none" ? null : formData.playlist_id) };
    if (editingGroup) {
      updateGroup.mutate({ id: editingGroup.id, ...data }, { onSuccess: () => setIsDialogOpen(false) });
    } else {
      createGroup.mutate(data, { onSuccess: () => setIsDialogOpen(false) });
    }
  };

  const handleLinkDevice = (deviceId: string) => {
    const targetGroupId = linkGroupId || segmentGroupId;
    if (!targetGroupId) return;
    linkDevice.mutate({ groupId: targetGroupId, deviceId });
  };

  const handleUnlinkDevice = (groupId: string, deviceId: string) => {
    unlinkDevice.mutate({ groupId, deviceId });
  };

  // Segmentation dialog: selected stores for the global group
  const [segmentStoreSelections, setSegmentStoreSelections] = useState<Set<string>>(new Set());

  const handleOpenSegment = (groupId: string) => {
    setSegmentGroupId(groupId);
    setSegmentSearch("");
    setSegmentTab("stores");
    const existingStores = getStoresForGroup(groupId).map(gs => gs.store_id);
    setSegmentStoreSelections(new Set(existingStores));
  };

  const handleToggleStoreSegment = (storeId: string) => {
    setSegmentStoreSelections(prev => {
      const next = new Set(prev);
      if (next.has(storeId)) next.delete(storeId);
      else next.add(storeId);
      return next;
    });
  };

  const handleSaveSegments = async () => {
    if (!segmentGroupId) return;
    const existing = getStoresForGroup(segmentGroupId);
    const existingIds = new Set(existing.map(gs => gs.store_id));

    // Add new stores
    for (const id of segmentStoreSelections) {
      if (!existingIds.has(id)) {
        await linkStore.mutateAsync({ groupId: segmentGroupId, storeId: id });
      }
    }
    // Remove old stores
    for (const gs of existing) {
      if (!segmentStoreSelections.has(gs.store_id)) {
        await unlinkStore.mutateAsync({ groupId: segmentGroupId, storeId: gs.store_id });
      }
    }
    setSegmentGroupId(null);
  };

  // Stores grouped for segmentation dialog
  const storesWithInternalGroups = useMemo(() => {
    return stores.map(s => ({
      ...s,
      internalGroups: getInternalGroupsForStore(s.id),
    })).filter(s => s.internalGroups.length > 0);
  }, [stores, internalGroups]);

  if (isLoading) {
    return (
      <PageShell header={<div><h1 className="text-2xl font-bold">Grupos</h1><p className="text-muted-foreground text-sm">Gerencie grupos e setores por loja</p></div>}>
        <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      </PageShell>
    );
  }

  const linkGroupName = linkGroupId ? groups.find(g => g.id === linkGroupId)?.name : "";
  const segmentGroupName = segmentGroupId ? groups.find(g => g.id === segmentGroupId)?.name : "";

  return (
    <PageShell
      header={
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Grupos</h1>
            <p className="text-muted-foreground text-sm">Gerencie grupos e setores por loja</p>
          </div>
        </div>
      }
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="global" className="gap-2"><Globe className="w-4 h-4" />Grupos</TabsTrigger>
            <TabsTrigger value="internal" className="gap-2"><Store className="w-4 h-4" />Lojas</TabsTrigger>
          </TabsList>

          {activeTab === "global" && (
            <Button onClick={() => handleOpenCreate()} className="gap-2"><Plus className="w-4 h-4" />Criar Grupo</Button>
          )}
          {activeTab === "internal" && (
            <Button onClick={() => { setBulkDialogOpen(true); setBulkName(""); setBulkSelectedStores([]); }} className="gap-2"><Plus className="w-4 h-4" />Criar Setor</Button>
          )}
        </div>

        {/* === GLOBAL GROUPS TAB === */}
        <TabsContent value="global" className="space-y-4">
          {rootGroups.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64 text-center">
                <Globe className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
                <h3 className="text-lg font-medium">Nenhum grupo encontrado</h3>
                <p className="text-muted-foreground mb-4">Crie grupos para agrupar segmentos de lojas.</p>
                <Button onClick={() => handleOpenCreate()}>Criar Primeiro Grupo</Button>
              </CardContent>
            </Card>
          ) : (
            rootGroups.map(group => (
              <GroupItem key={group.id} group={group} level={0} allGroups={groups} onEdit={handleEdit} onDelete={setDeleteId} onCreateSubgroup={handleOpenCreate} onLinkDevice={id => { setLinkGroupId(id); setDeviceSearch(""); }} onLinkInternalGroups={handleOpenSegment} getDevicesForGroup={getDevicesForGroup} onUnlinkDevice={handleUnlinkDevice} getStoresForGroup={getStoresForGroup} onUnlinkStore={(groupId, storeId) => unlinkStore.mutate({ groupId, storeId })} />
            ))
          )}
        </TabsContent>

        {/* === INTERNAL GROUPS TAB === */}
        <TabsContent value="internal" className="space-y-4">
          {stores.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64 text-center">
                <Store className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
                <h3 className="text-lg font-medium">Nenhuma loja cadastrada</h3>
                <p className="text-muted-foreground">Cadastre lojas primeiro para criar setores.</p>
              </CardContent>
            </Card>
          ) : (
            stores.map(store => {
              const storeGroups = getInternalGroupsForStore(store.id);
              const storeDevices = devices.filter(d => d.store_id === store.id);
              
              // Get IDs of devices already in a sector
              const devicesInSectorsIds = new Set(
                storeGroups.flatMap(ig => getDevicesForInternalGroup(ig.id).map(igd => igd.device_id))
              );
              
              const ungroupedDevices = storeDevices.filter(d => !devicesInSectorsIds.has(d.id));

              return (
                <Card key={store.id} className="overflow-hidden">
                  <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Store className="w-5 h-5 text-primary" />
                      <div>
                        <span className="font-bold text-base">{store.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">({store.code})</span>
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Select 
                        value={store.playlist_id || "none"} 
                        onValueChange={(v) => updateStore(store.id, { playlist_id: v === "none" ? null : v })}
                      >
                        <SelectTrigger className="h-8 w-[180px] text-xs">
                          <SelectValue placeholder="Playlist da Loja" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem playlist (Herança)</SelectItem>
                          {playlists.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Badge variant="secondary">{storeDevices.length} disp.</Badge>
                      <Badge variant="outline">{storeGroups.length} setor(es)</Badge>
                    </div>
                  </div>
                  <CardContent className="p-4 space-y-4">
                    {/* Sectors */}
                    {storeGroups.map(ig => {
                      const igDevices = getDevicesForInternalGroup(ig.id);
                      return (
                        <div key={ig.id} className="flex flex-col gap-2 p-3 rounded-lg border bg-background">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-primary" />
                              <span className="font-semibold">{ig.name}</span>
                              <Select 
                                value={ig.playlist_id || "none"} 
                                onValueChange={(v) => updateInternalGroup.mutate({ id: ig.id, playlist_id: v === "none" ? null : v })}
                              >
                                <SelectTrigger className="h-7 w-[160px] text-[10px] ml-2">
                                  <SelectValue placeholder="Playlist do Setor" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Herdar da Loja</SelectItem>
                                  {playlists.map(p => (
                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {igDevices.length > 0 && (
                                <Badge variant="outline" className="text-xs gap-1"><Monitor className="w-3 h-3" />{igDevices.length}</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => { setInternalLinkGroupId(ig.id); setInternalDeviceSearch(""); }}>
                                <Link2 className="w-3.5 h-3.5" />Vincular
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => deleteInternalGroup.mutate(ig.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                          {igDevices.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 ml-6">
                              {igDevices.map(igd => (
                                <div key={igd.id} className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/50 border text-xs">
                                  <Monitor className="w-3 h-3 text-muted-foreground" />
                                  <span>{igd.device?.name}</span>
                                  <button onClick={() => unlinkDeviceFromInternalGroup.mutate({ internalGroupId: ig.id, deviceId: igd.device_id })} className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Ungrouped Devices */}
                    {ungroupedDevices.length > 0 && (
                      <div className="flex flex-col gap-2 p-3 rounded-lg border border-dashed bg-muted/5">
                        <div className="flex items-center gap-2">
                          <Monitor className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-muted-foreground">Dispositivos sem setor</span>
                          <Badge variant="secondary" className="text-[10px] py-0 px-1.5">{ungroupedDevices.length}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-1.5 ml-6">
                          {ungroupedDevices.map(device => (
                            <div key={device.id} className="flex items-center gap-1.5 px-2 py-1 rounded bg-background border text-xs">
                              <Monitor className="w-3 h-3 text-muted-foreground" />
                              <span>{device.name}</span>
                              <span className="text-[10px] text-muted-foreground">({device.device_code})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {storeGroups.length === 0 && ungroupedDevices.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhum setor ou dispositivo nesta loja</p>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Global Group Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingGroup ? "Editar Grupo" : "Criar Grupo"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Grupo *</Label>
              <Input id="name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Heineken, Litoral..." />
            </div>
            <div className="space-y-2">
              <Label>Grupo Pai</Label>
              <Select value={formData.parent_id} onValueChange={v => setFormData({ ...formData, parent_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem pai (Raiz)</SelectItem>
                  {groups.filter(g => g.id !== editingGroup?.id).map(g => (<SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-4 border rounded-lg p-4 bg-muted/10">
              <Label className="text-sm font-semibold">Playlist</Label>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <input type="radio" id="inherit" checked={formData.inherit_playlist} onChange={() => setFormData({ ...formData, inherit_playlist: true })} />
                  <Label htmlFor="inherit" className="font-normal cursor-pointer">Herdar do grupo pai</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="radio" id="custom" checked={!formData.inherit_playlist} onChange={() => setFormData({ ...formData, inherit_playlist: false })} />
                  <Label htmlFor="custom" className="font-normal cursor-pointer">Selecionar outra</Label>
                </div>
              </div>
              {!formData.inherit_playlist && (
                <Select value={formData.playlist_id} onValueChange={v => setFormData({ ...formData, playlist_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {playlists.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!formData.name}>{editingGroup ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Device to Global Group Dialog */}
      <Dialog open={!!linkGroupId} onOpenChange={() => setLinkGroupId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Vincular Dispositivo — "{linkGroupName}"</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar dispositivo..." value={deviceSearch} onChange={e => setDeviceSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="max-h-[320px] overflow-y-auto space-y-1 border rounded-lg p-2">
              {availableDevices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">{deviceSearch ? "Nenhum encontrado" : "Todos já vinculados"}</p>
              ) : (
                availableDevices.map(device => (
                  <button key={device.id} onClick={() => handleLinkDevice(device.id)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent transition-colors text-left">
                    <Monitor className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm truncate block">{device.name}</span>
                      <span className="text-xs text-muted-foreground">{device.device_code}</span>
                    </div>
                    <Badge variant={device.status === 'active' ? 'default' : 'secondary'} className="text-[10px] py-0 px-1.5 shrink-0">{device.status}</Badge>
                    <Plus className="w-4 h-4 text-primary shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Segmentation Dialog: link stores or devices to global group */}
      <Dialog open={!!segmentGroupId} onOpenChange={() => setSegmentGroupId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Segmentar Grupo — "{segmentGroupName}"</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder={segmentTab === "stores" ? "Buscar loja..." : "Buscar dispositivo..."} 
                value={segmentSearch} 
                onChange={e => setSegmentSearch(e.target.value)} 
                className="pl-9" 
              />
            </div>

            <Tabs value={segmentTab} onValueChange={v => setSegmentTab(v as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="stores">Lojas</TabsTrigger> 
                {/* <TabsTrigger value="devices">Dispositivos</TabsTrigger> */}
              </TabsList>
              
              <TabsContent value="stores" className="mt-4">
                <div className="max-h-[400px] overflow-y-auto space-y-1 border rounded-lg p-2">
                  {filteredStores.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhuma loja encontrada.</p>
                  ) : (
                    filteredStores.map(store => (
                      <label key={store.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent cursor-pointer transition-colors">
                        <Checkbox 
                          checked={segmentStoreSelections.has(store.id)} 
                          onCheckedChange={() => handleToggleStoreSegment(store.id)} 
                        />
                        <Store className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-sm truncate block">{store.name}</span>
                          <span className="text-xs text-muted-foreground">{store.code}</span>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="devices" className="mt-4">
                <div className="max-h-[400px] overflow-y-auto space-y-1 border rounded-lg p-2">
                  {availableDevices.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {segmentSearch ? "Nenhum dispositivo encontrado." : "Todos os dispositivos já vinculados."}
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
                        <Badge variant={device.status === 'active' ? 'default' : 'secondary'} className="text-[10px] py-0 px-1.5 shrink-0">{device.status}</Badge>
                        <Plus className="w-4 h-4 text-primary shrink-0" />
                      </button>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSegmentGroupId(null)}>Cancelar</Button>
            {segmentTab === "stores" && (
              <Button onClick={handleSaveSegments} disabled={linkStore.isPending}>Salvar Lojas</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Create Internal Group Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Criar Setor em Lojas</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome do Setor *</Label>
              <Input value={bulkName} onChange={e => setBulkName(e.target.value)} placeholder="Ex: Bebidas, Açougue, Hortifruti..." />
            </div>
            <div className="space-y-2">
              <Label>Selecione as lojas</Label>
              <div className="max-h-[250px] overflow-y-auto space-y-1 border rounded-lg p-2">
                <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer border-b mb-1 pb-2">
                  <Checkbox checked={bulkSelectedStores.length === stores.length && stores.length > 0} onCheckedChange={(checked) => {
                    setBulkSelectedStores(checked ? stores.map(s => s.id) : []);
                  }} />
                  <span className="text-sm font-semibold">Selecionar todas</span>
                </label>
                {stores.map(s => (
                  <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer transition-colors">
                    <Checkbox checked={bulkSelectedStores.includes(s.id)} onCheckedChange={(checked) => {
                      setBulkSelectedStores(prev => checked ? [...prev, s.id] : prev.filter(id => id !== s.id));
                    }} />
                    <Store className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm">{s.name}</span>
                    <span className="text-xs text-muted-foreground">({s.code})</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => {
              if (!bulkName || bulkSelectedStores.length === 0) return;
              createBulkInternalGroups.mutate({ name: bulkName, storeIds: bulkSelectedStores }, { onSuccess: () => setBulkDialogOpen(false) });
            }} disabled={!bulkName || bulkSelectedStores.length === 0 || createBulkInternalGroups.isPending}>
              Criar em {bulkSelectedStores.length} loja(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Device to Internal Group Dialog */}
      <Dialog open={!!internalLinkGroupId} onOpenChange={() => setInternalLinkGroupId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Vincular Dispositivo ao Setor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar dispositivo da loja..." value={internalDeviceSearch} onChange={e => setInternalDeviceSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="max-h-[320px] overflow-y-auto space-y-1 border rounded-lg p-2">
              {internalAvailableDevices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum dispositivo disponível nesta loja</p>
              ) : (
                internalAvailableDevices.map(device => (
                  <button key={device.id} onClick={() => linkDeviceToInternalGroup.mutate({ internalGroupId: internalLinkGroupId!, deviceId: device.id })} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent transition-colors text-left">
                    <Monitor className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm truncate block">{device.name}</span>
                      <span className="text-xs text-muted-foreground">{device.device_code}</span>
                    </div>
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
            <AlertDialogDescription>Esta ação não pode ser desfeita. Todos os subgrupos e vínculos também serão excluídos.</AlertDialogDescription>
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
