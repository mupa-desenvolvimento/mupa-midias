import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PageShell } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { HierarchyTree, type TreeNode } from "@/components/enterprise/HierarchyTree";
import FabricHierarchy from "@/components/enterprise/FabricHierarchy";
import { useUserTenant } from "@/hooks/useUserTenant";
import {
  Plus, Minus, Search, Pencil, Trash2, Monitor, Store, MapPin, Tag, Users, Info, Image, Target, Eye, Layers, Calendar, CheckCircle2, Settings2, FolderPlus, Download, Hand, Copy, Printer, RefreshCw, Play, GripVertical
} from "lucide-react";

/* ── constants ── */
const CAMPAIGN_COLORS = [
  "#22c55e", "#ef4444", "#3b82f6", "#f59e0b", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
  "#06b6d4", "#e11d48", "#a855f7", "#10b981", "#d946ef",
];

const STATUS_DOT: Record<string, string> = {
  active: "bg-green-500", draft: "bg-gray-400", paused: "bg-yellow-500", expired: "bg-red-500",
};

const PRIORITY_LABELS: Record<number, { label: string }> = {
  1: { label: "Máxima" }, 2: { label: "Alta" }, 3: { label: "Média" }, 5: { label: "Normal" }, 8: { label: "Baixa" },
};

const CAMPAIGN_TYPES = [
  { value: "paid", label: "Paga (Anunciante)" },
  { value: "regional", label: "Regional" },
  { value: "network", label: "Rede" },
  { value: "store", label: "Loja" },
  { value: "institutional", label: "Institucional" },
  { value: "fallback", label: "Fallback" },
];

const DAYS_OF_WEEK = [
  { value: 0, label: "Dom" }, { value: 1, label: "Seg" }, { value: 2, label: "Ter" },
  { value: 3, label: "Qua" }, { value: 4, label: "Qui" }, { value: 5, label: "Sex" }, { value: 6, label: "Sáb" },
];

const DEFAULT_FORM = {
  name: "", description: "", campaign_type: "institutional", priority: 5, weight: 1,
  is_active: true, start_date: "", end_date: "", start_time: "", end_time: "",
  days_of_week: [0, 1, 2, 3, 4, 5, 6] as number[],
};

/* ── View modes ── */
type ViewMode = "campaigns" | "contents" | "timeline" | "hierarchy" | "hierarchy-visual";
type SortMode = "campaign" | "name" | "type" | "position";

