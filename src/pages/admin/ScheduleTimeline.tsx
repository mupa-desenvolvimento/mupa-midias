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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { SegmentsSelector } from "@/components/campaigns/SegmentsSelector";
import { useCampaignSegments, useCampaignSegmentTargets, useSegmentDeviceStats } from "@/hooks/useCampaignSegments";
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
import {
  Plus, Minus, Search, Pencil, Trash2, Monitor, Store, MapPin, Tag, Users, Info, Image, Target, Eye, Layers, Calendar, CheckCircle2, Settings2, FolderPlus, Download, Hand, Copy, Printer, RefreshCw, Play, GripVertical, Network, ChevronDown, ChevronRight, ListFilter, AlertCircle
} from "lucide-react";
import { MediaThumbnail } from "@/components/media/MediaThumbnail";
import { db } from "@/services/firebase";
import { ref, update } from "firebase/database";

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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const DEVICE_ALL_VALUE = "__all__";

/* ── View modes ── */
type ViewMode = "campaigns" | "contents" | "timeline" | "hierarchy" | "segments";
type SortMode = "campaign" | "name" | "type" | "position";

type HierarchyNodeType = "state" | "region" | "city" | "store" | "sector" | "device_group" | "device";
type HierarchyNode = {
  key: string;
  id: string;
  type: HierarchyNodeType;
  label: string;
  children?: HierarchyNode[];
};

