import { useState, useCallback, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserTenant } from "@/hooks/useUserTenant";
import { HierarchyTree, TreeNode } from "@/components/enterprise/HierarchyTree";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Plus, Monitor, Wifi, WifiOff, MapPin, Store, Building2, Layers, Box,
  Map as MapIcon, LayoutGrid, Search, Filter, Tag, Play, ChevronRight,
  Edit, Trash2, Globe, Network, TreePine, Save, X
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix leaflet default icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

type EntityType = "state" | "region" | "city" | "store" | "sector" | "zone" | "device_type" | "device";

const entityLabels: Record<EntityType, string> = {
  state: "Estado",
  region: "Região",
  city: "Cidade",
  store: "Loja",
  sector: "Setor",
  zone: "Zona",
  device_type: "Tipo de Dispositivo",
  device: "Dispositivo",
};

const entityIcons: Record<EntityType, any> = {
  state: MapPin,
  region: Globe,
  city: Building2,
  store: Store,
  sector: Layers,
  zone: Box,
  device_type: Monitor,
  device: Monitor,
};

interface StoreData {
  id: string;
  name: string;
  code: string;
  latitude?: number;
  longitude?: number;
  city_id?: string;
  is_active: boolean;
  devices_count?: number;
  online_count?: number;
}

const greenIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
const redIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
const yellowIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
const greyIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

function getMarkerIcon(store: StoreData) {
  if (!store.devices_count) return greyIcon;
  if (store.online_count === store.devices_count) return greenIcon;
  if (store.online_count && store.online_count > 0) return yellowIcon;
  return redIcon;
}

// ─── Create Entity Dialog ────────────────────────────────────
interface CreateDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entityType: EntityType;
  tenantId: string;
  onCreated: () => void;
  parentData?: {
    states: { id: string; name: string }[];
    regions: { id: string; name: string }[];
    cities: { id: string; name: string }[];
    stores: { id: string; name: string }[];
    sectors: { id: string; name: string }[];
    zones: { id: string; name: string }[];
    countries: { id: string; name: string }[];
  };
}

