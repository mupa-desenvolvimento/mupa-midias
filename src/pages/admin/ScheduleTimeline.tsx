import { useState, useMemo } from "react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import {
  Plus, Search, Pencil, Trash2, CheckCircle2, Monitor, Store, MapPin, Tag, Users, Info, ChevronDown, Image, Target, Eye, Layers, Calendar
} from "lucide-react";

const CAMPAIGN_COLORS = [
  "#22c55e", "#ef4444", "#3b82f6", "#f59e0b", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
  "#06b6d4", "#e11d48", "#a855f7", "#10b981", "#d946ef",
];

const STATUS_DOT: Record<string, string> = {
  active: "bg-green-500",
  draft: "bg-gray-400",
  paused: "bg-yellow-500",
  expired: "bg-red-500",
};

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "Máxima", color: "bg-red-500" },
  2: { label: "Alta", color: "bg-orange-500" },
  3: { label: "Média", color: "bg-yellow-500" },
  5: { label: "Normal", color: "bg-blue-500" },
  8: { label: "Baixa", color: "bg-muted" },
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
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

const DEFAULT_FORM = {
  name: "", description: "", campaign_type: "institutional", priority: 5, weight: 1,
  is_active: true, start_date: "", end_date: "", start_time: "", end_time: "",
  days_of_week: [0, 1, 2, 3, 4, 5, 6] as number[],
};