const ScheduleTimeline = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("contents");
  const [sortMode, setSortMode] = useState<SortMode>("campaign");

  const {
    segments,
    createSegment,
    updateSegment,
    deleteSegment,
    addSegmentTarget: addSegmentFilter,
    removeSegmentTarget: removeSegmentFilter,
  } = useCampaignSegments();

  // Group selector
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");
  const [hierarchySearch, setHierarchySearch] = useState("");
  const [hierarchySelectedKeys, setHierarchySelectedKeys] = useState<string[]>([]);
  const [hierarchyExpandedKeys, setHierarchyExpandedKeys] = useState<string[]>([]);

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

  const [selectedSegmentForCampaign, setSelectedSegmentForCampaign] = useState<string | null>(null);

  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [segmentSearch, setSegmentSearch] = useState("");
  const [segmentDialogOpen, setSegmentDialogOpen] = useState(false);
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [segmentForm, setSegmentForm] = useState({ name: "", description: "" });
  const [segmentTargetForm, setSegmentTargetForm] = useState({
    include: true,
    clause_id: "__new__",
    target_type: "state",
    state_id: "",
    region_id: "",
    city_id: "",
    store_id: "",
    sector_id: "",
    device_group_id: "",
    device_id: "",
    tag_id: "",
  });

  const { data: segmentTargets = [] } = useCampaignSegmentTargets(selectedSegmentId);
  const { data: segmentStats } = useSegmentDeviceStats(selectedSegmentId, { limit: 1000, onlyOnline: false });
  const { data: selectedSegmentForCampaignStats } = useSegmentDeviceStats(selectedSegmentForCampaign, { limit: 1000, onlyOnline: false });

  // Group CRUD dialog
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: "", description: "", is_default: false });
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
  const [selectedDeviceCodeForPreview, setSelectedDeviceCodeForPreview] = useState<string>("");

  /* ── Queries ── */
  const { data: campaigns = [] } = useQuery({
    queryKey: ["schedule-campaigns"],
    queryFn: async () => {
      const { data } = await supabase
        .from("campaigns")
        .select("*, campaign_contents(id, media:media_items(id, name, type, file_url, thumbnail_url, duration), position, duration_override), campaign_targets(id, target_type, include, segment_id, clause_id, company_id, region_id, state_id, city_id, store_id, sector_id, zone_id, device_type_id, device_group_id, device_id, tag_id)")
        .order("priority", { ascending: true });
      return data || [];
    },
  });

  const { data: deviceGroups = [] } = useQuery({
    queryKey: ["device-groups-schedule"],
    queryFn: async () => {
      const { data } = await supabase.from("device_groups").select("id, name, description, store_id, tenant_id, is_default").order("name");
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
      const { data } = await supabase.from("media_items").select("id, name, type, file_url, thumbnail_url, duration").eq("status", "active").order("name").limit(200);
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
      const { data } = await supabase.from("campaign_contents").select("*, media:media_items(id, name, type, file_url, thumbnail_url, duration)").eq("campaign_id", detailCampaignId).order("position", { ascending: true });
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

      const segmentIds = [...new Set(detailTargets.map((t: any) => t.segment_id).filter(Boolean))] as string[];
      const onlySegmentTargets = segmentIds.length === 1 && detailTargets.every((t: any) => !!t.segment_id);
      if (onlySegmentTargets) {
        const { data, error } = await supabase.rpc("resolve_segment_device_stats" as any, {
          p_segment_id: segmentIds[0],
          p_limit: 1000,
          p_only_online: false,
        });
        if (error) throw error;
        const row = (data as any)?.[0] ?? data ?? { device_count: 0, store_count: 0 };
        return { devices: Number(row.device_count ?? 0), stores: Number(row.store_count ?? 0), states: 0 };
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

  const linkSegmentToCampaign = useMutation({
    mutationFn: async ({ campaignId, segmentId }: { campaignId: string; segmentId: string }) => {
      const { data: segTargets, error: segTargetsError } = await supabase
        .from("campaign_segment_targets" as any)
        .select(
          "segment_id, clause_id, target_type, include, company_id, state_id, region_id, city_id, store_id, sector_id, zone_id, device_type_id, device_group_id, device_id, tag_id"
        )
        .eq("segment_id", segmentId);
      if (segTargetsError) throw segTargetsError;

      await supabase
        .from("campaign_targets" as any)
        .delete()
        .eq("campaign_id", campaignId)
        .eq("segment_id", segmentId);

      const rows = (segTargets || []).map((t: any) => ({
        campaign_id: campaignId,
        segment_id: segmentId,
        clause_id: t.clause_id ?? null,
        target_type: t.target_type,
        include: t.include !== false,
        company_id: t.company_id ?? null,
        state_id: t.state_id ?? null,
        region_id: t.region_id ?? null,
        city_id: t.city_id ?? null,
        store_id: t.store_id ?? null,
        sector_id: t.sector_id ?? null,
        zone_id: t.zone_id ?? null,
        device_type_id: t.device_type_id ?? null,
        device_group_id: t.device_group_id ?? null,
        device_id: t.device_id ?? null,
        tag_id: t.tag_id ?? null,
      }));

      if (rows.length === 0) throw new Error("Segmento sem filtros (0 regras)");

      const { error: insertError } = await supabase.from("campaign_targets" as any).insert(rows);
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["detail-targets", detailCampaignId] });
      invalidate();
      toast({ title: "Segmento vinculado à campanha" });
    },
    onError: (e: any) => toast({ title: "Erro ao vincular segmento", description: e.message, variant: "destructive" }),
  });

  const unlinkSegmentFromCampaign = useMutation({
    mutationFn: async ({ campaignId, segmentId }: { campaignId: string; segmentId: string }) => {
      const { error } = await supabase
        .from("campaign_targets" as any)
        .delete()
        .eq("campaign_id", campaignId)
        .eq("segment_id", segmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["detail-targets", detailCampaignId] });
      invalidate();
      toast({ title: "Segmento removido da campanha" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
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
      const results = await Promise.all(
        updates.map(u => supabase.from("campaign_contents").update({ position: u.position }).eq("id", u.id).select("id").maybeSingle())
      );
      const err = results.find(r => r.error)?.error;
      if (err) throw err;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["detail-contents", detailCampaignId] }); invalidate(); toast({ title: "Ordem atualizada" }); },
    onError: (e: any) => toast({ title: "Erro ao reordenar", description: e.message, variant: "destructive" }),
  });

  // Group mutations
  const createGroup = useMutation({
    mutationFn: async (g: { name: string; description: string; is_default: boolean }) => {
      const { error } = await supabase.from("device_groups").insert([{ name: g.name, description: g.description || null, is_default: g.is_default }]);
      if (error) throw error;
    },
    onSuccess: () => { invalidateGroups(); toast({ title: "Grupo criado" }); setGroupDialogOpen(false); setGroupForm({ name: "", description: "", is_default: false }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateGroup = useMutation({
    mutationFn: async ({ id, ...g }: { id: string; name: string; description: string; is_default: boolean }) => {
      const { error } = await supabase.from("device_groups").update({ name: g.name, description: g.description || null, is_default: g.is_default }).eq("id", id);
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
    const raw = (() => {
      if (t.target_type === "state") { const s = statesData.find((s: any) => s.id === t.state_id); return `Estado: ${s?.code || "?"}`; }
      if (t.target_type === "region") { const r = regions.find((r: any) => r.id === t.region_id); return `Região: ${r?.name || "?"}`; }
      if (t.target_type === "city") { const c = cities.find((c: any) => c.id === t.city_id); return `Cidade: ${c?.name || "?"}`; }
      if (t.target_type === "tag") { const tag = tags.find((tg: any) => tg.id === t.tag_id); return `Tag: ${tag?.name || "?"}`; }
      if (t.target_type === "sector") { const sec = sectors.find((s: any) => s.id === t.sector_id); return `Setor: ${sec?.name || "?"}`; }
      if (t.target_type === "store") { const st = stores.find((s: any) => s.id === t.store_id); return `Loja: ${st?.name || "?"}`; }
      if (t.target_type === "device_group") { const g = deviceGroups.find((g: any) => g.id === t.device_group_id); return `Grupo: ${g?.name || "?"}`; }
      if (t.target_type === "device") { const d = devices.find((d: any) => d.id === t.device_id); return `Dispositivo: ${d?.name || "?"}`; }
      return t.target_type;
    })();

    if (t.segment_id) {
      const seg = segments.find((s: any) => s.id === t.segment_id);
      return `${seg?.name || "Segmento"} • ${raw}`;
    }
    return raw;
  };

  const hierarchyModel = useMemo(() => {
    const index = new Map<string, { type: HierarchyNodeType; id: string; label: string; deviceIds?: string[] }>();
    const regionsById = new Map(regions.map((r: any) => [r.id, r]));
    const statesById = new Map(statesData.map((s: any) => [s.id, s]));
    const citiesByState = new Map<string, any[]>();
    cities.forEach((c: any) => {
      if (!citiesByState.has(c.state_id)) citiesByState.set(c.state_id, []);
      citiesByState.get(c.state_id)!.push(c);
    });

    const storesByCity = new Map<string, any[]>();
    storesWithHierarchy.forEach((s: any) => {
      if (!s.city_id) return;
      if (!storesByCity.has(s.city_id)) storesByCity.set(s.city_id, []);
      storesByCity.get(s.city_id)!.push(s);
    });

    const sectorsById = new Map(sectors.map((s: any) => [s.id, s]));
    const devicesByStore = new Map<string, any[]>();
    devices.forEach((d: any) => {
      if (!d.store_id) return;
      if (!devicesByStore.has(d.store_id)) devicesByStore.set(d.store_id, []);
      devicesByStore.get(d.store_id)!.push(d);
    });

    const groupById = new Map(deviceGroups.map((g: any) => [g.id, g]));
    const deviceIdToGroupIds = new Map<string, string[]>();
    groupMembers.forEach((m: any) => {
      if (!deviceIdToGroupIds.has(m.device_id)) deviceIdToGroupIds.set(m.device_id, []);
      deviceIdToGroupIds.get(m.device_id)!.push(m.group_id);
    });

    const roots: HierarchyNode[] = statesData
      .slice()
      .sort((a: any, b: any) => (a.code || a.name || "").localeCompare(b.code || b.name || ""))
      .map((state: any) => {
        const stateKey = `state:${state.id}`;
        const stateLabel = state.code || state.name;
        index.set(stateKey, { type: "state", id: state.id, label: stateLabel });
        const region = state.region_id ? regionsById.get(state.region_id) : null;
        const regionNodes: HierarchyNode[] = region
          ? [{
            key: `region:${state.id}:${region.id}`,
            id: region.id,
            type: "region" as const,
            label: region.name,
            children: [],
          }]
          : [];
        if (region) index.set(`region:${state.id}:${region.id}`, { type: "region", id: region.id, label: region.name });

        const targetParent = regionNodes.length > 0 ? regionNodes[0] : null;
        const stateCities = (citiesByState.get(state.id) || []).slice().sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
        const cityNodes = stateCities.map((city: any) => {
          const cityKey = `city:${city.id}`;
          index.set(cityKey, { type: "city", id: city.id, label: city.name });
          const cityStores = (storesByCity.get(city.id) || []).slice().sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
          const storeNodes = cityStores.map((store: any) => {
            const storeKey = `store:${store.id}`;
            index.set(storeKey, { type: "store", id: store.id, label: store.name });
            const storeDevices = (devicesByStore.get(store.id) || []).slice().sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
            const sectorIds = [...new Set(storeDevices.map((d: any) => d.sector_id).filter(Boolean))] as string[];
            const sectorNodes = sectorIds
              .map((sid) => sectorsById.get(sid) ? ({ id: sid, name: sectorsById.get(sid)!.name }) : ({ id: sid, name: `Setor ${sid.slice(0, 6)}` }))
              .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
              .map((sec) => {
                const sectorKey = `sector:${store.id}:${sec.id}`;
                index.set(sectorKey, { type: "sector", id: sec.id, label: sec.name });
                const devicesInSector = storeDevices.filter((d: any) => d.sector_id === sec.id);
                const groupIds = [...new Set(devicesInSector.flatMap((d: any) => deviceIdToGroupIds.get(d.id) || []))] as string[];
                const groupNodes: HierarchyNode[] = groupIds
                  .map((gid) => groupById.get(gid) ? ({ id: gid, name: groupById.get(gid)!.name }) : ({ id: gid, name: `Grupo ${gid.slice(0, 6)}` }))
                  .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
                  .map((g) => {
                    const groupKey = `device_group:${store.id}:${sec.id}:${g.id}`;
                    const groupDeviceIds = devicesInSector.filter((d: any) => (deviceIdToGroupIds.get(d.id) || []).includes(g.id)).map((d: any) => d.id);
                    index.set(groupKey, { type: "device_group", id: g.id, label: g.name, deviceIds: groupDeviceIds });
                    const deviceNodes: HierarchyNode[] = groupDeviceIds
                      .map((did) => storeDevices.find((d: any) => d.id === did))
                      .filter(Boolean)
                      .sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""))
                      .map((d: any) => {
                        const deviceKey = `device:${d.id}`;
                        index.set(deviceKey, { type: "device", id: d.id, label: d.name || d.device_code || d.id });
                        return { key: deviceKey, id: d.id, type: "device" as const, label: d.name || d.device_code || d.id };
                      });
                    return { key: groupKey, id: g.id, type: "device_group" as const, label: g.name, children: deviceNodes };
                  });

                const ungrouped = devicesInSector.filter((d: any) => (deviceIdToGroupIds.get(d.id) || []).length === 0);
                if (ungrouped.length > 0) {
                  const unKey = `device_group:${store.id}:${sec.id}:__ungrouped__`;
                  index.set(unKey, { type: "device_group", id: "__ungrouped__", label: "Sem grupo", deviceIds: ungrouped.map((d: any) => d.id) });
                  const deviceNodes: HierarchyNode[] = ungrouped
                    .sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""))
                    .map((d: any) => {
                      const deviceKey = `device:${d.id}`;
                      index.set(deviceKey, { type: "device", id: d.id, label: d.name || d.device_code || d.id });
                      return { key: deviceKey, id: d.id, type: "device" as const, label: d.name || d.device_code || d.id };
                    });
                  groupNodes.push({ key: unKey, id: "__ungrouped__", type: "device_group" as const, label: "Sem grupo", children: deviceNodes });
                }

                return { key: sectorKey, id: sec.id, type: "sector" as const, label: sec.name, children: groupNodes };
              });

            return { key: storeKey, id: store.id, type: "store" as const, label: store.name, children: sectorNodes };
          });
          return { key: cityKey, id: city.id, type: "city" as const, label: city.name, children: storeNodes };
        });

        if (targetParent) targetParent.children = cityNodes;
        const children = targetParent ? regionNodes : cityNodes;
        return { key: stateKey, id: state.id, type: "state" as const, label: stateLabel, children };
      });

    return { roots, index, statesById };
  }, [cities, deviceGroups, devices, groupMembers, regions, sectors, statesData, storesWithHierarchy]);

  const hierarchyFilteredRoots = useMemo(() => {
    const q = hierarchySearch.trim().toLowerCase();
    if (!q) return hierarchyModel.roots;
    const filterNode = (node: HierarchyNode): HierarchyNode | null => {
      const selfMatch = node.label.toLowerCase().includes(q);
      const children = (node.children || []).map(filterNode).filter(Boolean) as HierarchyNode[];
      if (selfMatch || children.length > 0) return { ...node, children };
      return null;
    };
    return hierarchyModel.roots.map(filterNode).filter(Boolean) as HierarchyNode[];
  }, [hierarchyModel.roots, hierarchySearch]);

  const hierarchySelection = useMemo(() => {
    const stateIds = new Set<string>();
    const regionIds = new Set<string>();
    const cityIds = new Set<string>();
    const storeIds = new Set<string>();
    const sectorIds = new Set<string>();
    const deviceIds = new Set<string>();
    const deviceIdsFromGroups = new Set<string>();
    const labels: { key: string; label: string; type: HierarchyNodeType }[] = [];
    hierarchySelectedKeys.forEach((key) => {
      const item = hierarchyModel.index.get(key);
      if (!item) return;
      labels.push({ key, label: item.label, type: item.type });
      if (item.type === "state") stateIds.add(item.id);
      if (item.type === "region") regionIds.add(item.id);
      if (item.type === "city") cityIds.add(item.id);
      if (item.type === "store") storeIds.add(item.id);
      if (item.type === "sector") sectorIds.add(item.id);
      if (item.type === "device") deviceIds.add(item.id);
      if (item.type === "device_group") (item.deviceIds || []).forEach((id) => deviceIdsFromGroups.add(id));
    });
    return { stateIds, regionIds, cityIds, storeIds, sectorIds, deviceIds: new Set([...deviceIds, ...deviceIdsFromGroups]), labels };
  }, [hierarchyModel.index, hierarchySelectedKeys]);

  const hierarchyExpanded = useMemo(() => {
    const expandedStateIds = new Set<string>(hierarchySelection.stateIds);
    const expandedRegionIds = new Set<string>(hierarchySelection.regionIds);
    statesData.forEach((s: any) => {
      if (hierarchySelection.regionIds.has(s.region_id)) expandedStateIds.add(s.id);
      if (hierarchySelection.stateIds.has(s.id) && s.region_id) expandedRegionIds.add(s.region_id);
    });
    const expandedCityIds = new Set<string>(hierarchySelection.cityIds);
    cities.forEach((c: any) => { if (expandedStateIds.has(c.state_id)) expandedCityIds.add(c.id); });
    const expandedStoreIds = new Set<string>(hierarchySelection.storeIds);
    storesWithHierarchy.forEach((s: any) => { if (s.city_id && expandedCityIds.has(s.city_id)) expandedStoreIds.add(s.id); });
    const expandedSectorIds = new Set<string>(hierarchySelection.sectorIds);
    devices.forEach((d: any) => { if (d.sector_id && expandedStoreIds.has(d.store_id)) expandedSectorIds.add(d.sector_id); });
    const expandedDeviceIds = new Set<string>(hierarchySelection.deviceIds);
    devices.forEach((d: any) => {
      if (!d.id) return;
      if (expandedStoreIds.has(d.store_id) || (d.sector_id && expandedSectorIds.has(d.sector_id))) expandedDeviceIds.add(d.id);
    });
    return { expandedRegionIds, expandedStateIds, expandedCityIds, expandedStoreIds, expandedSectorIds, expandedDeviceIds };
  }, [cities, devices, hierarchySelection, statesData, storesWithHierarchy]);

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
    const hasHierarchyFilter =
      hierarchySelection.stateIds.size > 0 ||
      hierarchySelection.regionIds.size > 0 ||
      hierarchySelection.cityIds.size > 0 ||
      hierarchySelection.storeIds.size > 0 ||
      hierarchySelection.sectorIds.size > 0 ||
      hierarchySelection.deviceIds.size > 0;
    if (hasHierarchyFilter) {
      result = result.filter((c: any) => {
        const targets = c.campaign_targets || [];
        if (targets.length === 0) return true;
        return targets.some((t: any) => {
          if (t.target_type === "device" && t.device_id && hierarchyExpanded.expandedDeviceIds.has(t.device_id)) return true;
          if (t.target_type === "store" && t.store_id && hierarchyExpanded.expandedStoreIds.has(t.store_id)) return true;
          if (t.target_type === "sector" && t.sector_id && hierarchyExpanded.expandedSectorIds.has(t.sector_id)) return true;
          if (t.target_type === "city" && t.city_id && hierarchyExpanded.expandedCityIds.has(t.city_id)) return true;
          if (t.target_type === "state" && t.state_id && hierarchyExpanded.expandedStateIds.has(t.state_id)) return true;
          if (t.target_type === "region" && t.region_id && hierarchyExpanded.expandedRegionIds.has(t.region_id)) return true;
          return false;
        });
      });
    }
    return result;
  }, [campaigns, devices, groupMembers, hierarchyExpanded, hierarchySelection, search, selectedGroupId, storesWithHierarchy]);

  const filteredSegments = useMemo(() => {
    const q = segmentSearch.trim().toLowerCase();
    if (!q) return segments;
    return segments.filter((s) => (s.name || "").toLowerCase().includes(q));
  }, [segmentSearch, segments]);

  const segmentClauseIds = useMemo(() => {
    const ids = [...new Set(segmentTargets.map((t: any) => t.clause_id).filter(Boolean))] as string[];
    ids.sort((a, b) => a.localeCompare(b));
    return ids;
  }, [segmentTargets]);

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
  const devicesInSelectedGroup = useMemo(() => {
    if (selectedGroupId === "all") return [] as string[];
    return groupMembers.filter(m => m.group_id === selectedGroupId).map(m => m.device_id);
  }, [selectedGroupId, groupMembers]);
  const devicesInSelectedGroupDetails = useMemo(() => {
    const setIds = new Set(devicesInSelectedGroup);
    return devices.filter((d: any) => setIds.has(d.id));
  }, [devices, devicesInSelectedGroup]);
  const [updatingAllDevices, setUpdatingAllDevices] = useState(false);
  const updateAllDevicesInGroup = async () => {
    if (selectedGroupId === "all" || devicesInSelectedGroupDetails.length === 0) {
      toast({ title: "Nenhum dispositivo no grupo", variant: "destructive" });
      return;
    }
    setUpdatingAllDevices(true);
    try {
      const ids = devicesInSelectedGroupDetails.map((d: any) => d.id);
      const nowIso = new Date().toISOString();
      const { error: updErr } = await supabase
        .from("devices")
        .update({ last_sync_requested_at: nowIso, updated_at: nowIso })
        .in("id", ids);
      if (updErr) throw updErr;

      await Promise.all(
        devicesInSelectedGroupDetails.map(async (d: any) => {
          if (!d.device_code) return;
          const deviceRef = ref(db, `${d.device_code}`);
          await update(deviceRef, {
            "atualizacao_plataforma": "true",
            "device_id": d.id,
            "last-update": nowIso,
          });
        })
      );

      toast({ title: "Atualização enviada", description: `${ids.length} dispositivo(s) vão atualizar.` });
    } catch (e: any) {
      toast({ title: "Erro ao atualizar dispositivos", description: e.message || String(e), variant: "destructive" });
    } finally {
      setUpdatingAllDevices(false);
    }
  };

  const devicePlaylistQuery = useQuery({
    queryKey: ["device-playlist", selectedDeviceCodeForPreview],
    queryFn: async () => {
      if (!selectedDeviceCodeForPreview) return null;
      const url = `${SUPABASE_URL}/functions/v1/campaign-engine/playlist?device_code=${encodeURIComponent(selectedDeviceCodeForPreview)}`;
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) throw new Error(`Falha ao carregar playlist do dispositivo (${res.status})`);
      return await res.json();
    },
    enabled: !!selectedDeviceCodeForPreview,
  });
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

  // Only auto-select segment when on segments tab and nothing is selected
  useEffect(() => {
    if (viewMode === "segments" && !selectedSegmentId && segments.length > 0) setSelectedSegmentId(segments[0].id);
  }, [segments, selectedSegmentId, viewMode]);

  useEffect(() => {
    const segmentIds = [...new Set((detailTargets || []).map((t: any) => t.segment_id).filter(Boolean))] as string[];
    setSelectedSegmentForCampaign(segmentIds.length > 0 ? segmentIds[0] : null);
  }, [detailCampaignId, detailTargets]);

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
          <MediaThumbnail type={item.media?.type} fileUrl={item.media?.file_url} thumbnailUrl={item.media?.thumbnail_url} name={item.media?.name} />
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
          <MediaThumbnail type={media.type} fileUrl={media.file_url} thumbnailUrl={media.thumbnail_url} name={media.name} />
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

  const toggleHierarchyExpanded = (key: string) => {
    setHierarchyExpandedKeys((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  };
  const toggleHierarchySelected = (key: string) => {
    setHierarchySelectedKeys((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  };
  const clearHierarchySelection = () => {
    setHierarchySelectedKeys([]);
  };

  const HierarchyRowIcon = ({ type }: { type: HierarchyNodeType }) => {
    if (type === "state" || type === "region" || type === "city") return <MapPin className="h-3.5 w-3.5 text-muted-foreground" />;
    if (type === "store") return <Store className="h-3.5 w-3.5 text-muted-foreground" />;
    if (type === "sector") return <Layers className="h-3.5 w-3.5 text-muted-foreground" />;
    if (type === "device_group") return <Users className="h-3.5 w-3.5 text-muted-foreground" />;
    return <Monitor className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  const HierarchyTreeNode = ({ node, depth }: { node: HierarchyNode; depth: number }) => {
    const expanded = hierarchyExpandedKeys.includes(node.key);
    const selected = hierarchySelectedKeys.includes(node.key);
    const hasChildren = (node.children || []).length > 0;
    return (
      <div>
        <div
          className="flex items-center gap-2 py-1.5 rounded hover:bg-accent/30"
          style={{ paddingLeft: `${depth * 12}px` }}
        >
          <button
            type="button"
            className={`h-6 w-6 flex items-center justify-center rounded ${hasChildren ? "hover:bg-accent/40" : "opacity-0 pointer-events-none"}`}
            onClick={() => hasChildren && toggleHierarchyExpanded(node.key)}
            aria-label={expanded ? "Recolher" : "Expandir"}
          >
            {hasChildren ? (expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : null}
          </button>
          <Checkbox checked={selected} onCheckedChange={() => toggleHierarchySelected(node.key)} />
          <HierarchyRowIcon type={node.type} />
          <button
            type="button"
            className="flex-1 text-left text-sm truncate"
            onClick={() => hasChildren ? toggleHierarchyExpanded(node.key) : toggleHierarchySelected(node.key)}
          >
            {node.label}
          </button>
        </div>
        {hasChildren && expanded && (
          <div>
            {(node.children || []).map((ch) => (
              <HierarchyTreeNode key={ch.key} node={ch} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
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

        {/* Segment selector */}
        <div className="flex items-center gap-2">
          <SegmentsSelector
            segments={segments}
            value={selectedSegmentId}
            onValueChange={setSelectedSegmentId}
            placeholder="Selecionar segmento"
            stats={segmentStats}
          />
        </div>

        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setEditingGroup(null); setGroupForm({ name: "", description: "", is_default: false }); setGroupDialogOpen(true); }}>
          <FolderPlus className="h-4 w-4" /> Novo Grupo
        </Button>

        {selectedGroupId !== "all" && (
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
              const g = deviceGroups.find((g: any) => g.id === selectedGroupId);
              if (g) { setEditingGroup(g); setGroupForm({ name: g.name, description: g.description || "", is_default: g.is_default ?? false }); setGroupDialogOpen(true); }
            }}>
              <Pencil className="h-3.5 w-3.5" /> Atualizar grupo
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setAddDeviceGroupId(selectedGroupId); setSelectedDeviceIds(devicesInSelectedGroup); }}>
              <Plus className="h-3.5 w-3.5" /> Dispositivos
            </Button>
            <Button variant="secondary" size="sm" className="gap-1.5" onClick={updateAllDevicesInGroup} disabled={updatingAllDevices || devicesInSelectedGroupDetails.length === 0}>
              <RefreshCw className={`h-3.5 w-3.5 ${updatingAllDevices ? "animate-spin" : ""}`} /> Atualizar dispositivos
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Badge variant="secondary" className="text-xs cursor-pointer">{devicesInSelectedGroup.length} dispositivo(s)</Badge>
              </PopoverTrigger>
              <PopoverContent className="w-96">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Dispositivos no grupo</p>
                  {devicesInSelectedGroupDetails.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum dispositivo</p>
                  ) : (
                    <div className="max-h-64 overflow-auto border rounded-md divide-y">
                      {devicesInSelectedGroupDetails.map((d: any) => (
                        <div key={d.id} className="px-3 py-2 flex items-center gap-2">
                          <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{d.name || d.device_code}</p>
                            <p className="text-[10px] text-muted-foreground font-mono truncate">{d.device_code}</p>
                          </div>
                          <Button size="sm" className="h-7 px-2 text-xs" variant="outline" onClick={() => setSelectedDeviceCodeForPreview(d.device_code)}>Preview</Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
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
        <Button variant={viewMode === "hierarchy" ? "default" : "ghost"} size="sm" className="gap-1.5" onClick={() => setViewMode("hierarchy")}>
          <Network className="h-4 w-4" /> Hierarquia
        </Button>
        <Button variant={viewMode === "campaigns" ? "default" : "ghost"} size="sm" className="gap-1.5" onClick={() => setViewMode("campaigns")}>
          <Target className="h-4 w-4" /> Campanhas
        </Button>
        <Button variant={viewMode === "segments" ? "default" : "ghost"} size="sm" className="gap-1.5" onClick={() => setViewMode("segments")}>
          <ListFilter className="h-4 w-4" /> Segmentos
        </Button>
        <Button variant={viewMode === "timeline" ? "default" : "ghost"} size="sm" className="gap-1.5" onClick={() => setViewMode("timeline")}>
          <Calendar className="h-4 w-4" /> Timeline
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
              if (g) { setEditingGroup(g); setGroupForm({ name: g.name, description: g.description || "", is_default: g.is_default ?? false }); setGroupDialogOpen(true); }
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

      {/* ═══ VIEW: HIERARCHY ═══ */}
      {viewMode === "hierarchy" && (
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4" style={{ height: "calc(100vh - 20rem)" }}>
          <Card className="p-4 flex flex-col min-h-0">
            <div className="flex items-center gap-2 mb-3">
              <Network className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Hierarquia de Reprodução</p>
              <div className="ml-auto flex items-center gap-2">
                {hierarchySelectedKeys.length > 0 && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={clearHierarchySelection}>
                    Limpar
                  </Button>
                )}
              </div>
            </div>
            <Input placeholder="Filtrar hierarquia..." value={hierarchySearch} onChange={(e) => setHierarchySearch(e.target.value)} className="mb-3" />
            {hierarchySelection.labels.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {hierarchySelection.labels.slice(0, 12).map((it) => (
                  <Badge key={it.key} variant="secondary" className="gap-1 pr-1">
                    {it.label}
                    <button type="button" className="ml-1 text-muted-foreground hover:text-foreground" onClick={() => setHierarchySelectedKeys((p) => p.filter((k) => k !== it.key))}>
                      ×
                    </button>
                  </Badge>
                ))}
                {hierarchySelection.labels.length > 12 && (
                  <Badge variant="outline">+{hierarchySelection.labels.length - 12}</Badge>
                )}
              </div>
            )}
            <div className="flex-1 min-h-0 border border-border rounded-lg overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-2">
                  {hierarchyFilteredRoots.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Nada encontrado</p>
                  ) : (
                    hierarchyFilteredRoots.map((n) => <HierarchyTreeNode key={n.key} node={n} depth={0} />)
                  )}
                </div>
              </ScrollArea>
            </div>
          </Card>

          <div className="flex flex-col min-h-0">
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

            <div className="flex-1 min-h-0 border border-border rounded-lg bg-card overflow-hidden">
              <ScrollArea className="h-full">
                {filteredCampaigns.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhuma campanha encontrada</p>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredCampaigns.map((c: any) => {
                      const status = getStatus(c);
                      const color = colorMap[c.id] || "#888";
                      const pri = PRIORITY_LABELS[c.priority] || { label: `P${c.priority}` };
                      const typeLabel = CAMPAIGN_TYPES.find(t => t.value === c.campaign_type)?.label || c.campaign_type;
                      return (
                        <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/30" style={{ borderLeft: `4px solid ${color}` }}>
                          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[status]}`} />
                          <span className="flex-1 text-sm font-medium truncate">{c.name}</span>
                          <Badge variant="outline" className="text-[10px] hidden lg:inline-flex">{typeLabel}</Badge>
                          <Badge variant="secondary" className="text-[10px] hidden md:inline-flex">{pri.label}</Badge>
                          <Button variant="outline" size="sm" className="gap-1 text-xs h-7 text-primary" onClick={() => { setDetailCampaignId(c.id); setDetailTab("contents"); }}>
                            <Layers className="h-3 w-3" /> Detalhes
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>

            <div className="shrink-0 mt-3">
            <div className="flex items-center gap-3 mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {selectedDeviceCodeForPreview ? `Preview — dispositivo ${selectedDeviceCodeForPreview}` : "Preview — Sequência de exibição"}
              </p>
              <div className="ml-auto flex items-center gap-3">
                {devicesInSelectedGroupDetails.length > 0 && (
                  <>
                    <span className="text-[10px] text-muted-foreground">Dispositivo:</span>
                    <Select
                      value={selectedDeviceCodeForPreview || DEVICE_ALL_VALUE}
                      onValueChange={(v) => setSelectedDeviceCodeForPreview(v === DEVICE_ALL_VALUE ? "" : v)}
                    >
                      <SelectTrigger className="h-7 w-56 text-xs">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={DEVICE_ALL_VALUE}>Todos</SelectItem>
                        {devicesInSelectedGroupDetails.map((d: any) => (
                          <SelectItem key={d.id} value={d.device_code}>{d.name || d.device_code}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
                  <div className="flex items-center gap-1">
                    <button
                      className="text-muted-foreground hover:text-foreground p-1 rounded"
                      onClick={() => setPreviewZoom((z) => Math.max(previewZoomMin, z - 10))}
                      title="Diminuir zoom"
                      type="button"
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
                      type="button"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{previewZoom}%</span>
                </div>
              </div>
            {selectedDeviceCodeForPreview && devicePlaylistQuery.isError && (
              <Alert variant="destructive" className="mb-2">
                <AlertCircle className="h-4 w-4" />
                <div>
                  <AlertTitle>Erro ao carregar preview do dispositivo</AlertTitle>
                  <AlertDescription>{(devicePlaylistQuery.error as any)?.message || "Erro desconhecido"}</AlertDescription>
                </div>
              </Alert>
            )}
            {selectedDeviceCodeForPreview && (devicePlaylistQuery.data as any)?.items ? (
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {(devicePlaylistQuery.data as any).items.map((it: any, idx: number) => (
                  <div key={it.id ?? idx} className="border rounded-md p-2 bg-card shrink-0" style={{ width: (previewBaseWidth * previewZoom) / 100 }}>
                    <div className="text-[10px] text-muted-foreground mb-1 truncate">{it.campaign_name}</div>
                    {it.media?.file_url ? (
                      it.media.type === "video" || /\\.(mp4|webm|mov)$/i.test(it.media.file_url) ? (
                        <div className="w-full h-[64px] bg-muted flex items-center justify-center text-[10px]">vídeo</div>
                      ) : (
                        <img src={it.media.file_url} alt={it.media.name} className="w-full h-[64px] object-cover rounded" />
                      )
                    ) : (
                      <div className="w-full h-[64px] bg-muted rounded" />
                    )}
                    <div className="mt-1 text-xs font-medium truncate">{it.media?.name || "Conteúdo"}</div>
                    <div className="text-[10px] text-muted-foreground">duração: {it.media?.duration ?? "-" }s</div>
                  </div>
                ))}
                {(devicePlaylistQuery.data as any).items.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhum conteúdo para este dispositivo</p>
                )}
              </div>
            ) : allContents.length > 0 ? (
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

                        {/* Segment link/unlink toggle */}
                        {selectedSegmentId && (() => {
                          const campaignTargets = c.campaign_targets || [];
                          const isLinked = campaignTargets.some((t: any) => t.segment_id === selectedSegmentId);
                          return isLinked ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              className="gap-1 text-xs h-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                unlinkSegmentFromCampaign.mutate({ campaignId: c.id, segmentId: selectedSegmentId });
                              }}
                              disabled={unlinkSegmentFromCampaign.isPending}
                            >
                              <Minus className="h-3 w-3" /> Remover segmento
                            </Button>
                          ) : (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="gap-1 text-xs h-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                linkSegmentToCampaign.mutate({ campaignId: c.id, segmentId: selectedSegmentId });
                              }}
                              disabled={linkSegmentToCampaign.isPending}
                            >
                              <Plus className="h-3 w-3" /> Vincular segmento
                            </Button>
                          );
                        })()}

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
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {selectedDeviceCodeForPreview ? `Preview — dispositivo ${selectedDeviceCodeForPreview}` : "Preview — Sequência de exibição"}
              </p>
              <div className="ml-auto flex items-center gap-3">
                {devicesInSelectedGroupDetails.length > 0 && (
                  <>
                    <span className="text-[10px] text-muted-foreground">Dispositivo:</span>
                    <Select
                      value={selectedDeviceCodeForPreview || DEVICE_ALL_VALUE}
                      onValueChange={(v) => setSelectedDeviceCodeForPreview(v === DEVICE_ALL_VALUE ? "" : v)}
                    >
                      <SelectTrigger className="h-7 w-56 text-xs">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={DEVICE_ALL_VALUE}>Todos</SelectItem>
                        {devicesInSelectedGroupDetails.map((d: any) => (
                          <SelectItem key={d.id} value={d.device_code}>{d.name || d.device_code}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
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
            {selectedDeviceCodeForPreview && devicePlaylistQuery.isError && (
              <Alert variant="destructive" className="mb-2">
                <AlertCircle className="h-4 w-4" />
                <div>
                  <AlertTitle>Erro ao carregar preview do dispositivo</AlertTitle>
                  <AlertDescription>{(devicePlaylistQuery.error as any)?.message || "Erro desconhecido"}</AlertDescription>
                </div>
              </Alert>
            )}
            {selectedDeviceCodeForPreview && (devicePlaylistQuery.data as any)?.items ? (
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {(devicePlaylistQuery.data as any).items.map((it: any, idx: number) => (
                  <div key={it.id ?? idx} className="border rounded-md p-2 bg-card shrink-0" style={{ width: (previewBaseWidth * previewZoom) / 100 }}>
                    <div className="text-[10px] text-muted-foreground mb-1 truncate">{it.campaign_name}</div>
                    {it.media ? (
                      <div className="w-full h-[64px] rounded overflow-hidden">
                        <MediaThumbnail type={it.media.type} fileUrl={it.media.file_url} thumbnailUrl={it.media.thumbnail_url} name={it.media.name} />
                      </div>
                    ) : (
                      <div className="w-full h-[64px] bg-muted rounded" />
                    )}
                    <div className="mt-1 text-xs font-medium truncate">{it.media?.name || "Conteúdo"}</div>
                    <div className="text-[10px] text-muted-foreground">duração: {it.media?.duration ?? "-" }s</div>
                  </div>
                ))}
                {(devicePlaylistQuery.data as any).items.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhum conteúdo para este dispositivo</p>
                )}
              </div>
            ) : allContents.length > 0 ? (
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

                      {selectedSegmentId && (() => {
                        const campaignTargets = c.campaign_targets || [];
                        const isLinked = campaignTargets.some((t: any) => t.segment_id === selectedSegmentId);
                        return isLinked ? (
                          <Button variant="destructive" size="sm" className="gap-1 text-xs h-7" onClick={() => unlinkSegmentFromCampaign.mutate({ campaignId: c.id, segmentId: selectedSegmentId })} disabled={unlinkSegmentFromCampaign.isPending}>
                            <Minus className="h-3 w-3" /> Remover
                          </Button>
                        ) : (
                          <Button variant="secondary" size="sm" className="gap-1 text-xs h-7" onClick={() => linkSegmentToCampaign.mutate({ campaignId: c.id, segmentId: selectedSegmentId })} disabled={linkSegmentToCampaign.isPending}>
                            <Plus className="h-3 w-3" /> Vincular
                          </Button>
                        );
                      })()}

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

      {/* ═══ VIEW: SEGMENTS ═══ */}
      {viewMode === "segments" && (
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
          <Card className="p-4 flex flex-col min-h-0">
            <div className="flex items-center gap-2 mb-3">
              <ListFilter className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Segmentos</p>
              <div className="ml-auto">
                <Button
                  size="sm"
                  className="h-7"
                  onClick={() => {
                    setEditingSegmentId(null);
                    setSegmentForm({ name: "", description: "" });
                    setSegmentDialogOpen(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Novo
                </Button>
              </div>
            </div>

            <Input placeholder="Buscar segmento..." value={segmentSearch} onChange={(e) => setSegmentSearch(e.target.value)} className="mb-3" />

            <ScrollArea className="flex-1">
              <div className="space-y-2 pr-3">
                {filteredSegments.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-6 text-center">Nenhum segmento</p>
                ) : (
                  filteredSegments.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedSegmentId(s.id)}
                      className={`w-full text-left rounded-md border px-3 py-2 hover:bg-accent/30 transition-colors ${selectedSegmentId === s.id ? "border-primary/50 bg-primary/5" : "border-border"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">{s.name}</span>
                        {selectedSegmentId === s.id && <Badge variant="secondary" className="text-[10px]">Selecionado</Badge>}
                      </div>
                      {s.description && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{s.description}</p>}
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </Card>

          <Card className="p-4">
            {!selectedSegmentId ? (
              <p className="text-sm text-muted-foreground">Selecione um segmento para editar regras.</p>
            ) : (
              (() => {
                const seg = segments.find((s) => s.id === selectedSegmentId);
                const includeTargets = segmentTargets.filter((t: any) => t.include);
                const excludeTargets = segmentTargets.filter((t: any) => !t.include);
                const includeByClause = includeTargets.reduce((acc: Record<string, any[]>, t: any) => {
                  const key = t.clause_id || "sem-clausula";
                  if (!acc[key]) acc[key] = [];
                  acc[key].push(t);
                  return acc;
                }, {});

                const ensureSegmentTargetReady = () => {
                  if (!selectedSegmentId) return false;
                  const tt = segmentTargetForm.target_type;
                  if (tt === "state" && !segmentTargetForm.state_id) return false;
                  if (tt === "region" && !segmentTargetForm.region_id) return false;
                  if (tt === "city" && !segmentTargetForm.city_id) return false;
                  if (tt === "store" && !segmentTargetForm.store_id) return false;
                  if (tt === "sector" && !segmentTargetForm.sector_id) return false;
                  if (tt === "device_group" && !segmentTargetForm.device_group_id) return false;
                  if (tt === "device" && !segmentTargetForm.device_id) return false;
                  if (tt === "tag" && !segmentTargetForm.tag_id) return false;
                  return true;
                };

                return (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{seg?.name || "Segmento"}</h3>
                        {seg?.description && <p className="text-xs text-muted-foreground mt-1">{seg.description}</p>}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => {
                            if (!seg) return;
                            setEditingSegmentId(seg.id);
                            setSegmentForm({ name: seg.name, description: seg.description || "" });
                            setSegmentDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-destructive"
                          onClick={() => {
                            if (!seg) return;
                            if (confirm(`Excluir segmento "${seg.name}"?`)) {
                              deleteSegment.mutate(seg.id, { onSuccess: () => setSelectedSegmentId(null) });
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{segmentStats?.device_count ?? 0} dispositivos</Badge>
                      <Badge variant="secondary">{segmentStats?.store_count ?? 0} lojas</Badge>
                      <Badge variant="outline" className="text-[10px]">{segmentTargets.length} regra(s)</Badge>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label>Novo filtro</Label>
                          <div className="grid grid-cols-2 gap-2">
                            <Select
                              value={segmentTargetForm.include ? "include" : "exclude"}
                              onValueChange={(v) => setSegmentTargetForm((p) => ({ ...p, include: v === "include" }))}
                            >
                              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="include">Incluir</SelectItem>
                                <SelectItem value="exclude">Excluir</SelectItem>
                              </SelectContent>
                            </Select>

                            <Select value={segmentTargetForm.clause_id} onValueChange={(v) => setSegmentTargetForm((p) => ({ ...p, clause_id: v }))}>
                              <SelectTrigger className="h-9"><SelectValue placeholder="Cláusula" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__new__">Nova cláusula</SelectItem>
                                {segmentClauseIds.map((id) => (
                                  <SelectItem key={id} value={id}>{id}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <Select value={segmentTargetForm.target_type} onValueChange={(v) => setSegmentTargetForm((p) => ({ ...p, target_type: v }))}>
                              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="state">Estado</SelectItem>
                                <SelectItem value="region">Região</SelectItem>
                                <SelectItem value="city">Cidade</SelectItem>
                                <SelectItem value="store">Loja</SelectItem>
                                <SelectItem value="sector">Setor</SelectItem>
                                <SelectItem value="device_group">Grupo</SelectItem>
                                <SelectItem value="device">Dispositivo</SelectItem>
                                <SelectItem value="tag">Tag</SelectItem>
                              </SelectContent>
                            </Select>

                            {segmentTargetForm.target_type === "state" && (
                              <Select value={segmentTargetForm.state_id} onValueChange={(v) => setSegmentTargetForm((p) => ({ ...p, state_id: v }))}>
                                <SelectTrigger className="h-9"><SelectValue placeholder="Estado" /></SelectTrigger>
                                <SelectContent>
                                  {statesData.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.code || s.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            )}
                            {segmentTargetForm.target_type === "region" && (
                              <Select value={segmentTargetForm.region_id} onValueChange={(v) => setSegmentTargetForm((p) => ({ ...p, region_id: v }))}>
                                <SelectTrigger className="h-9"><SelectValue placeholder="Região" /></SelectTrigger>
                                <SelectContent>
                                  {regions.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            )}
                            {segmentTargetForm.target_type === "city" && (
                              <Select value={segmentTargetForm.city_id} onValueChange={(v) => setSegmentTargetForm((p) => ({ ...p, city_id: v }))}>
                                <SelectTrigger className="h-9"><SelectValue placeholder="Cidade" /></SelectTrigger>
                                <SelectContent>
                                  {cities.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            )}
                            {segmentTargetForm.target_type === "store" && (
                              <Select value={segmentTargetForm.store_id} onValueChange={(v) => setSegmentTargetForm((p) => ({ ...p, store_id: v }))}>
                                <SelectTrigger className="h-9"><SelectValue placeholder="Loja" /></SelectTrigger>
                                <SelectContent>
                                  {stores.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            )}
                            {segmentTargetForm.target_type === "sector" && (
                              <Select value={segmentTargetForm.sector_id} onValueChange={(v) => setSegmentTargetForm((p) => ({ ...p, sector_id: v }))}>
                                <SelectTrigger className="h-9"><SelectValue placeholder="Setor" /></SelectTrigger>
                                <SelectContent>
                                  {sectors.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            )}
                            {segmentTargetForm.target_type === "device_group" && (
                              <Select value={segmentTargetForm.device_group_id} onValueChange={(v) => setSegmentTargetForm((p) => ({ ...p, device_group_id: v }))}>
                                <SelectTrigger className="h-9"><SelectValue placeholder="Grupo" /></SelectTrigger>
                                <SelectContent>
                                  {deviceGroups.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            )}
                            {segmentTargetForm.target_type === "device" && (
                              <Select value={segmentTargetForm.device_id} onValueChange={(v) => setSegmentTargetForm((p) => ({ ...p, device_id: v }))}>
                                <SelectTrigger className="h-9"><SelectValue placeholder="Dispositivo" /></SelectTrigger>
                                <SelectContent>
                                  {devices.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            )}
                            {segmentTargetForm.target_type === "tag" && (
                              <Select value={segmentTargetForm.tag_id} onValueChange={(v) => setSegmentTargetForm((p) => ({ ...p, tag_id: v }))}>
                                <SelectTrigger className="h-9"><SelectValue placeholder="Tag" /></SelectTrigger>
                                <SelectContent>
                                  {tags.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        </div>

                        <Button
                          size="sm"
                          className="h-9"
                          disabled={!ensureSegmentTargetReady() || addSegmentFilter.isPending}
                          onClick={() => {
                            if (!selectedSegmentId) return;
                            if (!ensureSegmentTargetReady()) return;
                            const clauseId =
                              segmentTargetForm.clause_id && segmentTargetForm.clause_id !== "__new__"
                                ? segmentTargetForm.clause_id
                                : undefined;

                            const payload: any = {
                              segment_id: selectedSegmentId,
                              include: segmentTargetForm.include,
                              target_type: segmentTargetForm.target_type,
                            };
                            if (clauseId) payload.clause_id = clauseId;
                            if (segmentTargetForm.target_type === "state") payload.state_id = segmentTargetForm.state_id;
                            if (segmentTargetForm.target_type === "region") payload.region_id = segmentTargetForm.region_id;
                            if (segmentTargetForm.target_type === "city") payload.city_id = segmentTargetForm.city_id;
                            if (segmentTargetForm.target_type === "store") payload.store_id = segmentTargetForm.store_id;
                            if (segmentTargetForm.target_type === "sector") payload.sector_id = segmentTargetForm.sector_id;
                            if (segmentTargetForm.target_type === "device_group") payload.device_group_id = segmentTargetForm.device_group_id;
                            if (segmentTargetForm.target_type === "device") payload.device_id = segmentTargetForm.device_id;
                            if (segmentTargetForm.target_type === "tag") payload.tag_id = segmentTargetForm.tag_id;

                            addSegmentFilter.mutate(payload, {
                              onSuccess: () => {
                                setSegmentTargetForm((p) => ({ ...p, state_id: "", region_id: "", city_id: "", store_id: "", sector_id: "", device_group_id: "", device_id: "", tag_id: "" }));
                              },
                            });
                          }}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar regra
                        </Button>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label>Regras (inclui)</Label>
                          {includeTargets.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Nenhuma regra de inclusão.</p>
                          ) : (
                            <div className="space-y-2">
                              {Object.entries(includeByClause).map(([clauseId, items], idx) => (
                                <div key={clauseId} className="rounded-md border border-border p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-semibold">Cláusula {idx + 1}</p>
                                    <Badge variant="outline" className="text-[10px]">{clauseId}</Badge>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {items.map((t: any) => (
                                      <Badge key={t.id} variant="secondary" className="gap-1 pr-1">
                                        <span className="truncate max-w-[240px]">{getTargetLabel(t)}</span>
                                        <button
                                          type="button"
                                          className="ml-1 text-muted-foreground hover:text-foreground"
                                          onClick={() => removeSegmentFilter.mutate({ id: t.id, segmentId: selectedSegmentId })}
                                          title="Remover"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="space-y-1">
                          <Label>Regras (exclui)</Label>
                          {excludeTargets.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Nenhuma regra de exclusão.</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {excludeTargets.map((t: any) => (
                                <Badge key={t.id} variant="outline" className="gap-1 pr-1">
                                  <span className="truncate max-w-[240px]">{getTargetLabel(t)}</span>
                                  <button
                                    type="button"
                                    className="ml-1 text-muted-foreground hover:text-foreground"
                                    onClick={() => removeSegmentFilter.mutate({ id: t.id, segmentId: selectedSegmentId })}
                                    title="Remover"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </Card>
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

      {/* ═══ Segment Create/Edit Dialog ═══ */}
      <Dialog open={segmentDialogOpen} onOpenChange={setSegmentDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingSegmentId ? "Editar Segmento" : "Novo Segmento"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Nome</Label>
              <Input value={segmentForm.name} onChange={(e) => setSegmentForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={segmentForm.description} onChange={(e) => setSegmentForm((p) => ({ ...p, description: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSegmentDialogOpen(false); setEditingSegmentId(null); }}>Cancelar</Button>
            <Button
              onClick={() => {
                const name = segmentForm.name.trim();
                if (!name) return;
                if (editingSegmentId) {
                  updateSegment.mutate(
                    { id: editingSegmentId, name, description: segmentForm.description },
                    { onSuccess: () => { setSegmentDialogOpen(false); setEditingSegmentId(null); } }
                  );
                } else {
                  createSegment.mutate(
                    { name, description: segmentForm.description },
                    {
                      onSuccess: (res: any) => {
                        if (res?.id) setSelectedSegmentId(res.id);
                        setSegmentDialogOpen(false);
                      },
                    }
                  );
                }
              }}
              disabled={!segmentForm.name.trim()}
            >
              {editingSegmentId ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                          return (
                            <div className="rounded-lg bg-background border border-border shadow-lg p-2">
                              <div className="aspect-video rounded-md overflow-hidden bg-muted border border-border">
                                <MediaThumbnail type={item.media?.type} fileUrl={item.media?.file_url} thumbnailUrl={item.media?.thumbnail_url} name={item.media?.name} />
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
              <Card className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">Segmento</p>
                    <p className="text-xs text-muted-foreground">Vincule um segmento para aplicar automaticamente as regras.</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <SegmentsSelector
                    segments={segments}
                    value={selectedSegmentForCampaign}
                    onValueChange={setSelectedSegmentForCampaign}
                    stats={selectedSegmentForCampaignStats ?? null}
                    disabled={!detailCampaignId}
                  />
                  <Button
                    size="sm"
                    className="h-9"
                    disabled={!detailCampaignId || !selectedSegmentForCampaign || linkSegmentToCampaign.isPending}
                    onClick={() => {
                      if (!detailCampaignId || !selectedSegmentForCampaign) return;
                      linkSegmentToCampaign.mutate({ campaignId: detailCampaignId, segmentId: selectedSegmentForCampaign });
                    }}
                  >
                    Vincular
                  </Button>
                  {(() => {
                    const segmentIds = [...new Set(detailTargets.map((t: any) => t.segment_id).filter(Boolean))] as string[];
                    const linkedSegmentId = segmentIds.length > 0 ? segmentIds[0] : null;
                    return (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9"
                        disabled={!detailCampaignId || !linkedSegmentId || unlinkSegmentFromCampaign.isPending}
                        onClick={() => {
                          if (!detailCampaignId || !linkedSegmentId) return;
                          unlinkSegmentFromCampaign.mutate({ campaignId: detailCampaignId, segmentId: linkedSegmentId });
                        }}
                      >
                        Remover
                      </Button>
                    );
                  })()}
                </div>
                {(() => {
                  const segmentIds = [...new Set(detailTargets.map((t: any) => t.segment_id).filter(Boolean))] as string[];
                  const linkedSegmentId = segmentIds.length > 0 ? segmentIds[0] : null;
                  const linkedSeg = linkedSegmentId ? segments.find((s) => s.id === linkedSegmentId) : null;
                  const hasLegacy = detailTargets.some((t: any) => !t.segment_id);
                  return (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {linkedSeg ? (
                        <Badge variant="secondary" className="text-[10px]">Vinculado: {linkedSeg.name}</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Nenhum segmento vinculado</Badge>
                      )}
                      {hasLegacy && <Badge variant="outline" className="text-[10px]">Também há regras manuais</Badge>}
                    </div>
                  );
                })()}
              </Card>

              {detailTargets.length > 0 ? (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Segmentações ativas</Label>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const segmentIds = [...new Set(detailTargets.map((t: any) => t.segment_id).filter(Boolean))] as string[];
                      const onlySegmentTargets = segmentIds.length === 1 && detailTargets.every((t: any) => !!t.segment_id);
                      if (onlySegmentTargets) {
                        const seg = segments.find((s) => s.id === segmentIds[0]);
                        return (
                          <Badge variant="secondary" className="gap-1 pr-1">
                            Segmento: {seg?.name || "?"} • {detailTargets.length} regra(s)
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 ml-1"
                              onClick={() => detailCampaignId && unlinkSegmentFromCampaign.mutate({ campaignId: detailCampaignId, segmentId: segmentIds[0] })}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </Badge>
                        );
                      }

                      return detailTargets.map((t: any) => (
                        <Badge key={t.id} variant="secondary" className="gap-1 pr-1">
                          {getTargetLabel(t)}
                          {!t.segment_id && (
                            <Button variant="ghost" size="icon" className="h-4 w-4 ml-1" onClick={() => removeTarget.mutate(t.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </Badge>
                      ));
                    })()}
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
                        <div className="w-8 h-5 rounded overflow-hidden">
                          <MediaThumbnail type={m.type} fileUrl={m.file_url} thumbnailUrl={m.thumbnail_url} name={m.name} />
                        </div>
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
            {previewMedia?.type === "webview" ? (
              <iframe src={previewMedia.file_url || ""} className="w-full h-[70vh] border-0 rounded" title={previewMedia.name} sandbox="allow-scripts allow-same-origin allow-popups allow-forms" />
            ) : previewMedia?.file_url && (previewMedia.type === "video" || previewMedia.file_url?.match(/\.(mp4|webm|mov)$/i)) ? (
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
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_default_group" checked={groupForm.is_default} onChange={e => setGroupForm({ ...groupForm, is_default: e.target.checked })} className="h-4 w-4 rounded border-border" />
              <Label htmlFor="is_default_group" className="text-sm font-normal cursor-pointer">Grupo padrão <span className="text-muted-foreground">(novos dispositivos serão atribuídos automaticamente)</span></Label>
            </div>
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