const CreateEntityDialog = ({ open, onOpenChange, entityType, tenantId, onCreated, parentData }: CreateDialogProps) => {
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setForm({}); }, [open]);

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.name?.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    try {
      let error: any;
      switch (entityType) {
        case "state": {
          const { error: e } = await supabase.from("states").insert({
            name: form.name, code: form.code || "", region_id: form.region_id, tenant_id: tenantId,
          });
          error = e; break;
        }
        case "region": {
          const { error: e } = await supabase.from("regions").insert({
            name: form.name, code: form.code || form.name.substring(0, 3).toUpperCase(),
            country_id: form.country_id || parentData?.countries?.[0]?.id, tenant_id: tenantId,
          });
          error = e; break;
        }
        case "city": {
          if (!form.state_id) { toast.error("Selecione um estado"); setSaving(false); return; }
          const { error: e } = await supabase.from("cities").insert({
            name: form.name, state_id: form.state_id, tenant_id: tenantId,
          });
          error = e; break;
        }
        case "store": {
          if (!form.city_id) { toast.error("Selecione uma cidade"); setSaving(false); return; }
          const { error: e } = await supabase.from("stores").insert({
            name: form.name, code: form.code || form.name.substring(0, 6).toUpperCase(),
            city_id: form.city_id, tenant_id: tenantId,
            latitude: form.latitude ? parseFloat(form.latitude) : null,
            longitude: form.longitude ? parseFloat(form.longitude) : null,
          });
          error = e; break;
        }
        case "sector": {
          if (!form.store_id) { toast.error("Selecione uma loja"); setSaving(false); return; }
          const { error: e } = await supabase.from("sectors").insert({
            name: form.name, store_id: form.store_id, tenant_id: tenantId,
          });
          error = e; break;
        }
        case "zone": {
          if (!form.sector_id) { toast.error("Selecione um setor"); setSaving(false); return; }
          const { error: e } = await supabase.from("zones").insert({
            name: form.name, sector_id: form.sector_id, tenant_id: tenantId,
          });
          error = e; break;
        }
        case "device_type": {
          const { error: e } = await supabase.from("device_types").insert({
            name: form.name, code: form.code || form.name.toUpperCase().replace(/\s/g, "_"),
            description: form.description || null, tenant_id: tenantId,
          });
          error = e; break;
        }
        case "device": {
          const { error: e } = await supabase.from("devices").insert({
            name: form.name, device_code: form.device_code || `DEV-${Date.now().toString(36).toUpperCase()}`,
            store_id: form.store_id || null, sector_id: form.sector_id || null,
            zone_id: form.zone_id || null, status: "pending",
          });
          error = e; break;
        }
      }
      if (error) throw error;
      toast.success(`${entityLabels[entityType]} criado com sucesso`);
      onCreated();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar");
    } finally {
      setSaving(false);
    }
  };

  const renderFields = () => {
    switch (entityType) {
      case "state":
        return (
          <>
            <div><Label>Nome</Label><Input value={form.name || ""} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Rio Grande do Sul" /></div>
            <div><Label>Sigla</Label><Input value={form.code || ""} onChange={(e) => set("code", e.target.value)} placeholder="Ex: RS" maxLength={2} /></div>
            <div>
              <Label>Região</Label>
              <Select value={form.region_id || ""} onValueChange={(v) => set("region_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{parentData?.regions?.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </>
        );
      case "region":
        return (
          <>
            <div><Label>Nome</Label><Input value={form.name || ""} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Sul" /></div>
            <div><Label>Código</Label><Input value={form.code || ""} onChange={(e) => set("code", e.target.value)} placeholder="Ex: SUL" /></div>
          </>
        );
      case "city":
        return (
          <>
            <div><Label>Nome</Label><Input value={form.name || ""} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Porto Alegre" /></div>
            <div>
              <Label>Estado</Label>
              <Select value={form.state_id || ""} onValueChange={(v) => set("state_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{parentData?.states?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </>
        );
      case "store":
        return (
          <>
            <div><Label>Nome</Label><Input value={form.name || ""} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Loja Centro" /></div>
            <div><Label>Código</Label><Input value={form.code || ""} onChange={(e) => set("code", e.target.value)} placeholder="Ex: LC01" /></div>
            <div>
              <Label>Cidade</Label>
              <Select value={form.city_id || ""} onValueChange={(v) => set("city_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{parentData?.cities?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Latitude</Label><Input value={form.latitude || ""} onChange={(e) => set("latitude", e.target.value)} placeholder="-29.9" /></div>
              <div><Label>Longitude</Label><Input value={form.longitude || ""} onChange={(e) => set("longitude", e.target.value)} placeholder="-51.1" /></div>
            </div>
          </>
        );
      case "sector":
        return (
          <>
            <div><Label>Nome</Label><Input value={form.name || ""} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Hortifruti" /></div>
            <div>
              <Label>Loja</Label>
              <Select value={form.store_id || ""} onValueChange={(v) => set("store_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{parentData?.stores?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </>
        );
      case "zone":
        return (
          <>
            <div><Label>Nome</Label><Input value={form.name || ""} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Entrada" /></div>
            <div>
              <Label>Setor</Label>
              <Select value={form.sector_id || ""} onValueChange={(v) => set("sector_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{parentData?.sectors?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </>
        );
      case "device_type":
        return (
          <>
            <div><Label>Nome</Label><Input value={form.name || ""} onChange={(e) => set("name", e.target.value)} placeholder="Ex: TV LED" /></div>
            <div><Label>Código</Label><Input value={form.code || ""} onChange={(e) => set("code", e.target.value)} placeholder="Ex: TV_LED" /></div>
            <div><Label>Descrição</Label><Input value={form.description || ""} onChange={(e) => set("description", e.target.value)} placeholder="Descrição opcional" /></div>
          </>
        );
      case "device":
        return (
          <>
            <div><Label>Nome</Label><Input value={form.name || ""} onChange={(e) => set("name", e.target.value)} placeholder="Ex: TV-023" /></div>
            <div><Label>Código</Label><Input value={form.device_code || ""} onChange={(e) => set("device_code", e.target.value)} placeholder="Gerado automaticamente" /></div>
            <div>
              <Label>Loja</Label>
              <Select value={form.store_id || ""} onValueChange={(v) => set("store_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{parentData?.stores?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Setor</Label>
              <Select value={form.sector_id || ""} onValueChange={(v) => set("sector_id", v)}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>{parentData?.sectors?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </>
        );
      default: return null;
    }
  };

  const Icon = entityIcons[entityType];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="w-5 h-5" />
            Novo {entityLabels[entityType]}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">{renderFields()}</div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Properties Panel ────────────────────────────────────────
const PropertiesPanel = ({ node, onRefresh }: { node: TreeNode | null; onRefresh: () => void }) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    if (node) { setName(node.name); setEditing(false); }
  }, [node]);

  if (!node) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground p-6">
        <p className="text-sm text-center">Selecione um item na árvore ou no mapa para ver suas propriedades</p>
      </div>
    );
  }

  const typeLabels: Record<string, string> = {
    company: "Empresa", state: "Estado", region: "Região", city: "Cidade",
    store: "Loja", sector: "Setor", zone: "Zona", device: "Dispositivo",
  };

  const handleSave = async () => {
    const tableMap: Record<string, string> = {
      company: "companies", state: "states", region: "regions", city: "cities",
      store: "stores", sector: "sectors", zone: "zones", device: "devices",
    };
    const table = tableMap[node.type];
    if (!table) return;
    const { error } = await supabase.from(table as any).update({ name } as any).eq("id", node.id);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Atualizado com sucesso");
    setEditing(false);
    onRefresh();
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="outline">{typeLabels[node.type]}</Badge>
          {node.type === "device" && (
            <Badge variant={node.status === "online" ? "default" : "secondary"} className="gap-1">
              {node.status === "online" ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {node.status || "offline"}
            </Badge>
          )}
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Nome</Label>
          {editing ? (
            <div className="flex gap-1 mt-1">
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" />
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSave}><Save className="w-3.5 h-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setName(node.name); setEditing(false); }}><X className="w-3.5 h-3.5" /></Button>
            </div>
          ) : (
            <p className="text-sm font-medium cursor-pointer hover:text-primary" onClick={() => setEditing(true)}>{node.name} <Edit className="w-3 h-3 inline ml-1 text-muted-foreground" /></p>
          )}
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">ID</Label>
          <p className="text-xs font-mono text-muted-foreground break-all">{node.id}</p>
        </div>

        {node.deviceCount !== undefined && node.type !== "device" && (
          <div className="grid grid-cols-2 gap-2">
            <Card><CardContent className="p-3 text-center">
              <Monitor className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-lg font-bold">{node.deviceCount}</p>
              <p className="text-[10px] text-muted-foreground">Dispositivos</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <Wifi className="w-4 h-4 mx-auto mb-1 text-green-500" />
              <p className="text-lg font-bold">-</p>
              <p className="text-[10px] text-muted-foreground">Online</p>
            </CardContent></Card>
          </div>
        )}

        {node.children && node.children.length > 0 && (
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Itens ({node.children.length})</Label>
            <div className="space-y-1">
              {node.children.slice(0, 15).map((child) => (
                <div key={child.id} className="flex items-center gap-2 p-2 rounded-md border bg-card text-xs">
                  <Monitor className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="truncate flex-1">{child.name}</span>
                  {child.type === "device" && (
                    <Badge variant={child.status === "online" ? "default" : "secondary"} className="text-[9px] h-4 px-1">{child.status || "offline"}</Badge>
                  )}
                </div>
              ))}
              {node.children.length > 15 && (
                <p className="text-[10px] text-muted-foreground text-center">+{node.children.length - 15} mais</p>
              )}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
};

// ─── Stats Bar ───────────────────────────────────────────────
const StatsBar = ({ stats }: { stats: { total: number; online: number; offline: number; stores: number; states: number } }) => (
  <div className="flex items-center gap-3 text-xs flex-wrap">
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted">
      <Monitor className="w-3.5 h-3.5" /><span className="font-semibold">{stats.total}</span><span className="text-muted-foreground">dispositivos</span>
    </div>
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-600">
      <Wifi className="w-3.5 h-3.5" /><span className="font-semibold">{stats.online}</span><span>online</span>
    </div>
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive">
      <WifiOff className="w-3.5 h-3.5" /><span className="font-semibold">{stats.offline}</span><span>offline</span>
    </div>
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted">
      <Store className="w-3.5 h-3.5" /><span className="font-semibold">{stats.stores}</span><span className="text-muted-foreground">lojas</span>
    </div>
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted">
      <MapPin className="w-3.5 h-3.5" /><span className="font-semibold">{stats.states}</span><span className="text-muted-foreground">estados</span>
    </div>
  </div>
);

// ─── Main Component ──────────────────────────────────────────
export default function EnterpriseManager() {
  const { tenantId } = useUserTenant();
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [viewMode, setViewMode] = useState<"tree" | "map">("tree");
  const [createType, setCreateType] = useState<EntityType | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [treeKey, setTreeKey] = useState(0);

  // Data for forms
  const [parentData, setParentData] = useState<any>({
    states: [], regions: [], cities: [], stores: [], sectors: [], zones: [], countries: [],
  });
  const [storesWithCoords, setStoresWithCoords] = useState<StoreData[]>([]);
  const [stats, setStats] = useState({ total: 0, online: 0, offline: 0, stores: 0, states: 0 });

  const loadParentData = useCallback(async () => {
    if (!tenantId) return;
    const [statesR, regionsR, citiesR, storesR, sectorsR, zonesR, countriesR, devicesR] = await Promise.all([
      supabase.from("states").select("id, name"),
      supabase.from("regions").select("id, name"),
      supabase.from("cities").select("id, name"),
      supabase.from("stores").select("id, name, code, latitude, longitude, city_id, is_active").eq("tenant_id", tenantId),
      supabase.from("sectors").select("id, name, store_id").eq("tenant_id", tenantId),
      supabase.from("zones").select("id, name, sector_id").eq("tenant_id", tenantId),
      supabase.from("countries").select("id, name"),
      supabase.from("devices").select("id, store_id, status"),
    ]);
    const devices = devicesR.data || [];
    const stores = storesR.data || [];

    setParentData({
      states: statesR.data || [], regions: regionsR.data || [],
      cities: citiesR.data || [], stores: stores.map((s) => ({ id: s.id, name: `${s.name} (${s.code})` })),
      sectors: sectorsR.data || [], zones: zonesR.data || [],
      countries: countriesR.data || [],
    });

    // Map data
    const storeMap = stores.filter((s) => s.latitude && s.longitude).map((s) => {
      const storeDevices = devices.filter((d) => d.store_id === s.id);
      return {
        ...s,
        devices_count: storeDevices.length,
        online_count: storeDevices.filter((d) => d.status === "online").length,
      } as StoreData;
    });
    setStoresWithCoords(storeMap);

    setStats({
      total: devices.length,
      online: devices.filter((d) => d.status === "online").length,
      offline: devices.filter((d) => d.status !== "online").length,
      stores: stores.length,
      states: (statesR.data || []).length,
    });
  }, [tenantId]);

  useEffect(() => { loadParentData(); }, [loadParentData]);

  const handleRefresh = () => {
    setTreeKey((k) => k + 1);
    loadParentData();
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Gerenciador Enterprise</h1>
          <p className="text-xs text-muted-foreground">Gerencie toda a estrutura da rede de dispositivos</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              className="pl-8 h-8 w-48 text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="hidden sm:block">
            <TabsList className="h-8">
              <TabsTrigger value="tree" className="text-xs h-6 px-2 gap-1"><TreePine className="w-3.5 h-3.5" />Árvore</TabsTrigger>
              <TabsTrigger value="map" className="text-xs h-6 px-2 gap-1"><MapIcon className="w-3.5 h-3.5" />Mapa</TabsTrigger>
            </TabsList>
          </Tabs>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1 h-8"><Plus className="w-3.5 h-3.5" />Novo</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(entityLabels) as EntityType[]).map((type) => {
                const Icon = entityIcons[type];
                return (
                  <DropdownMenuItem key={type} onClick={() => setCreateType(type)}>
                    <Icon className="w-4 h-4 mr-2" />{entityLabels[type]}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats */}
      <StatsBar stats={stats} />

      {/* Main Layout */}
      <div className="flex h-[calc(100vh-16rem)] gap-3">
        {/* Tree Sidebar */}
        <Card className="w-72 shrink-0 flex flex-col">
          <CardHeader className="py-2 px-3 border-b">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <Network className="w-3.5 h-3.5" />Hierarquia
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            <HierarchyTree key={treeKey} onSelect={setSelectedNode} />
          </CardContent>
        </Card>

        {/* Center: Map or Overview */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          {viewMode === "map" ? (
            <div className="flex-1 relative">
              <MapContainer
                center={[-14.235, -51.925]}
                zoom={4}
                className="h-full w-full rounded-b-lg"
                style={{ minHeight: "100%" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {storesWithCoords.map((store) => (
                  <Marker
                    key={store.id}
                    position={[store.latitude!, store.longitude!]}
                    icon={getMarkerIcon(store)}
                  >
                    <Popup>
                      <div className="text-xs space-y-1">
                        <p className="font-bold">{store.name}</p>
                        <p>{store.devices_count || 0} dispositivos</p>
                        <p className="text-green-600">{store.online_count || 0} online</p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          ) : (
            <CardContent className="flex-1 p-4 overflow-auto">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4" /> Visão Geral da Rede
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="border-dashed"><CardContent className="p-3 text-center">
                    <MapPin className="w-5 h-5 mx-auto mb-1 text-primary" />
                    <p className="text-2xl font-bold">{stats.states}</p>
                    <p className="text-xs text-muted-foreground">Estados</p>
                  </CardContent></Card>
                  <Card className="border-dashed"><CardContent className="p-3 text-center">
                    <Store className="w-5 h-5 mx-auto mb-1 text-primary" />
                    <p className="text-2xl font-bold">{stats.stores}</p>
                    <p className="text-xs text-muted-foreground">Lojas</p>
                  </CardContent></Card>
                  <Card className="border-dashed"><CardContent className="p-3 text-center">
                    <Monitor className="w-5 h-5 mx-auto mb-1 text-primary" />
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">Dispositivos</p>
                  </CardContent></Card>
                  <Card className="border-dashed"><CardContent className="p-3 text-center">
                    <Wifi className="w-5 h-5 mx-auto mb-1 text-green-500" />
                    <p className="text-2xl font-bold">{stats.online}</p>
                    <p className="text-xs text-muted-foreground">Online</p>
                  </CardContent></Card>
                </div>

                {/* Quick list of stores */}
                {parentData.stores?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold mb-2 text-muted-foreground">Lojas recentes</h4>
                    <div className="grid gap-1.5">
                      {parentData.stores.slice(0, 12).map((store: any) => (
                        <div key={store.id} className="flex items-center gap-2 p-2 rounded-md border bg-card hover:bg-accent/30 transition-colors text-xs">
                          <Store className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate flex-1">{store.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>

        {/* Right Properties Panel */}
        <Card className="w-64 shrink-0 flex flex-col">
          <CardHeader className="py-2 px-3 border-b">
            <CardTitle className="text-xs font-semibold">Propriedades</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            <PropertiesPanel node={selectedNode} onRefresh={handleRefresh} />
          </CardContent>
        </Card>
      </div>

      {/* Create Dialog */}
      {createType && tenantId && (
        <CreateEntityDialog
          open={!!createType}
          onOpenChange={(o) => !o && setCreateType(null)}
          entityType={createType}
          tenantId={tenantId}
          onCreated={handleRefresh}
          parentData={parentData}
        />
      )}
    </div>
  );
}