const ScheduleTimeline = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [targetType, setTargetType] = useState("all");
  const [targetValue, setTargetValue] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [groupLabel, setGroupLabel] = useState("TODAS AS CAMPANHAS");

  // Campaign create/edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [form, setForm] = useState({ ...DEFAULT_FORM });

  // Campaign detail dialog (contents, target, preview)
  const [detailCampaignId, setDetailCampaignId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState("contents");
  const [targetForm, setTargetForm] = useState({ target_type: "state", state_id: "", tag_id: "", sector_id: "", store_id: "" });
  const [addMediaId, setAddMediaId] = useState("");

  // ── Data queries ──
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
    queryFn: async () => { const { data } = await supabase.from("devices").select("id, name, device_code, store_id, sector_id").eq("is_active", true).order("name").limit(200); return data || []; },
  });
  const { data: deviceGroups = [] } = useQuery({
    queryKey: ["device-groups-schedule"],
    queryFn: async () => { const { data } = await supabase.from("device_groups").select("id, name").order("name"); return data || []; },
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
          deviceCount += count || 0;
          storeCount += 1;
        } else if (t.target_type === "state" && t.state_id) {
          const { data: cities } = await supabase.from("cities").select("id").eq("state_id", t.state_id);
          const cityIds = (cities || []).map((c: any) => c.id);
          if (cityIds.length > 0) {
            const { data: storesData } = await supabase.from("stores").select("id").in("city_id", cityIds).eq("is_active", true);
            const storeIds = (storesData || []).map((s: any) => s.id);
            storeCount += storeIds.length;
            if (storeIds.length > 0) {
              const { count } = await supabase.from("devices").select("id", { count: "exact", head: true }).in("store_id", storeIds).eq("is_active", true);
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

  // ── Mutations ──
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["schedule-campaigns"] });

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
    onSuccess: () => { invalidate(); toast({ title: "Campanha excluída" }); setDetailCampaignId(null); },
  });

  const addTarget = useMutation({
    mutationFn: async (t: { campaign_id: string; target_type: string; state_id?: string; tag_id?: string; sector_id?: string; store_id?: string }) => {
      const { error } = await supabase.from("campaign_targets").insert([{
        campaign_id: t.campaign_id, target_type: t.target_type,
        state_id: t.target_type === "state" && t.state_id ? t.state_id : null,
        tag_id: t.target_type === "tag" && t.tag_id ? t.tag_id : null,
        sector_id: t.target_type === "sector" && t.sector_id ? t.sector_id : null,
        store_id: t.target_type === "store" && t.store_id ? t.store_id : null,
      }]);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["detail-targets", detailCampaignId] }); toast({ title: "Segmentação adicionada" }); setTargetForm({ target_type: "state", state_id: "", tag_id: "", sector_id: "", store_id: "" }); },
  });

  const removeTarget = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("campaign_targets").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["detail-targets", detailCampaignId] }),
  });

  const addContent = useMutation({
    mutationFn: async ({ campaignId, mediaId }: { campaignId: string; mediaId: string }) => {
      const maxPos = detailContents.length;
      const { error } = await supabase.from("campaign_contents").insert([{ campaign_id: campaignId, media_id: mediaId, position: maxPos, is_active: true, weight: 1 }]);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["detail-contents", detailCampaignId] }); invalidate(); toast({ title: "Conteúdo adicionado" }); setAddMediaId(""); },
  });

  const removeContent = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("campaign_contents").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["detail-contents", detailCampaignId] }); invalidate(); toast({ title: "Conteúdo removido" }); },
  });

  // ── Helpers ──
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
  const handleSave = () => { if (!form.name) return; editingCampaign ? updateCampaign.mutate({ id: editingCampaign.id, ...form }) : createCampaign.mutate(form); };
  const toggleDay = (day: number) => setForm(p => ({ ...p, days_of_week: p.days_of_week.includes(day) ? p.days_of_week.filter(d => d !== day) : [...p.days_of_week, day] }));

  const getStatus = (c: any) => {
    if (!c.is_active) return "paused";
    if (c.end_date && new Date(c.end_date) < new Date()) return "expired";
    if (c.status === "draft") return "draft";
    return "active";
  };

  const getTargetLabel = (t: any) => {
    if (t.target_type === "state") { const s = statesData.find((s: any) => s.id === t.state_id); return `Estado: ${s?.code || "?"}`; }
    if (t.target_type === "tag") { const tag = tags.find((tg: any) => tg.id === t.tag_id); return `Tag: ${tag?.name || "?"}`; }
    if (t.target_type === "sector") { const sec = sectors.find((s: any) => s.id === t.sector_id); return `Setor: ${sec?.name || "?"}`; }
    if (t.target_type === "store") { const st = stores.find((s: any) => s.id === t.store_id); return `Loja: ${st?.name || "?"}`; }
    return t.target_type;
  };

  // Remove unused storeHierarchy memo - we use storesWithHierarchy query directly

  // Filter campaigns using hierarchy rules
  const filteredCampaigns = useMemo(() => {
    let result = campaigns;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c: any) => c.name?.toLowerCase().includes(q));
    }
    if (targetType !== "all" && targetValue) {
      result = result.filter((c: any) => {
        const targets = c.campaign_targets || [];
        // Campaigns with no targets = global = always match
        if (targets.length === 0) return true;

        return targets.some((t: any) => {
          // Direct match by target type
          if (targetType === "device") {
            if (t.target_type === "device" && t.device_id === targetValue) return true;
            // Check if device belongs to a store that matches
            const dev = devices.find((d: any) => d.id === targetValue);
            if (dev?.store_id) {
              if (t.target_type === "store" && t.store_id === dev.store_id) return true;
              // Check hierarchy: store → city → state → region
              const store = storesWithHierarchy.find((s: any) => s.id === dev.store_id);
              if (store) {
                if (t.target_type === "city" && t.city_id === store.city_id) return true;
                if (t.target_type === "state" && t.state_id === store.state_id) return true;
                if (t.target_type === "region" && t.region_id === store.region_id) return true;
              }
            }
            if (dev?.sector_id && t.target_type === "sector" && t.sector_id === dev.sector_id) return true;
          }
          if (targetType === "store") {
            if (t.target_type === "store" && t.store_id === targetValue) return true;
            // Check parent hierarchy: store belongs to city → state → region
            const store = storesWithHierarchy.find((s: any) => s.id === targetValue);
            if (store) {
              if (t.target_type === "city" && t.city_id === store.city_id) return true;
              if (t.target_type === "state" && t.state_id === store.state_id) return true;
              if (t.target_type === "region" && t.region_id === store.region_id) return true;
            }
          }
          if (targetType === "region") {
            if (t.target_type === "region" && t.region_id === targetValue) return true;
            // Also match states within this region
            const regionStates = statesData.filter((s: any) => s.region_id === targetValue);
            if (t.target_type === "state" && regionStates.some((s: any) => s.id === t.state_id)) return true;
          }
          if (targetType === "group") {
            if (t.target_type === "group" && t.device_id === targetValue) return true;
            // Groups contain devices → check if any device in group matches store targets
            // For simplicity, show all campaigns when filtering by group for now
          }
          if (targetType === "tag") {
            if (t.target_type === "tag" && t.tag_id === targetValue) return true;
          }
          return false;
        });
      });
    }
    return result;
  }, [campaigns, search, targetType, targetValue, devices, storesWithHierarchy, statesData]);

  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    campaigns.forEach((c: any, i: number) => { map[c.id] = CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length]; });
    return map;
  }, [campaigns]);

  const selectedCampaign = campaigns.find((c: any) => c.id === selectedCampaignId);
  const selectedContents = selectedCampaign?.campaign_contents || [];
  const detailCampaign = campaigns.find((c: any) => c.id === detailCampaignId);

  const targetOptions = useMemo(() => {
    switch (targetType) {
      case "device": return devices.map((d: any) => ({ id: d.id, label: d.name }));
      case "group": return deviceGroups.map((g: any) => ({ id: g.id, label: g.name }));
      case "store": return stores.map((s: any) => ({ id: s.id, label: s.name }));
      case "region": return regions.map((r: any) => ({ id: r.id, label: r.name }));
      case "tag": return tags.map((t: any) => ({ id: t.id, label: t.name }));
      default: return [];
    }
  }, [targetType, devices, deviceGroups, stores, regions, tags]);

  const handleTargetTypeChange = (val: string) => {
    setTargetType(val);
    setTargetValue("");
    const labels: Record<string, string> = { all: "TODAS AS CAMPANHAS", device: "DISPOSITIVO", group: "GRUPO", store: "LOJA", region: "REGIÃO", tag: "TAG" };
    setGroupLabel(labels[val] || "TODAS");
  };

  return (
    <PageShell header={
      <div className="flex items-center justify-between w-full">
        <div>
          <h1 className="text-2xl font-bold">Programações</h1>
          <p className="text-sm text-muted-foreground">Gerencie campanhas e suas programações</p>
        </div>
      </div>
    }>
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2 border border-border rounded-md px-3 py-1.5 bg-card">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{groupLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </div>

        <Select value={targetType} onValueChange={handleTargetTypeChange}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Veicular em..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all"><span className="flex items-center gap-2"><Users className="h-3.5 w-3.5" /> Todos</span></SelectItem>
            <SelectItem value="device"><span className="flex items-center gap-2"><Monitor className="h-3.5 w-3.5" /> Dispositivo</span></SelectItem>
            <SelectItem value="group"><span className="flex items-center gap-2"><Users className="h-3.5 w-3.5" /> Grupo</span></SelectItem>
            <SelectItem value="store"><span className="flex items-center gap-2"><Store className="h-3.5 w-3.5" /> Loja</span></SelectItem>
            <SelectItem value="region"><span className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> Região</span></SelectItem>
            <SelectItem value="tag"><span className="flex items-center gap-2"><Tag className="h-3.5 w-3.5" /> Tag</span></SelectItem>
          </SelectContent>
        </Select>

        {targetType !== "all" && (
          <Select value={targetValue} onValueChange={setTargetValue}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
            <SelectContent>
              {targetOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar uma campanha" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-64" />
          </div>
          <Button className="gap-1.5" size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />Nova campanha
          </Button>
        </div>
      </div>

      {/* Campaign list */}
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <ScrollArea className="max-h-[50vh]">
          {filteredCampaigns.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">Nenhuma campanha encontrada</p>
          ) : (
            <div className="divide-y divide-border">
              {filteredCampaigns.map((c: any) => {
                const status = getStatus(c);
                const color = colorMap[c.id] || "#888";
                const isSelected = selectedCampaignId === c.id;
                const contentsCount = (c.campaign_contents || []).length;
                const pri = PRIORITY_LABELS[c.priority] || { label: `P${c.priority}`, color: "bg-muted" };

                return (
                  <div
                    key={c.id}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-accent/40 ${isSelected ? "bg-accent/60" : ""}`}
                    onClick={() => setSelectedCampaignId(isSelected ? null : c.id)}
                  >
                    <div className={`w-3 h-3 rounded-full shrink-0 ${STATUS_DOT[status] || "bg-gray-400"}`} />
                    <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="flex-1 text-sm font-medium truncate">{c.name}</span>

                    <Badge variant="outline" className="text-[10px] hidden md:inline-flex">{pri.label}</Badge>

                    {c.start_date && (
                      <span className="text-[10px] text-muted-foreground font-mono hidden md:inline">
                        {new Date(c.start_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                        {c.end_date && ` → ${new Date(c.end_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`}
                      </span>
                    )}

                    {contentsCount > 0 && (
                      <Tooltip>
                        <TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                        <TooltipContent>{contentsCount} mídia(s)</TooltipContent>
                      </Tooltip>
                    )}

                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={() => openEdit(c)}>
                        <Pencil className="h-3 w-3" /> Editar
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={() => { setDetailCampaignId(c.id); setDetailTab("contents"); }}>
                        <Layers className="h-3 w-3" /> Detalhes
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteCampaign.mutate(c.id)}>
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

      {/* Selected campaign media preview */}
      {selectedCampaign && selectedContents.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm font-medium">{selectedCampaign.name} — Conteúdos</span>
            <Button size="sm" className="gap-1.5 text-xs ml-auto" onClick={() => { setDetailCampaignId(selectedCampaign.id); setDetailTab("contents"); }}>
              <Plus className="h-3.5 w-3.5" /> Gerenciar conteúdos
            </Button>
          </div>
          <ScrollArea className="w-full">
            <div className="flex gap-3 pb-2">
              {selectedContents
                .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
                .map((content: any) => {
                  const media = content.media;
                  if (!media) return null;
                  const color = colorMap[selectedCampaign.id] || "#888";
                  const isImage = media.type === "image" || media.file_url?.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);
                  return (
                    <div key={content.id} className="shrink-0 w-40">
                      <div className="relative h-24 rounded-lg overflow-hidden bg-muted border border-border">
                        {isImage && media.file_url ? (
                          <img src={media.file_url} alt={media.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">{media.type || "Mídia"}</div>
                        )}
                      </div>
                      <p className="text-xs font-medium truncate mt-1.5">{media.name}</p>
                      <div className="mt-1 rounded px-2 py-0.5 text-[10px] font-bold text-white truncate text-center" style={{ backgroundColor: color }}>
                        {selectedCampaign.name}
                      </div>
                    </div>
                  );
                })}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Timeline */}
      {filteredCampaigns.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-3">Timeline de Programação</h3>
          <div className="border border-border rounded-lg bg-card p-4 overflow-x-auto">
            <div className="flex items-center gap-0 mb-2 min-w-[800px]">
              <div className="w-36 shrink-0" />
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
                  <div key={c.id} className="flex items-center gap-0">
                    <div className="w-36 shrink-0 truncate text-xs font-medium pr-2 text-right">{c.name}</div>
                    <div className="flex-1 h-7 bg-muted/20 rounded relative">
                      <div className="absolute top-0.5 bottom-0.5 rounded flex items-center px-2" style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 3)}%`, backgroundColor: color, opacity: 0.85 }}>
                        <span className="text-[9px] text-white font-semibold truncate">{(c.campaign_contents || []).length} itens</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Create/Edit Campaign Dialog ── */}
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
              <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Coca verão" /></div>
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

      {/* ── Campaign Detail Dialog (Contents, Target, Preview) ── */}
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
                <div className="space-y-2">
                  {detailContents.map((c: any, idx: number) => (
                    <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                      <span className="text-xs text-muted-foreground w-6 text-center font-mono">{idx + 1}</span>
                      {c.media?.file_url && c.media.type === "image" ? (
                        <img src={c.media.file_url} alt="" className="w-12 h-8 object-cover rounded" />
                      ) : (
                        <div className="w-12 h-8 bg-muted rounded flex items-center justify-center"><Image className="h-4 w-4 text-muted-foreground" /></div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.media?.name || "Mídia"}</p>
                        <p className="text-xs text-muted-foreground">{c.media?.type} · {c.duration_override || c.media?.duration || 10}s</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeContent.mutate(c.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ))}
                </div>
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
                    <SelectItem value="state">Estado</SelectItem>
                    <SelectItem value="tag">Tag</SelectItem>
                    <SelectItem value="sector">Setor</SelectItem>
                    <SelectItem value="store">Loja</SelectItem>
                  </SelectContent>
                </Select>
                {targetForm.target_type === "state" && (
                  <Select value={targetForm.state_id} onValueChange={v => setTargetForm({ ...targetForm, state_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione o estado" /></SelectTrigger>
                    <SelectContent>{statesData.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.code} - {s.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                {targetForm.target_type === "tag" && (
                  <Select value={targetForm.tag_id} onValueChange={v => setTargetForm({ ...targetForm, tag_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione a tag" /></SelectTrigger>
                    <SelectContent>{tags.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                {targetForm.target_type === "sector" && (
                  <Select value={targetForm.sector_id} onValueChange={v => setTargetForm({ ...targetForm, sector_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                    <SelectContent>{sectors.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                {targetForm.target_type === "store" && (
                  <Select value={targetForm.store_id} onValueChange={v => setTargetForm({ ...targetForm, store_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione a loja" /></SelectTrigger>
                    <SelectContent>{stores.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                <Button className="w-full" size="sm" onClick={() => { if (!detailCampaignId) return; addTarget.mutate({ campaign_id: detailCampaignId, target_type: targetForm.target_type, state_id: targetForm.state_id || undefined, tag_id: targetForm.tag_id || undefined, sector_id: targetForm.sector_id || undefined, store_id: targetForm.store_id || undefined }); }}>
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
    </PageShell>
  );
};

export default ScheduleTimeline;