const ScheduleTimeline = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("contents");
  const [sortMode, setSortMode] = useState<SortMode>("campaign");

  // Group selector
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");

  // Campaign selection
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  // Campaign CRUD dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [form, setForm] = useState({ ...DEFAULT_FORM });

  // Detail dialog (contents, target, preview)
  const [detailCampaignId, setDetailCampaignId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState("contents");
  const [targetForm, setTargetForm] = useState({ target_type: "state", state_id: "", tag_id: "", sector_id: "", store_id: "", city_id: "", region_id: "", device_id: "" });
  const [addMediaId, setAddMediaId] = useState("");

  // Group CRUD dialog
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: "", description: "" });
  const [editingGroup, setEditingGroup] = useState<any>(null);

  // Add devices to group dialog
  const [addDeviceGroupId, setAddDeviceGroupId] = useState<string | null>(null);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);

  // Add content to group dialog
  const [addContentDialogOpen, setAddContentDialogOpen] = useState(false);
  const [newContentCampaignId, setNewContentCampaignId] = useState("");
  const [newContentMediaId, setNewContentMediaId] = useState("");
  const [newContentScheduled, setNewContentScheduled] = useState(false);

  // Preview lightbox
  const [previewMedia, setPreviewMedia] = useState<any>(null);
  const [previewZoom, setPreviewZoom] = useState<number>(100);
  const previewZoomMin = 50;
  const previewZoomMax = 200;
  const previewBaseWidth = 112;
  const [orderedDetailIds, setOrderedDetailIds] = useState<string[]>([]);
  const [activeDetailId, setActiveDetailId] = useState<string | null>(null);
  const [orderedPreviewIds, setOrderedPreviewIds] = useState<string[]>([]);
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);
  const [hierarchySearch, setHierarchySearch] = useState("");
  const [hierarchySelected, setHierarchySelected] = useState<TreeNode | null>(null);
  const [createType, setCreateType] = useState<string>("city");
  const [createName, setCreateName] = useState("");
  const [createCode, setCreateCode] = useState("");
  const [hierarchyRefreshKey, setHierarchyRefreshKey] = useState(0);
  const { tenantId } = useUserTenant();
  const [regionOptions, setRegionOptions] = useState<{ id: string; name: string }[]>([]);
  const [parentRegionId, setParentRegionId] = useState<string | null>(null);
  const [hierarchyMode, setHierarchyMode] = useState<"json" | "db">("json");
  const [jsonImportOpen, setJsonImportOpen] = useState(false);
  const [jsonImportText, setJsonImportText] = useState("");
  type HLDevice = { id: string; name: string; device_code?: string };
  type HLGroup = { id: string; name: string; devices: HLDevice[] };
  type HLSector = { id: string; name: string; devices: HLDevice[] };
  type HLStore = { id: string; name: string; code?: string; sectors: HLSector[]; groups: HLGroup[]; devices: HLDevice[] };
  type HLCity = { id: string; name: string; stores: HLStore[] };
  type HLRegion = { id: string; name: string; cities: HLCity[] };
  type HLState = { id: string; name: string; code?: string; regions: HLRegion[] };
  type HLModel = { states: HLState[] };
  const [hlModel, setHlModel] = useState<HLModel>(() => {
    try {
      const raw = localStorage.getItem("hierarchy:model");
      if (raw) return JSON.parse(raw);
    } catch {}
    return { states: [] };
  });
  const saveHlModel = (m: HLModel) => {
    setHlModel(m);
    try { localStorage.setItem("hierarchy:model", JSON.stringify(m)); } catch {}
  };
  const exportHlModel = () => {
    const blob = new Blob([JSON.stringify(hlModel, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hierarquia.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  const canCreateHere = useMemo(() => {
    if (!createName) return false;
    const t = createType;
    const selType = hierarchySelected?.type || null;
    if (t === "region") return selType === "company" || selType === null;
    if (t === "state") return Boolean(parentRegionId || (selType === "region"));
    if (t === "city") return selType === "state";
    if (t === "store") return selType === "city";
    if (t === "sector") return selType === "store";
    if (t === "group") return selType === "store";
    if (t === "zone") return selType === "sector";
    return false;
  }, [createType, createName, hierarchySelected]);

  useEffect(() => {
    if (createType === "state" && hierarchySelected?.type === "region") {
      setParentRegionId(hierarchySelected.id);
    }
  }, [createType, hierarchySelected]);

  useEffect(() => {
    if (viewMode !== "hierarchy" || !tenantId) return;
    (async () => {
      const { data, error } = await supabase.from("regions").select("id, name").eq("tenant_id", tenantId);
      if (!error) setRegionOptions(data || []);
    })();
  }, [viewMode, tenantId, hierarchyRefreshKey]);

  /* ── Queries ── */
  const { data: campaigns = [] } = useQuery({
    queryKey: ["schedule-campaigns"],
    queryFn: async () => {
      const { data } = await supabase
        .from("campaigns")
        .select("*, campaign_contents(id, media:media_items(id, name, type, file_url, duration), position, duration_override), campaign_targets(id, target_type, state_id, tag_id, sector_id, store_id, device_id, region_id)")
        .order("priority", { ascending: true });
      return data || [];
    },
  });

  const { data: deviceGroups = [] } = useQuery({
    queryKey: ["device-groups-schedule"],
    queryFn: async () => {
      const { data } = await supabase.from("device_groups").select("id, name, description, store_id, tenant_id").order("name");
      return data || [];
    },
  });

  const { data: groupMembers = [] } = useQuery({
    queryKey: ["group-members-schedule"],
    queryFn: async () => {
      const { data } = await supabase.from("device_group_members").select("id, group_id, device_id");
      return data || [];
    },
  });

  const { data: stores = [] } = useQuery({
    queryKey: ["stores-schedule"],
    queryFn: async () => { const { data } = await supabase.from("stores").select("id, name").order("name"); return data || []; },
  });

  const { data: storesWithHierarchy = [] } = useQuery({
    queryKey: ["stores-hierarchy-schedule"],
    queryFn: async () => {
      const { data } = await supabase.from("stores").select("id, name, city_id, cities(id, state_id, states(id, region_id))").order("name");
      return (data || []).map((s: any) => ({
        id: s.id, name: s.name, city_id: s.city_id,
        state_id: s.cities?.state_id || null,
        region_id: s.cities?.states?.region_id || null,
      }));
    },
  });

  const { data: devices = [] } = useQuery({
    queryKey: ["devices-schedule"],
    queryFn: async () => { const { data } = await supabase.from("devices").select("id, name, device_code, store_id, sector_id, group_id").eq("is_active", true).order("name").limit(500); return data || []; },
  });

  const { data: regions = [] } = useQuery({
    queryKey: ["regions-schedule"],
    queryFn: async () => { const { data } = await supabase.from("regions").select("id, name").order("name"); return data || []; },
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["tags-schedule"],
    queryFn: async () => { const { data } = await supabase.from("tags").select("id, name, slug, color").order("name"); return data || []; },
  });

  const { data: statesData = [] } = useQuery({
    queryKey: ["states-schedule"],
    queryFn: async () => { const { data } = await supabase.from("states").select("id, name, code, region_id").order("name"); return data || []; },
  });

  const { data: sectors = [] } = useQuery({
    queryKey: ["sectors-schedule"],
    queryFn: async () => { const { data } = await supabase.from("sectors").select("id, name").order("name"); return data || []; },
  });

  const { data: cities = [] } = useQuery({
    queryKey: ["cities-schedule"],
    queryFn: async () => { const { data } = await supabase.from("cities").select("id, name, state_id").order("name"); return data || []; },
  });

  const { data: mediaList = [] } = useQuery({
    queryKey: ["media-list-schedule"],
    queryFn: async () => {
      const { data } = await supabase.from("media_items").select("id, name, type, file_url, duration").eq("status", "active").order("name").limit(200);
      return data || [];
    },
  });

  // Detail queries
  const { data: detailTargets = [] } = useQuery({
    queryKey: ["detail-targets", detailCampaignId],
    queryFn: async () => {
      if (!detailCampaignId) return [];
      const { data } = await supabase.from("campaign_targets").select("*").eq("campaign_id", detailCampaignId);
      return data || [];
    },
    enabled: !!detailCampaignId,
  });

  const { data: detailContents = [] } = useQuery({
    queryKey: ["detail-contents", detailCampaignId],
    queryFn: async () => {
      if (!detailCampaignId) return [];
      const { data } = await supabase.from("campaign_contents").select("*, media:media_items(id, name, type, file_url, duration)").eq("campaign_id", detailCampaignId).order("position", { ascending: true });
      return (data || []) as any[];
    },
    enabled: !!detailCampaignId,
  });

  const { data: previewData } = useQuery({
    queryKey: ["detail-preview", detailCampaignId, detailTargets],
    queryFn: async () => {
      if (!detailCampaignId) return { devices: 0, stores: 0, states: 0 };
      if (detailTargets.length === 0) {
        const { count: dCount } = await supabase.from("devices").select("id", { count: "exact", head: true }).eq("is_active", true);
        const { count: sCount } = await supabase.from("stores").select("id", { count: "exact", head: true }).eq("is_active", true);
        return { devices: dCount || 0, stores: sCount || 0, states: 0 };
      }
      let deviceCount = 0, storeCount = 0;
      for (const t of detailTargets) {
        if (t.target_type === "store" && t.store_id) {
          const { count } = await supabase.from("devices").select("id", { count: "exact", head: true }).eq("store_id", t.store_id).eq("is_active", true);
          deviceCount += count || 0; storeCount += 1;
        } else if (t.target_type === "state" && t.state_id) {
          const { data: ct } = await supabase.from("cities").select("id").eq("state_id", t.state_id);
          const cIds = (ct || []).map((c: any) => c.id);
          if (cIds.length > 0) {
            const { data: st } = await supabase.from("stores").select("id").in("city_id", cIds).eq("is_active", true);
            const sIds = (st || []).map((s: any) => s.id);
            storeCount += sIds.length;
            if (sIds.length > 0) {
              const { count } = await supabase.from("devices").select("id", { count: "exact", head: true }).in("store_id", sIds).eq("is_active", true);
              deviceCount += count || 0;
            }
          }
        } else if (t.target_type === "sector" && t.sector_id) {
          const { count } = await supabase.from("devices").select("id", { count: "exact", head: true }).eq("sector_id", t.sector_id).eq("is_active", true);
          deviceCount += count || 0;
        }
      }
      return { devices: deviceCount, stores: storeCount, states: detailTargets.filter((t: any) => t.target_type === "state").length };
    },
    enabled: !!detailCampaignId && detailTab === "preview",
  });

  /* ── Mutations ── */
  const invalidate = () => qc.invalidateQueries({ queryKey: ["schedule-campaigns"] });
  const invalidateGroups = () => { qc.invalidateQueries({ queryKey: ["device-groups-schedule"] }); qc.invalidateQueries({ queryKey: ["group-members-schedule"] }); };

  const createCampaign = useMutation({
    mutationFn: async (c: typeof form) => {
      const { error } = await supabase.from("campaigns").insert([{
        name: c.name, description: c.description || null, campaign_type: c.campaign_type,
        priority: c.priority, weight: c.weight, is_active: c.is_active, status: "active",
        start_date: c.start_date || null, end_date: c.end_date || null,
        start_time: c.start_time || null, end_time: c.end_time || null, days_of_week: c.days_of_week,
      }]);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Campanha criada" }); closeDialog(); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateCampaign = useMutation({
    mutationFn: async ({ id, ...c }: typeof form & { id: string }) => {
      const { error } = await supabase.from("campaigns").update({
        name: c.name, description: c.description || null, campaign_type: c.campaign_type,
        priority: c.priority, weight: c.weight, is_active: c.is_active,
        start_date: c.start_date || null, end_date: c.end_date || null,
        start_time: c.start_time || null, end_time: c.end_time || null, days_of_week: c.days_of_week,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Campanha atualizada" }); closeDialog(); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("campaign_targets").delete().eq("campaign_id", id);
      await supabase.from("campaign_contents").delete().eq("campaign_id", id);
      const { error } = await supabase.from("campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Campanha excluída" }); setDetailCampaignId(null); setSelectedCampaignId(null); },
  });

  const addTarget = useMutation({
    mutationFn: async (t: { campaign_id: string; target_type: string; state_id?: string; tag_id?: string; sector_id?: string; store_id?: string; city_id?: string; region_id?: string; device_id?: string }) => {
      const { error } = await supabase.from("campaign_targets").insert([{
        campaign_id: t.campaign_id, target_type: t.target_type,
        state_id: t.target_type === "state" && t.state_id ? t.state_id : null,
        region_id: t.target_type === "region" && t.region_id ? t.region_id : null,
        city_id: t.target_type === "city" && t.city_id ? t.city_id : null,
        tag_id: t.target_type === "tag" && t.tag_id ? t.tag_id : null,
        sector_id: t.target_type === "sector" && t.sector_id ? t.sector_id : null,
        store_id: t.target_type === "store" && t.store_id ? t.store_id : null,
        device_id: t.target_type === "device" && t.device_id ? t.device_id : null,
      }]);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["detail-targets", detailCampaignId] }); toast({ title: "Segmentação adicionada" }); setTargetForm({ target_type: "state", state_id: "", tag_id: "", sector_id: "", store_id: "", city_id: "", region_id: "", device_id: "" }); },
  });

  const removeTarget = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("campaign_targets").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["detail-targets", detailCampaignId] }),
  });

  const addContent = useMutation({
    mutationFn: async ({ campaignId, mediaId }: { campaignId: string; mediaId: string }) => {
      const camp = campaigns.find((c: any) => c.id === campaignId);
      const maxPos = (camp?.campaign_contents || []).length;
      const { error } = await supabase.from("campaign_contents").insert([{ campaign_id: campaignId, media_id: mediaId, position: maxPos, is_active: true, weight: 1 }]);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["detail-contents", detailCampaignId] }); invalidate(); toast({ title: "Conteúdo adicionado" }); setAddMediaId(""); setNewContentMediaId(""); setNewContentCampaignId(""); setAddContentDialogOpen(false); },
  });

  const removeContent = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("campaign_contents").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["detail-contents", detailCampaignId] }); invalidate(); toast({ title: "Conteúdo removido" }); },
  });

  const reorderContents = useMutation({
    mutationFn: async (updates: { id: string; position: number }[]) => {
      await Promise.all(
        updates.map(u =>
          supabase.from("campaign_contents").update({ position: u.position }).eq("id", u.id)
        )
      );
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["detail-contents", detailCampaignId] }); invalidate(); toast({ title: "Ordem atualizada" }); },
    onError: (e: any) => toast({ title: "Erro ao reordenar", description: e.message, variant: "destructive" }),
  });

  // Group mutations
  const createGroup = useMutation({
    mutationFn: async (g: { name: string; description: string }) => {
      const { error } = await supabase.from("device_groups").insert([{ name: g.name, description: g.description || null }]);
      if (error) throw error;
    },
    onSuccess: () => { invalidateGroups(); toast({ title: "Grupo criado" }); setGroupDialogOpen(false); setGroupForm({ name: "", description: "" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateGroup = useMutation({
    mutationFn: async ({ id, ...g }: { id: string; name: string; description: string }) => {
      const { error } = await supabase.from("device_groups").update({ name: g.name, description: g.description || null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateGroups(); toast({ title: "Grupo atualizado" }); setGroupDialogOpen(false); setEditingGroup(null); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const addDevicesToGroup = useMutation({
    mutationFn: async ({ groupId, deviceIds }: { groupId: string; deviceIds: string[] }) => {
      const existing = groupMembers.filter(m => m.group_id === groupId).map(m => m.device_id);
      const newIds = deviceIds.filter(id => !existing.includes(id));
      const removedIds = existing.filter(id => !deviceIds.includes(id));
      if (newIds.length > 0) {
        const rows = newIds.map(id => ({ group_id: groupId, device_id: id }));
        const { error } = await supabase.from("device_group_members").insert(rows);
        if (error) throw error;
      }
      for (const id of removedIds) {
        await supabase.from("device_group_members").delete().eq("group_id", groupId).eq("device_id", id);
      }
    },
    onSuccess: () => { invalidateGroups(); toast({ title: "Dispositivos atualizados" }); setAddDeviceGroupId(null); setSelectedDeviceIds([]); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  /* ── Helpers ── */
  const closeDialog = () => { setDialogOpen(false); setEditingCampaign(null); setForm({ ...DEFAULT_FORM }); };
  const openCreate = () => { setEditingCampaign(null); setForm({ ...DEFAULT_FORM }); setDialogOpen(true); };
  const openEdit = (c: any) => {
    setEditingCampaign(c);
    setForm({
      name: c.name, description: c.description || "", campaign_type: c.campaign_type || "institutional",
      priority: c.priority || 5, weight: c.weight || 1, is_active: c.is_active ?? true,
      start_date: c.start_date || "", end_date: c.end_date || "",
      start_time: c.start_time || "", end_time: c.end_time || "",
      days_of_week: c.days_of_week || [0, 1, 2, 3, 4, 5, 6],
    });
    setDialogOpen(true);
  };
  const handleSave = () => {
    if (!form.name) return;
    if (editingCampaign) {
      updateCampaign.mutate({ id: editingCampaign.id, ...form });
    } else {
      createCampaign.mutate(form);
    }
  };
  const toggleDay = (day: number) => setForm(p => ({ ...p, days_of_week: p.days_of_week.includes(day) ? p.days_of_week.filter(d => d !== day) : [...p.days_of_week, day] }));

  const getStatus = (c: any) => {
    if (!c.is_active) return "paused";
    if (c.end_date && new Date(c.end_date) < new Date()) return "expired";
    if (c.status === "draft") return "draft";
    return "active";
  };

  const getTargetLabel = (t: any) => {
    if (t.target_type === "state") { const s = statesData.find((s: any) => s.id === t.state_id); return `Estado: ${s?.code || "?"}`; }
    if (t.target_type === "region") { const r = regions.find((r: any) => r.id === t.region_id); return `Região: ${r?.name || "?"}`; }
    if (t.target_type === "city") { const c = cities.find((c: any) => c.id === t.city_id); return `Cidade: ${c?.name || "?"}`; }
    if (t.target_type === "tag") { const tag = tags.find((tg: any) => tg.id === t.tag_id); return `Tag: ${tag?.name || "?"}`; }
    if (t.target_type === "sector") { const sec = sectors.find((s: any) => s.id === t.sector_id); return `Setor: ${sec?.name || "?"}`; }
    if (t.target_type === "store") { const st = stores.find((s: any) => s.id === t.store_id); return `Loja: ${st?.name || "?"}`; }
    if (t.target_type === "device") { const d = devices.find((d: any) => d.id === t.device_id); return `Dispositivo: ${d?.name || "?"}`; }
    return t.target_type;
  };

  // Filter campaigns
  const filteredCampaigns = useMemo(() => {
    let result = campaigns;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c: any) => c.name?.toLowerCase().includes(q));
    }
    if (selectedGroupId !== "all") {
      const devicesInGroup = groupMembers.filter(m => m.group_id === selectedGroupId).map(m => m.device_id);
      const groupDevices = devices.filter(d => devicesInGroup.includes(d.id));
      const groupStoreIds = [...new Set(groupDevices.map(d => d.store_id).filter(Boolean))] as string[];

      result = result.filter((c: any) => {
        const targets = c.campaign_targets || [];
        if (targets.length === 0) return true;
        return targets.some((t: any) => {
          if (t.target_type === "device" && devicesInGroup.includes(t.device_id)) return true;
          if (t.target_type === "store" && groupStoreIds.includes(t.store_id)) return true;
          if (t.target_type === "state") {
            return groupStoreIds.some(sid => {
              const store = storesWithHierarchy.find((s: any) => s.id === sid);
              return store && store.state_id === t.state_id;
            });
          }
          if (t.target_type === "region") {
            return groupStoreIds.some(sid => {
              const store = storesWithHierarchy.find((s: any) => s.id === sid);
              return store && store.region_id === t.region_id;
            });
          }
          if (t.target_type === "city") {
            return groupStoreIds.some(sid => {
              const store = storesWithHierarchy.find((s: any) => s.id === sid);
              return store && store.city_id === t.city_id;
            });
          }
          return false;
        });
      });
    }
    return result;
  }, [campaigns, search, selectedGroupId, groupMembers, devices, storesWithHierarchy]);

  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    campaigns.forEach((c: any, i: number) => { map[c.id] = CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length]; });
    return map;
  }, [campaigns]);

  // All contents from filtered campaigns, flattened
  const allContents = useMemo(() => {
    const items: { content: any; campaign: any; color: string }[] = [];
    filteredCampaigns.forEach((c: any) => {
      const contents = c.campaign_contents || [];
      const color = colorMap[c.id] || "#888";
      contents
        .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
        .forEach((content: any) => {
          if (content.media) {
            items.push({ content, campaign: c, color });
          }
        });
    });
    // Apply sorting
    if (sortMode === "name") {
      items.sort((a, b) => (a.content.media?.name || "").localeCompare(b.content.media?.name || ""));
    } else if (sortMode === "type") {
      items.sort((a, b) => (a.content.media?.type || "").localeCompare(b.content.media?.type || ""));
    } else if (sortMode === "position") {
      items.sort((a, b) => (a.content.position || 0) - (b.content.position || 0));
    }
    // "campaign" = default grouped order (no extra sort needed)
    return items;
  }, [filteredCampaigns, colorMap, sortMode]);

  const detailCampaign = campaigns.find((c: any) => c.id === detailCampaignId);
  const selectedGroupName = selectedGroupId === "all" ? "TODOS" : deviceGroups.find((g: any) => g.id === selectedGroupId)?.name || "GRUPO";
  const devicesInSelectedGroup = selectedGroupId === "all" ? [] : groupMembers.filter(m => m.group_id === selectedGroupId).map(m => m.device_id);
  const orderedDetailContents = useMemo(() => {
    if (orderedDetailIds.length === 0) return detailContents;
    const byId = new Map(detailContents.map((c: any) => [c.id, c]));
    return orderedDetailIds.map(id => byId.get(id)).filter(Boolean);
  }, [detailContents, orderedDetailIds]);

  useEffect(() => {
    setOrderedDetailIds(detailContents.map((c: any) => c.id));
  }, [detailContents]);
  useEffect(() => {
    setOrderedPreviewIds(allContents.map((i) => i.content.id));
  }, [allContents]);

  const detailDndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const previewDndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDetailDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDetailId(null);
    if (!over || String(active.id) === String(over.id)) return;
    const oldIndex = orderedDetailIds.indexOf(String(active.id));
    const newIndex = orderedDetailIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const nextIds = arrayMove(orderedDetailIds, oldIndex, newIndex);
    setOrderedDetailIds(nextIds);
    reorderContents.mutate(nextIds.map((id, idx) => ({ id, position: idx })));
  };

  const SortableContentCard = ({ item }: { item: any }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
    const isImg = item.media?.type === "image" || item.media?.file_url?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.6 : 1,
    };

    return (
      <div ref={setNodeRef} style={style} className="relative group">
        <div className="absolute left-1 top-1 z-10">
          <button
            className="h-7 w-7 rounded-md bg-background/80 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
            {...attributes}
            {...listeners}
            title="Arraste para reordenar"
            type="button"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </div>
        <div className={`aspect-video rounded-lg overflow-hidden bg-muted border ${isDragging ? "border-primary ring-2 ring-primary/20" : "border-border"}`}>
          {isImg && item.media?.file_url ? (
            <img src={item.media.file_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><Image className="h-6 w-6 text-muted-foreground" /></div>
          )}
        </div>
        <p className="text-xs font-medium truncate mt-1">{item.media?.name || "Mídia"}</p>
        <p className="text-[10px] text-muted-foreground">{item.media?.type} · {item.duration_override || item.media?.duration || 10}s</p>
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1 right-1 h-7 w-7 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
          onClick={() => removeContent.mutate(item.id)}
          type="button"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  };
  const previewById = useMemo(() => {
    const map = new Map<string, { content: any; campaign: any; color: string }>();
    allContents.forEach((i) => map.set(i.content.id, i));
    return map;
  }, [allContents]);
  const SortablePreviewItem = ({ id, item, width, onClick }: { id: string; item: { content: any; campaign: any; color: string }; width: number; onClick: () => void }) => {
    const media = item.content.media;
    const isImage = media.type === "image" || media.file_url?.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      width: `${width}px`,
      opacity: isDragging ? 0.7 : 1,
    };
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="shrink-0 cursor-pointer relative"
        onClick={onClick}
      >
        <button
          className="absolute left-1 top-1 z-10 h-6 w-6 rounded bg-background/80 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
          title="Arraste para reordenar"
          type="button"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <div className={`relative aspect-video rounded overflow-hidden bg-muted border ${isDragging ? "border-primary ring-2 ring-primary/20" : "border-border"}`}>
          {isImage && media.file_url ? (
            <img src={media.file_url} alt={media.name} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-black/60">
              <Play className="h-4 w-4 text-white/70" />
            </div>
          )}
        </div>
        <p className="text-[9px] truncate mt-1 font-medium">{media.name}</p>
        <div className="rounded px-1.5 py-0.5 text-[8px] font-bold text-white truncate text-center uppercase mt-0.5" style={{ backgroundColor: item.color }}>
          {item.campaign.name}
        </div>
      </div>
    );
  };
  const onPreviewDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActivePreviewId(null);
    if (!over || String(active.id) === String(over.id)) return;
    const a = previewById.get(String(active.id));
    const b = previewById.get(String(over.id));
    if (!a || !b) return;
    if (a.campaign.id !== b.campaign.id) {
      toast({ title: "Só é possível reordenar dentro da mesma campanha" });
      return;
    }
    const campaignId = a.campaign.id;
    const indices = orderedPreviewIds
      .map((id, idx) => ({ id, idx }))
      .filter(({ id }) => previewById.get(id)?.campaign.id === campaignId);
    const fromPos = indices.find((x) => x.id === String(active.id))?.idx;
    const toPos = indices.find((x) => x.id === String(over.id))?.idx;
    if (fromPos === undefined || toPos === undefined) return;
    const next = arrayMove(orderedPreviewIds, fromPos, toPos);
    setOrderedPreviewIds(next);
    const orderedCampaignIds = next.filter((id) => previewById.get(id)?.campaign.id === campaignId);
    reorderContents.mutate(orderedCampaignIds.map((id, position) => ({ id, position })));
  };

  return (
    <PageShell header={
      <div className="flex items-center justify-between w-full">
        <div>
          <h1 className="text-2xl font-bold">Programações</h1>
          <p className="text-sm text-muted-foreground">Gerencie campanhas, conteúdos e segmentações</p>
        </div>
      </div>
    }>
      {/* ═══ Top bar: Group selector + actions ═══ */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
            <SelectTrigger className="w-52 font-semibold"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os grupos</SelectItem>
              {deviceGroups.map((g: any) => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setEditingGroup(null); setGroupForm({ name: "", description: "" }); setGroupDialogOpen(true); }}>
          <FolderPlus className="h-4 w-4" /> Novo Grupo
        </Button>

        {selectedGroupId !== "all" && (
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
              const g = deviceGroups.find((g: any) => g.id === selectedGroupId);
              if (g) { setEditingGroup(g); setGroupForm({ name: g.name, description: g.description || "" }); setGroupDialogOpen(true); }
            }}>
              <Pencil className="h-3.5 w-3.5" /> Atualizar grupo
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setAddDeviceGroupId(selectedGroupId); setSelectedDeviceIds(devicesInSelectedGroup); }}>
              <Plus className="h-3.5 w-3.5" /> Dispositivos
            </Button>
            <Badge variant="secondary" className="text-xs">{devicesInSelectedGroup.length} dispositivo(s)</Badge>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-48" />
          </div>
        </div>
      </div>

      {/* ═══ View tabs ═══ */}
      <div className="flex items-center gap-1 mb-4 border-b border-border pb-2">
        <Button variant={viewMode === "contents" ? "default" : "ghost"} size="sm" className="gap-1.5" onClick={() => setViewMode("contents")}>
          <Layers className="h-4 w-4" /> Conteúdos
        </Button>
        <Button variant={viewMode === "campaigns" ? "default" : "ghost"} size="sm" className="gap-1.5" onClick={() => setViewMode("campaigns")}>
          <Target className="h-4 w-4" /> Campanhas
        </Button>
        <Button variant={viewMode === "timeline" ? "default" : "ghost"} size="sm" className="gap-1.5" onClick={() => setViewMode("timeline")}>
          <Calendar className="h-4 w-4" /> Timeline
        </Button>
        <Button variant={viewMode === "hierarchy" ? "default" : "ghost"} size="sm" className="gap-1.5" onClick={() => setViewMode("hierarchy")}>
          <Layers className="h-4 w-4" /> Hierarquia
        </Button>
        <Button variant={viewMode === "hierarchy-visual" ? "default" : "ghost"} size="sm" className="gap-1.5" onClick={() => setViewMode("hierarchy-visual")}>
          <Layers className="h-4 w-4" /> Hierarquia Visual
        </Button>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAddContentDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Adicionar conteúdo
          </Button>
          <Button className="gap-1.5" size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Nova campanha
          </Button>
        </div>
      </div>

      {/* ═══ GROUP HEADER BAR (when a group is selected) ═══ */}
      {selectedGroupId !== "all" && (
        <div className="flex items-center gap-3 px-4 py-3 mb-4 rounded-lg border-2 border-primary/20 bg-primary/5">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="font-bold text-sm uppercase tracking-wider">{selectedGroupName}</span>
          <div className="flex items-center gap-2 ml-2 px-3 py-1 rounded-md bg-primary/10 border border-primary/20">
            <Monitor className="h-4 w-4 text-primary" />
            <span className="text-lg font-bold text-primary">{devicesInSelectedGroup.length}</span>
            <span className="text-xs text-muted-foreground">dispositivo(s)</span>
          </div>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => {
              const g = deviceGroups.find((g: any) => g.id === selectedGroupId);
              if (g) { setEditingGroup(g); setGroupForm({ name: g.name, description: g.description || "" }); setGroupDialogOpen(true); }
            }}>
              <Pencil className="h-3.5 w-3.5" /> Editar grupo
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setAddDeviceGroupId(selectedGroupId); setSelectedDeviceIds(devicesInSelectedGroup); }}>
              <Plus className="h-3.5 w-3.5" /> Dispositivos
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => setAddContentDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Adicionar conteúdo
            </Button>
          </div>
        </div>
      )}

      {/* ═══ VIEW: CONTENTS ═══ */}
      {viewMode === "contents" && (
        <div className="flex flex-col" style={{ height: "calc(100vh - 20rem)" }}>
          {/* Sort controls & summary */}
          <div className="flex items-center justify-between mb-2 shrink-0">
            <span className="text-sm text-muted-foreground">{allContents.length} conteúdo(s) de {filteredCampaigns.length} campanha(s)</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Ordenar:</span>
              <Select value={sortMode} onValueChange={v => setSortMode(v as SortMode)}>
                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="campaign">Por campanha</SelectItem>
                  <SelectItem value="name">Por nome</SelectItem>
                  <SelectItem value="type">Por tipo</SelectItem>
                  <SelectItem value="position">Por posição</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Campaign list — scrollable, takes remaining space */}
          <div className="flex-1 min-h-0 border border-border rounded-lg bg-card overflow-hidden">
            <ScrollArea className="h-full">
              {filteredCampaigns.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma campanha encontrada</p>
              ) : (
                <div className="divide-y divide-border">
                  {filteredCampaigns.map((c: any) => {
                    const status = getStatus(c);
                    const color = colorMap[c.id] || "#888";
                    const contentsCount = (c.campaign_contents || []).length;
                    const pri = PRIORITY_LABELS[c.priority] || { label: `P${c.priority}` };
                    const typeLabel = CAMPAIGN_TYPES.find(t => t.value === c.campaign_type)?.label || c.campaign_type;
                    const isSelected = selectedCampaignId === c.id;

                    return (
                      <div
                        key={c.id}
                        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${isSelected ? "bg-accent/60" : "hover:bg-accent/30"}`}
                        style={{ borderLeft: `4px solid ${color}` }}
                        onClick={() => setSelectedCampaignId(isSelected ? null : c.id)}
                      >
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[status]}`} />
                        <Monitor className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="flex-1 text-sm font-medium truncate">{c.name}</span>

                        <Badge variant="outline" className="text-[10px] hidden lg:inline-flex">{typeLabel}</Badge>
                        <Badge variant="secondary" className="text-[10px] hidden md:inline-flex">{pri.label}</Badge>

                        {c.start_date && (
                          <span className="text-[10px] text-muted-foreground font-mono hidden md:inline">
                            {new Date(c.start_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                            {c.end_date && ` → ${new Date(c.end_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`}
                          </span>
                        )}

                        <Tooltip><TooltipTrigger asChild><button className="p-1 rounded hover:bg-muted"><Settings2 className="h-3.5 w-3.5 text-muted-foreground" /></button></TooltipTrigger><TooltipContent>Configurações</TooltipContent></Tooltip>
                        <Tooltip><TooltipTrigger asChild><button className="p-1 rounded hover:bg-muted"><Info className="h-3.5 w-3.5 text-muted-foreground" /></button></TooltipTrigger><TooltipContent>Info</TooltipContent></Tooltip>

                        <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={(e) => { e.stopPropagation(); openEdit(c); }}>
                          Editar <Settings2 className="h-3 w-3" />
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1 text-xs h-7 text-primary" onClick={(e) => { e.stopPropagation(); setDetailCampaignId(c.id); setDetailTab("contents"); }}>
                          Adicionar <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* PREVIEW strip — fixed at bottom */}
          <div className="shrink-0 mt-3">
            <div className="flex items-center gap-3 mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preview — Sequência de exibição</p>
              <div className="flex items-center gap-2 ml-auto">
                <div className="flex items-center gap-1">
                  <button
                    className="text-muted-foreground hover:text-foreground p-1 rounded"
                    onClick={() => setPreviewZoom((z) => Math.max(previewZoomMin, z - 10))}
                    title="Diminuir zoom"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <Slider
                    value={[previewZoom]}
                    onValueChange={(v) => setPreviewZoom(v[0])}
                    min={previewZoomMin}
                    max={previewZoomMax}
                    step={10}
                    className="w-28"
                  />
                  <button
                    className="text-muted-foreground hover:text-foreground p-1 rounded"
                    onClick={() => setPreviewZoom((z) => Math.min(previewZoomMax, z + 10))}
                    title="Aumentar zoom"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span className="text-[10px] text-muted-foreground">{previewZoom}%</span>
              </div>
            </div>
            {allContents.length > 0 ? (
              <DndContext
                sensors={previewDndSensors}
                collisionDetection={closestCenter}
                onDragStart={(e) => setActivePreviewId(String(e.active.id))}
                onDragEnd={onPreviewDragEnd}
                onDragCancel={() => setActivePreviewId(null)}
              >
                <SortableContext items={orderedPreviewIds} strategy={rectSortingStrategy}>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                    {orderedPreviewIds.map((id) => {
                      const item = previewById.get(id);
                      if (!item) return null;
                      return (
                        <SortablePreviewItem
                          key={id}
                          id={id}
                          item={item}
                          width={(previewBaseWidth * previewZoom) / 100}
                          onClick={() => setPreviewMedia(item.content.media)}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum conteúdo programado</p>
            )}
          </div>
        </div>
      )}

      {/* ═══ VIEW: CAMPAIGNS ═══ */}
      {viewMode === "campaigns" && (
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <ScrollArea className="max-h-[60vh]">
            {filteredCampaigns.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">Nenhuma campanha encontrada</p>
            ) : (
              <div className="divide-y divide-border">
                {filteredCampaigns.map((c: any) => {
                  const status = getStatus(c);
                  const color = colorMap[c.id] || "#888";
                  const contentsCount = (c.campaign_contents || []).length;
                  const targetsCount = (c.campaign_targets || []).length;
                  const pri = PRIORITY_LABELS[c.priority] || { label: `P${c.priority}` };
                  const typeLabel = CAMPAIGN_TYPES.find(t => t.value === c.campaign_type)?.label || c.campaign_type;

                  return (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors" style={{ borderLeft: `4px solid ${color}` }}>
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[status]}`} />
                      <span className="flex-1 text-sm font-medium truncate">{c.name}</span>

                      <Badge variant="outline" className="text-[10px] hidden lg:inline-flex">{typeLabel}</Badge>
                      <Badge variant="secondary" className="text-[10px] hidden md:inline-flex">{pri.label}</Badge>

                      {c.start_date && (
                        <span className="text-[10px] text-muted-foreground font-mono hidden md:inline">
                          {new Date(c.start_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                          {c.end_date && ` → ${new Date(c.end_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`}
                        </span>
                      )}

                      <Badge variant="secondary" className="text-[10px]">{contentsCount} mídia(s)</Badge>
                      {targetsCount > 0 && <Badge variant="outline" className="text-[10px]">{targetsCount} segm.</Badge>}

                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={() => openEdit(c)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1 text-xs h-7 text-primary" onClick={() => { setDetailCampaignId(c.id); setDetailTab("contents"); }}>
                          <Layers className="h-3 w-3" /> Detalhes
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-1 text-xs h-7 text-destructive" onClick={() => {
                          if (confirm(`Excluir campanha "${c.name}"?`)) deleteCampaign.mutate(c.id);
                        }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {/* ═══ VIEW: HIERARCHY ═══ */}
      {viewMode === "hierarchy" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3 flex items-center gap-2">
            <Label className="text-xs">Fonte</Label>
            <Select value={hierarchyMode} onValueChange={(v) => setHierarchyMode(v as any)}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON (local)</SelectItem>
                <SelectItem value="db">Banco de dados</SelectItem>
              </SelectContent>
            </Select>
            {hierarchyMode === "json" && (
              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="sm" onClick={() => exportHlModel()}>Exportar JSON</Button>
                <Button variant="outline" size="sm" onClick={() => setJsonImportOpen(true)}>Importar JSON</Button>
                <Button size="sm" onClick={() => saveHlModel(hlModel)}>Salvar</Button>
              </div>
            )}
          </div>
          {hierarchyMode === "db" && (
            <>
              <div className="md:col-span-2 border border-border rounded-lg bg-card overflow-hidden min-h-[60vh] flex flex-col">
                <div className="p-3 border-b border-border flex items-center gap-2">
                  <Input value={hierarchySearch} onChange={(e) => setHierarchySearch(e.target.value)} placeholder="Buscar na hierarquia..." className="h-8 text-sm" />
                </div>
                <div className="flex-1 min-h-0">
                  <HierarchyTree key={hierarchyRefreshKey} onSelect={(n) => setHierarchySelected(n)} search={hierarchySearch} />
                </div>
              </div>
              <div className="border border-border rounded-lg bg-card p-4">
                <p className="text-sm font-medium mb-2">Selecionado</p>
                {hierarchySelected ? (
                  <div className="mb-4">
                    <p className="text-sm">{hierarchySelected.name}</p>
                    <p className="text-xs text-muted-foreground">{hierarchySelected.type}</p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mb-4">Nenhum nó selecionado</p>
                )}
                <div className="space-y-2">
                  <Label className="text-xs">Tipo</Label>
                  <Select value={createType} onValueChange={(v) => setCreateType(v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="state">Estado</SelectItem>
                      <SelectItem value="region">Região</SelectItem>
                      <SelectItem value="city">Cidade</SelectItem>
                      <SelectItem value="store">Loja</SelectItem>
                      <SelectItem value="sector">Setor</SelectItem>
                      <SelectItem value="group">Grupo</SelectItem>
                      <SelectItem value="zone">Zona</SelectItem>
                    </SelectContent>
                  </Select>
                  <Label className="text-xs">Nome</Label>
                  <Input value={createName} onChange={(e) => setCreateName(e.target.value)} className="h-8 text-sm" />
                  <Label className="text-xs">Código (opcional)</Label>
                  <Input value={createCode} onChange={(e) => setCreateCode(e.target.value)} className="h-8 text-sm" />
                  {createType === "state" && (
                    <div className="space-y-1">
                      <Label className="text-xs">Região</Label>
                      <Select value={parentRegionId || ""} onValueChange={(v) => setParentRegionId(v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione a região" /></SelectTrigger>
                        <SelectContent>{regionOptions.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                      </Select>
                      {regionOptions.length === 0 && <p className="text-[11px] text-muted-foreground">Crie uma Região primeiro para habilitar Estados.</p>}
                    </div>
                  )}
                  <Button className="w-full" disabled={!canCreateHere} onClick={async () => {
                    try {
                      if (createType === "state") {
                        const payload: any = { name: createName, code: createCode || null, tenant_id: tenantId };
                        payload.region_id = parentRegionId || hierarchySelected?.id;
                        if (!payload.region_id) { toast({ title: "Selecione a Região", variant: "destructive" }); return; }
                        const { error } = await supabase.from("states").insert(payload);
                        if (error) throw error;
                        toast({ title: "Estado criado" });
                      } else if (createType === "region") {
                        const { error } = await supabase.from("regions").insert({ name: createName, code: createCode || null, country_id: null, tenant_id: tenantId });
                        if (error) throw error;
                        toast({ title: "Região criada" });
                      } else if (createType === "city") {
                        const { error } = await supabase.from("cities").insert({ name: createName, state_id: hierarchySelected!.id, tenant_id: tenantId });
                        if (error) throw error;
                        toast({ title: "Cidade criada" });
                      } else if (createType === "store") {
                        const { error } = await supabase.from("stores").insert({ name: createName, code: createCode || null, city_id: hierarchySelected!.id, tenant_id: tenantId });
                        if (error) throw error;
                        toast({ title: "Loja criada" });
                      } else if (createType === "sector") {
                        const { error } = await supabase.from("sectors").insert({ name: createName, store_id: hierarchySelected!.id, tenant_id: tenantId });
                        if (error) throw error;
                        toast({ title: "Setor criado" });
                      } else if (createType === "group") {
                        const { error } = await supabase.from("device_groups").insert({ name: createName, store_id: hierarchySelected!.id, tenant_id: tenantId });
                        if (error) throw error;
                        toast({ title: "Grupo criado" });
                      } else if (createType === "zone") {
                        const { error } = await supabase.from("zones").insert({ name: createName, sector_id: hierarchySelected!.id, tenant_id: tenantId });
                        if (error) throw error;
                        toast({ title: "Zona criada" });
                      }
                      setCreateName(""); setCreateCode(""); setHierarchyRefreshKey((k) => k + 1);
                    } catch (e: any) { toast({ title: "Erro ao criar", description: e.message, variant: "destructive" }); }
                  }}>Criar</Button>
                  <p className="text-xs text-muted-foreground mt-2">Use drag-and-drop para mover nós dentro de combinações permitidas.</p>
                </div>
              </div>
            </>
          )}
          {hierarchyMode === "json" && (
            <>
              <div className="md:col-span-2 border border-border rounded-lg bg-card p-3">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs font-semibold mb-2">Estados</p>
                    <DndContext onDragEnd={(e) => {
                      const { active, over } = e;
                      if (!over || active.id === over.id) return;
                      const ids = hlModel.states.map(s => s.id);
                      const from = ids.indexOf(String(active.id));
                      const to = ids.indexOf(String(over.id));
                      if (from < 0 || to < 0) return;
                      const nextStates = arrayMove(hlModel.states, from, to);
                      saveHlModel({ ...hlModel, states: nextStates });
                    }}>
                      <SortableContext items={hlModel.states.map(s => s.id)} strategy={rectSortingStrategy}>
                        <div className="space-y-1">
                          {hlModel.states.map((s) => {
                            const { attributes, listeners, setNodeRef } = useSortable({ id: s.id });
                            return (
                              <div key={s.id} ref={setNodeRef} className="flex items-center gap-2 bg-muted/30 rounded px-2 py-1" {...attributes} {...listeners}>
                                <span className="flex-1 text-sm">{s.name}</span>
                                <Button size="sm" variant="outline" onClick={() => {
                                  const name = prompt("Nome da região");
                                  if (!name) return;
                                  const region: HLRegion = { id: crypto.randomUUID(), name, cities: [] };
                                  const nextStates = hlModel.states.map(st => st.id === s.id ? { ...st, regions: [...st.regions, region] } : st);
                                  saveHlModel({ ...hlModel, states: nextStates });
                                }}>+ Região</Button>
                              </div>
                            );
                          })}
                        </div>
                      </SortableContext>
                    </DndContext>
                    <div className="mt-2">
                      <Button size="sm" onClick={() => {
                        const name = prompt("Nome do estado");
                        if (!name) return;
                        const code = prompt("Código (opcional)") || undefined;
                        const st: HLState = { id: crypto.randomUUID(), name, code, regions: [] };
                        saveHlModel({ ...hlModel, states: [...hlModel.states, st] });
                      }}>+ Estado</Button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-2">Regiões</p>
                    <div className="space-y-3">
                      {hlModel.states.map(st => (
                        <div key={st.id} className="rounded border border-border p-2">
                          <p className="text-xs font-medium mb-1">{st.name}</p>
                          <DndContext onDragEnd={(e) => {
                            const { active, over } = e;
                            if (!over || active.id === over.id) return;
                            const ids = st.regions.map(r => r.id);
                            const from = ids.indexOf(String(active.id));
                            const to = ids.indexOf(String(over.id));
                            if (from < 0 || to < 0) return;
                            const nextRegs = arrayMove(st.regions, from, to);
                            const nextStates = hlModel.states.map(s2 => s2.id === st.id ? { ...s2, regions: nextRegs } : s2);
                            saveHlModel({ ...hlModel, states: nextStates });
                          }}>
                            <SortableContext items={st.regions.map(r => r.id)} strategy={rectSortingStrategy}>
                              <div className="space-y-1">
                                {st.regions.map(r => {
                                  const { attributes, listeners, setNodeRef } = useSortable({ id: r.id });
                                  return (
                                    <div key={r.id} ref={setNodeRef} className="flex items-center gap-2 bg-muted/20 rounded px-2 py-1" {...attributes} {...listeners}>
                                      <span className="flex-1 text-sm">{r.name}</span>
                                      <Button size="sm" variant="outline" onClick={() => {
                                        const name = prompt("Nome da cidade");
                                        if (!name) return;
                                        const city: HLCity = { id: crypto.randomUUID(), name, stores: [] };
                                        const nextStates = hlModel.states.map(s2 => s2.id === st.id ? { ...s2, regions: s2.regions.map(rr => rr.id === r.id ? { ...rr, cities: [...rr.cities, city] } : rr) } : s2);
                                        saveHlModel({ ...hlModel, states: nextStates });
                                      }}>+ Cidade</Button>
                                    </div>
                                  );
                                })}
                              </div>
                            </SortableContext>
                          </DndContext>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-2">Cidades e Lojas</p>
                    <div className="space-y-3">
                      {hlModel.states.map(st => st.regions.map(r => (
                        <div key={r.id} className="rounded border border-border p-2">
                          <p className="text-xs font-medium">{st.name} · {r.name}</p>
                          <div className="mt-2 space-y-2">
                            {r.cities.map(city => (
                              <div key={city.id} className="rounded bg-muted/20 p-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium flex-1">{city.name}</span>
                                  <Button size="sm" variant="outline" onClick={() => {
                                    const name = prompt("Nome da loja");
                                    if (!name) return;
                                    const code = prompt("Código da loja (opcional)") || undefined;
                                    const store: HLStore = { id: crypto.randomUUID(), name, code, sectors: [], groups: [], devices: [] };
                                    const nextStates = hlModel.states.map(s2 => s2.id === st.id ? {
                                      ...s2,
                                      regions: s2.regions.map(rr => rr.id === r.id ? {
                                        ...rr,
                                        cities: rr.cities.map(cc => cc.id === city.id ? { ...cc, stores: [...cc.stores, store] } : cc)
                                      } : rr)
                                    } : s2);
                                    saveHlModel({ ...hlModel, states: nextStates });
                                  }}>+ Loja</Button>
                                </div>
                                <div className="mt-2 space-y-1">
                                  {city.stores.map(store => (
                                    <div key={store.id} className="rounded border border-border p-2">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium flex-1">{store.name}</span>
                                        <Button size="sm" variant="outline" onClick={() => {
                                          const name = prompt("Nome do setor");
                                          if (!name) return;
                                          const sector: HLSector = { id: crypto.randomUUID(), name, devices: [] };
                                          const nextStates = hlModel.states.map(s2 => s2.id === st.id ? {
                                            ...s2,
                                            regions: s2.regions.map(rr => rr.id === r.id ? {
                                              ...rr,
                                              cities: rr.cities.map(cc => cc.id === city.id ? {
                                                ...cc,
                                                stores: cc.stores.map(ss => ss.id === store.id ? { ...ss, sectors: [...ss.sectors, sector] } : ss)
                                              } : cc)
                                            } : rr)
                                          } : s2);
                                          saveHlModel({ ...hlModel, states: nextStates });
                                        }}>+ Setor</Button>
                                        <Button size="sm" variant="outline" onClick={() => {
                                          const name = prompt("Nome do grupo");
                                          if (!name) return;
                                          const group: HLGroup = { id: crypto.randomUUID(), name, devices: [] };
                                          const nextStates = hlModel.states.map(s2 => s2.id === st.id ? {
                                            ...s2,
                                            regions: s2.regions.map(rr => rr.id === r.id ? {
                                              ...rr,
                                              cities: rr.cities.map(cc => cc.id === city.id ? {
                                                ...cc,
                                                stores: cc.stores.map(ss => ss.id === store.id ? { ...ss, groups: [...ss.groups, group] } : ss)
                                              } : cc)
                                            } : rr)
                                          } : s2);
                                          saveHlModel({ ...hlModel, states: nextStates });
                                        }}>+ Grupo</Button>
                                      </div>
                                      <div className="mt-2 space-y-1">
                                        {store.sectors.map(sec => (
                                          <div key={sec.id} className="rounded bg-muted/30 p-2">
                                            <div className="flex items-center gap-2">
                                              <span className="text-sm flex-1">{sec.name}</span>
                                              <Button size="sm" variant="outline" onClick={() => {
                                                const name = prompt("Nome do dispositivo");
                                                if (!name) return;
                                                const dev: HLDevice = { id: crypto.randomUUID(), name };
                                                const nextStates = hlModel.states.map(s2 => s2.id === st.id ? {
                                                  ...s2,
                                                  regions: s2.regions.map(rr => rr.id === r.id ? {
                                                    ...rr,
                                                    cities: rr.cities.map(cc => cc.id === city.id ? {
                                                      ...cc,
                                                      stores: cc.stores.map(ss => ss.id === store.id ? {
                                                        ...ss,
                                                        sectors: ss.sectors.map(se => se.id === sec.id ? { ...se, devices: [...se.devices, dev] } : se)
                                                      } : ss)
                                                    } : cc)
                                                  } : rr)
                                                } : s2);
                                                saveHlModel({ ...hlModel, states: nextStates });
                                              }}>+ Dispositivo</Button>
                                            </div>
                                          </div>
                                        ))}
                                        {store.groups.map(gr => (
                                          <div key={gr.id} className="rounded bg-muted/30 p-2">
                                            <div className="flex items-center gap-2">
                                              <span className="text-sm flex-1">{gr.name}</span>
                                              <Button size="sm" variant="outline" onClick={() => {
                                                const name = prompt("Nome do dispositivo");
                                                if (!name) return;
                                                const dev: HLDevice = { id: crypto.randomUUID(), name };
                                                const nextStates = hlModel.states.map(s2 => s2.id === st.id ? {
                                                  ...s2,
                                                  regions: s2.regions.map(rr => rr.id === r.id ? {
                                                    ...rr,
                                                    cities: rr.cities.map(cc => cc.id === city.id ? {
                                                      ...cc,
                                                      stores: cc.stores.map(ss => ss.id === store.id ? {
                                                        ...ss,
                                                        groups: ss.groups.map(g2 => g2.id === gr.id ? { ...g2, devices: [...g2.devices, dev] } : g2)
                                                      } : ss)
                                                    } : cc)
                                                  } : rr)
                                                } : s2);
                                                saveHlModel({ ...hlModel, states: nextStates });
                                              }}>+ Dispositivo</Button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )))}
                    </div>
                  </div>
                </div>
              </div>
              <Dialog open={jsonImportOpen} onOpenChange={setJsonImportOpen}>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>Importar JSON</DialogTitle></DialogHeader>
                  <Textarea value={jsonImportText} onChange={(e) => setJsonImportText(e.target.value)} rows={10} />
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setJsonImportOpen(false)}>Cancelar</Button>
                    <Button onClick={() => {
                      try {
                        const parsed = JSON.parse(jsonImportText);
                        saveHlModel(parsed);
                        setJsonImportText("");
                        setJsonImportOpen(false);
                      } catch (e: any) {
                        toast({ title: "JSON inválido", description: e.message, variant: "destructive" });
                      }
                    }}>Importar</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      )}

      {/* ═══ VIEW: HIERARCHY VISUAL ═══ */}
      {viewMode === "hierarchy-visual" && (
        <div className="border border-border rounded-lg bg-card p-3">
          <FabricHierarchy
            initialTree={[]}
            onExportJson={() => {}}
            onImportJson={() => {}}
            onSaveToDb={async () => {}}
            height={650}
            width={1100}
          />
        </div>
      )}

      {/* ═══ VIEW: TIMELINE ═══ */}
      {viewMode === "timeline" && filteredCampaigns.length > 0 && (
        <div className="border border-border rounded-lg bg-card p-4 overflow-x-auto">
          <div className="flex items-center gap-0 mb-2 min-w-[800px]">
            <div className="w-44 shrink-0" />
            <div className="flex-1 flex">
              {Array.from({ length: 18 }, (_, i) => i + 6).map(h => (
                <div key={h} className="flex-1 text-center text-[10px] text-muted-foreground font-mono border-l border-border/40 first:border-l-0">
                  {String(h).padStart(2, "0")}h
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-1 min-w-[800px]">
            {filteredCampaigns.map((c: any) => {
              const color = colorMap[c.id] || "#888";
              const startH = c.start_time ? parseInt(c.start_time.split(":")[0]) : 6;
              const endH = c.end_time ? parseInt(c.end_time.split(":")[0]) : 23;
              const s = Math.max(startH, 6);
              const e = Math.min(endH, 23);
              const leftPct = ((s - 6) / 17) * 100;
              const widthPct = ((e - s) / 17) * 100;
              return (
                <div key={c.id} className="flex items-center gap-0 cursor-pointer hover:bg-accent/20 rounded transition-colors" onClick={() => { setDetailCampaignId(c.id); setDetailTab("contents"); }}>
                  <div className="w-44 shrink-0 truncate text-xs font-medium pr-2 text-right">{c.name}</div>
                  <div className="flex-1 h-8 bg-muted/20 rounded relative">
                    <div className="absolute top-0.5 bottom-0.5 rounded flex items-center px-2" style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 3)}%`, backgroundColor: color, opacity: 0.85 }}>
                      <span className="text-[9px] text-white font-semibold truncate">{(c.campaign_contents || []).length} itens</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {viewMode === "timeline" && filteredCampaigns.length === 0 && (
        <p className="text-center text-muted-foreground py-12">Nenhuma campanha para exibir na timeline</p>
      )}

      {/* ═══ Create/Edit Campaign Dialog ═══ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingCampaign ? "Editar Campanha" : "Nova Campanha"}</DialogTitle></DialogHeader>
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="general" className="flex-1">Geral</TabsTrigger>
              <TabsTrigger value="schedule" className="flex-1">Período</TabsTrigger>
              <TabsTrigger value="rules" className="flex-1">Regras</TabsTrigger>
            </TabsList>
            <TabsContent value="general" className="space-y-4 mt-4">
              <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Trade Páscoa 2025" /></div>
              <div><Label>Descrição</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
              <div><Label>Tipo</Label>
                <Select value={form.campaign_type} onValueChange={v => setForm({ ...form, campaign_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CAMPAIGN_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} /><Label>Ativa</Label></div>
            </TabsContent>
            <TabsContent value="schedule" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Data início</Label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
                <div><Label>Data fim</Label><Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Horário início</Label><Input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} /></div>
                <div><Label>Horário fim</Label><Input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} /></div>
              </div>
              <div><Label>Dias da semana</Label>
                <div className="flex gap-1 mt-1">
                  {DAYS_OF_WEEK.map(d => (
                    <Button key={d.value} type="button" size="sm" variant={form.days_of_week.includes(d.value) ? "default" : "outline"} className="h-8 w-10 text-xs" onClick={() => toggleDay(d.value)}>{d.label}</Button>
                  ))}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="rules" className="space-y-4 mt-4">
              <div><Label>Prioridade</Label>
                <Select value={String(form.priority)} onValueChange={v => setForm({ ...form, priority: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PRIORITY_LABELS).map(([val, info]) => <SelectItem key={val} value={val}>{info.label} (P{val})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Peso (1-10)</Label><Input type="number" min={1} max={10} value={form.weight} onChange={e => setForm({ ...form, weight: Number(e.target.value) })} /></div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name}>{editingCampaign ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Campaign Detail Dialog ═══ */}
      <Dialog open={!!detailCampaignId} onOpenChange={v => { if (!v) setDetailCampaignId(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              {detailCampaign?.name || "Campanha"}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={detailTab} onValueChange={setDetailTab} className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="contents" className="flex-1 gap-1"><Image className="h-3 w-3" />Conteúdos</TabsTrigger>
              <TabsTrigger value="target" className="flex-1 gap-1"><Target className="h-3 w-3" />Segmentação</TabsTrigger>
              <TabsTrigger value="preview" className="flex-1 gap-1"><Eye className="h-3 w-3" />Preview</TabsTrigger>
            </TabsList>

            <TabsContent value="contents" className="space-y-4 mt-4">
              {detailContents.length > 0 ? (
                <DndContext
                  sensors={detailDndSensors}
                  collisionDetection={closestCenter}
                  onDragStart={(e) => setActiveDetailId(String(e.active.id))}
                  onDragEnd={onDetailDragEnd}
                  onDragCancel={() => setActiveDetailId(null)}
                >
                  <SortableContext items={orderedDetailIds} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {orderedDetailContents.map((c: any) => (
                        <SortableContentCard key={c.id} item={c} />
                      ))}
                    </div>
                  </SortableContext>
                  <DragOverlay>
                    {activeDetailId ? (
                      <div className="w-64">
                        {(() => {
                          const item = orderedDetailContents.find((c: any) => c.id === activeDetailId);
                          if (!item) return null;
                          const isImg = item.media?.type === "image" || item.media?.file_url?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                          return (
                            <div className="rounded-lg bg-background border border-border shadow-lg p-2">
                              <div className="aspect-video rounded-md overflow-hidden bg-muted border border-border">
                                {isImg && item.media?.file_url ? (
                                  <img src={item.media.file_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center"><Image className="h-6 w-6 text-muted-foreground" /></div>
                                )}
                              </div>
                              <p className="text-xs font-medium truncate mt-2">{item.media?.name || "Mídia"}</p>
                            </div>
                          );
                        })()}
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum conteúdo adicionado</p>
              )}
              <div className="border-t pt-4 flex gap-2">
                <Select value={addMediaId} onValueChange={setAddMediaId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Selecionar mídia..." /></SelectTrigger>
                  <SelectContent>{mediaList.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name} ({m.type})</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" disabled={!addMediaId || !detailCampaignId} onClick={() => addContent.mutate({ campaignId: detailCampaignId!, mediaId: addMediaId })}>
                  <Plus className="h-4 w-4 mr-1" />Adicionar
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="target" className="space-y-4 mt-4">
              {detailTargets.length > 0 ? (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Segmentações ativas</Label>
                  <div className="flex flex-wrap gap-2">
                    {detailTargets.map((t: any) => (
                      <Badge key={t.id} variant="secondary" className="gap-1 pr-1">
                        {getTargetLabel(t)}
                        <Button variant="ghost" size="icon" className="h-4 w-4 ml-1" onClick={() => removeTarget.mutate(t.id)}><Trash2 className="h-3 w-3" /></Button>
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">Sem segmentação = exibir para todos</p>
              )}
              <div className="border-t pt-4 space-y-3">
                <Label>Adicionar segmentação</Label>
                <Select value={targetForm.target_type} onValueChange={v => setTargetForm({ ...targetForm, target_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="region">Região</SelectItem>
                    <SelectItem value="state">Estado</SelectItem>
                    <SelectItem value="city">Cidade</SelectItem>
                    <SelectItem value="store">Loja</SelectItem>
                    <SelectItem value="sector">Setor</SelectItem>
                    <SelectItem value="device">Dispositivo</SelectItem>
                    <SelectItem value="tag">Tag</SelectItem>
                  </SelectContent>
                </Select>
                {targetForm.target_type === "region" && (
                  <Select value={targetForm.region_id} onValueChange={v => setTargetForm({ ...targetForm, region_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione a região" /></SelectTrigger>
                    <SelectContent>{regions.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                {targetForm.target_type === "state" && (
                  <Select value={targetForm.state_id} onValueChange={v => setTargetForm({ ...targetForm, state_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione o estado" /></SelectTrigger>
                    <SelectContent>{statesData.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.code} - {s.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                {targetForm.target_type === "city" && (
                  <Select value={targetForm.city_id} onValueChange={v => setTargetForm({ ...targetForm, city_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione a cidade" /></SelectTrigger>
                    <SelectContent>{cities.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                {targetForm.target_type === "store" && (
                  <Select value={targetForm.store_id} onValueChange={v => setTargetForm({ ...targetForm, store_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione a loja" /></SelectTrigger>
                    <SelectContent>{stores.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                {targetForm.target_type === "sector" && (
                  <Select value={targetForm.sector_id} onValueChange={v => setTargetForm({ ...targetForm, sector_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                    <SelectContent>{sectors.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                {targetForm.target_type === "device" && (
                  <Select value={targetForm.device_id} onValueChange={v => setTargetForm({ ...targetForm, device_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione o dispositivo" /></SelectTrigger>
                    <SelectContent>{devices.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                {targetForm.target_type === "tag" && (
                  <Select value={targetForm.tag_id} onValueChange={v => setTargetForm({ ...targetForm, tag_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione a tag" /></SelectTrigger>
                    <SelectContent>{tags.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                <Button className="w-full" size="sm" onClick={() => {
                  if (!detailCampaignId) return;
                  addTarget.mutate({
                    campaign_id: detailCampaignId, target_type: targetForm.target_type,
                    state_id: targetForm.state_id || undefined, tag_id: targetForm.tag_id || undefined,
                    sector_id: targetForm.sector_id || undefined, store_id: targetForm.store_id || undefined,
                    city_id: targetForm.city_id || undefined, region_id: targetForm.region_id || undefined,
                    device_id: targetForm.device_id || undefined,
                  });
                }}>
                  <Plus className="h-4 w-4 mr-2" />Adicionar
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="mt-4">
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4 text-center">
                  <Monitor className="h-8 w-8 mx-auto text-primary mb-2" />
                  <p className="text-2xl font-bold">{previewData?.devices ?? "..."}</p>
                  <p className="text-xs text-muted-foreground">Dispositivos</p>
                </Card>
                <Card className="p-4 text-center">
                  <Store className="h-8 w-8 mx-auto text-primary mb-2" />
                  <p className="text-2xl font-bold">{previewData?.stores ?? "..."}</p>
                  <p className="text-xs text-muted-foreground">Lojas</p>
                </Card>
                <Card className="p-4 text-center">
                  <MapPin className="h-8 w-8 mx-auto text-primary mb-2" />
                  <p className="text-2xl font-bold">{previewData?.states ?? "..."}</p>
                  <p className="text-xs text-muted-foreground">Estados</p>
                </Card>
              </div>
              <div className="mt-4 p-4 rounded-lg bg-muted/30 border">
                <p className="text-sm font-medium mb-2">Conteúdos programados: {detailContents.length}</p>
                <p className="text-sm font-medium">Segmentações: {detailTargets.length === 0 ? "Todos os dispositivos" : `${detailTargets.length} regra(s)`}</p>
                {detailCampaign?.start_date && <p className="text-sm mt-1">Período: {detailCampaign.start_date} → {detailCampaign.end_date || "∞"}</p>}
                {detailCampaign?.start_time && <p className="text-sm">Horário: {detailCampaign.start_time} - {detailCampaign.end_time}</p>}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* ═══ Add Content Dialog (global) ═══ */}
      <Dialog open={addContentDialogOpen} onOpenChange={setAddContentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Adicionar Conteúdo</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Campanha</Label>
              <Select value={newContentCampaignId} onValueChange={setNewContentCampaignId}>
                <SelectTrigger><SelectValue placeholder="Selecione a campanha" /></SelectTrigger>
                <SelectContent>
                  {filteredCampaigns.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colorMap[c.id] }} />
                        {c.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mídia</Label>
              <Select value={newContentMediaId} onValueChange={setNewContentMediaId}>
                <SelectTrigger><SelectValue placeholder="Selecione a mídia" /></SelectTrigger>
                <SelectContent>
                  {mediaList.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>
                      <div className="flex items-center gap-2">
                        {m.file_url && (m.type === "image" || m.file_url?.match(/\.(jpg|jpeg|png|gif|webp)$/i)) ? (
                          <img src={m.file_url} alt="" className="w-8 h-5 object-cover rounded" />
                        ) : (
                          <div className="w-8 h-5 bg-muted rounded flex items-center justify-center"><Image className="h-3 w-3" /></div>
                        )}
                        {m.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={newContentScheduled} onCheckedChange={setNewContentScheduled} />
              <Label>Conteúdo programado (usar período da campanha)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddContentDialogOpen(false)}>Cancelar</Button>
            <Button disabled={!newContentCampaignId || !newContentMediaId} onClick={() => addContent.mutate({ campaignId: newContentCampaignId, mediaId: newContentMediaId })}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Preview Lightbox ═══ */}
      <Dialog open={!!previewMedia} onOpenChange={v => { if (!v) setPreviewMedia(null); }}>
        <DialogContent className="max-w-4xl p-2">
          <DialogHeader>
            <DialogTitle className="text-sm">{previewMedia?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center min-h-[400px] bg-black rounded-lg overflow-hidden">
            {previewMedia?.file_url && (previewMedia.type === "video" || previewMedia.file_url?.match(/\.(mp4|webm|mov)$/i)) ? (
              <video src={previewMedia.file_url} controls autoPlay className="max-w-full max-h-[70vh]" />
            ) : previewMedia?.file_url ? (
              <img src={previewMedia.file_url} alt={previewMedia.name} className="max-w-full max-h-[70vh] object-contain" />
            ) : (
              <p className="text-white">Preview indisponível</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Group Create/Edit Dialog ═══ */}
      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingGroup ? "Editar Grupo" : "Novo Grupo"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome do grupo</Label><Input value={groupForm.name} onChange={e => setGroupForm({ ...groupForm, name: e.target.value })} placeholder="Ex: Consulta Preço" /></div>
            <div><Label>Descrição</Label><Textarea value={groupForm.description} onChange={e => setGroupForm({ ...groupForm, description: e.target.value })} rows={2} placeholder="Descrição opcional" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupDialogOpen(false)}>Cancelar</Button>
            <Button disabled={!groupForm.name} onClick={() => {
              if (editingGroup) { updateGroup.mutate({ id: editingGroup.id, ...groupForm }); }
              else { createGroup.mutate(groupForm); }
            }}>{editingGroup ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Add Devices to Group Dialog ═══ */}
      <Dialog open={!!addDeviceGroupId} onOpenChange={v => { if (!v) { setAddDeviceGroupId(null); setSelectedDeviceIds([]); } }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Dispositivos do grupo</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mb-2">Selecione os dispositivos para "{deviceGroups.find((g: any) => g.id === addDeviceGroupId)?.name}"</p>

          <ScrollArea className="h-[40vh] border rounded-lg p-2">
            {devices.map((d: any) => {
              const checked = selectedDeviceIds.includes(d.id);
              return (
                <div key={d.id} className="flex items-center gap-3 py-2 px-2 hover:bg-accent/40 rounded">
                  <Checkbox checked={checked} onCheckedChange={(v) => {
                    setSelectedDeviceIds(prev => v ? [...prev, d.id] : prev.filter(id => id !== d.id));
                  }} />
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">{d.device_code}</p>
                  </div>
                </div>
              );
            })}
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddDeviceGroupId(null); setSelectedDeviceIds([]); }}>Cancelar</Button>
            <Button onClick={() => { if (addDeviceGroupId) addDevicesToGroup.mutate({ groupId: addDeviceGroupId, deviceIds: selectedDeviceIds }); }}>
              Salvar ({selectedDeviceIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};

export default ScheduleTimeline;
