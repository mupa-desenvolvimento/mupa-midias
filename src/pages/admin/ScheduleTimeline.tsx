import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Plus, Search, Pencil, CheckCircle2, Monitor, Store, MapPin, Tag, Users, Info, ChevronDown
} from "lucide-react";

// Distinct campaign colors for the timeline
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

const ScheduleTimeline = () => {
  const [search, setSearch] = useState("");
  const [targetType, setTargetType] = useState("all");
  const [targetValue, setTargetValue] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [groupLabel, setGroupLabel] = useState("TODAS AS CAMPANHAS");

  // Data queries
  const { data: campaigns = [] } = useQuery({
    queryKey: ["schedule-campaigns"],
    queryFn: async () => {
      const { data } = await supabase
        .from("campaigns")
        .select("*, campaign_contents(id, media:media_items(id, name, type, file_url, duration), position, duration_override), campaign_targets(id, target_type, state_id, tag_id, sector_id, store_id, device_id, region_id)")
        .eq("is_active", true)
        .order("priority", { ascending: true });
      return data || [];
    },
  });

  const { data: stores = [] } = useQuery({
    queryKey: ["stores-schedule"],
    queryFn: async () => { const { data } = await supabase.from("stores").select("id, name").order("name"); return data || []; },
  });

  const { data: devices = [] } = useQuery({
    queryKey: ["devices-schedule"],
    queryFn: async () => { const { data } = await supabase.from("devices").select("id, name, device_code, store_id").eq("is_active", true).order("name").limit(200); return data || []; },
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
    queryFn: async () => { const { data } = await supabase.from("tags").select("id, name, color").order("name"); return data || []; },
  });

  // Filter campaigns
  const filteredCampaigns = useMemo(() => {
    let result = campaigns;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c: any) => c.name?.toLowerCase().includes(q));
    }
    if (targetType !== "all" && targetValue) {
      result = result.filter((c: any) => {
        const targets = c.campaign_targets || [];
        if (targets.length === 0) return true;
        return targets.some((t: any) => {
          if (targetType === "device" && t.target_type === "device" && t.device_id === targetValue) return true;
          if (targetType === "store" && t.target_type === "store" && t.store_id === targetValue) return true;
          if (targetType === "region" && t.target_type === "region" && t.region_id === targetValue) return true;
          if (targetType === "tag" && t.target_type === "tag" && t.tag_id === targetValue) return true;
          return false;
        });
      });
    }
    return result;
  }, [campaigns, search, targetType, targetValue]);

  // Color map for campaigns
  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    campaigns.forEach((c: any, i: number) => {
      map[c.id] = CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length];
    });
    return map;
  }, [campaigns]);

  const selectedCampaign = campaigns.find((c: any) => c.id === selectedCampaignId);
  const selectedContents = selectedCampaign?.campaign_contents || [];

  const getStatus = (c: any) => {
    if (!c.is_active) return "paused";
    if (c.end_date && new Date(c.end_date) < new Date()) return "expired";
    if (c.status === "draft") return "draft";
    return "active";
  };

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
    const labels: Record<string, string> = {
      all: "TODAS AS CAMPANHAS",
      device: "DISPOSITIVO",
      group: "GRUPO",
      store: "LOJA",
      region: "REGIÃO",
      tag: "TAG",
    };
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
      {/* Top bar: Target selector + Search + New campaign */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Target type selector */}
        <div className="flex items-center gap-2 border border-border rounded-md px-3 py-1.5 bg-card">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{groupLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </div>

        <Select value={targetType} onValueChange={handleTargetTypeChange}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Veicular em..." />
          </SelectTrigger>
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
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Selecionar..." />
            </SelectTrigger>
            <SelectContent>
              {targetOptions.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar uma campanha"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          <Button className="gap-1.5" size="sm">
            <Plus className="h-4 w-4" />
            Nova campanha
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

                return (
                  <div
                    key={c.id}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-accent/40 ${isSelected ? "bg-accent/60" : ""}`}
                    onClick={() => setSelectedCampaignId(isSelected ? null : c.id)}
                  >
                    {/* Status dot */}
                    <div className={`w-3 h-3 rounded-full shrink-0 ${STATUS_DOT[status] || "bg-gray-400"}`} />

                    {/* Campaign color bar */}
                    <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: color }} />

                    {/* Campaign name */}
                    <span className="flex-1 text-sm font-medium truncate">{c.name}</span>

                    {/* Period badge */}
                    {c.start_date && (
                      <span className="text-[10px] text-muted-foreground font-mono hidden md:inline">
                        {new Date(c.start_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                        {c.end_date && ` → ${new Date(c.end_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`}
                      </span>
                    )}

                    {/* Contents count */}
                    {contentsCount > 0 && (
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3.5 w-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>{contentsCount} mídia(s)</TooltipContent>
                      </Tooltip>
                    )}

                    {/* Actions */}
                    <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">
                      <Pencil className="h-3 w-3" /> Editar
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1 text-xs h-7">
                      <CheckCircle2 className="h-3 w-3" /> Adicionar
                    </Button>
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
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              Atualizar grupo
            </Button>
            <Button size="sm" className="gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> Adicionar conteúdo
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
                      {/* Thumbnail */}
                      <div className="relative h-24 rounded-lg overflow-hidden bg-muted border border-border">
                        {isImage && media.file_url ? (
                          <img src={media.file_url} alt={media.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                            {media.type || "Mídia"}
                          </div>
                        )}
                      </div>
                      {/* Name */}
                      <p className="text-xs font-medium truncate mt-1.5">{media.name}</p>
                      {/* Campaign label */}
                      <div
                        className="mt-1 rounded px-2 py-0.5 text-[10px] font-bold text-white truncate text-center"
                        style={{ backgroundColor: color }}
                      >
                        {selectedCampaign.name}
                      </div>
                    </div>
                  );
                })}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Timeline visualization */}
      {filteredCampaigns.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-3">Timeline de Programação</h3>
          <div className="border border-border rounded-lg bg-card p-4 overflow-x-auto">
            {/* Hours header */}
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

            {/* Campaign rows */}
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
                      <div
                        className="absolute top-0.5 bottom-0.5 rounded flex items-center px-2"
                        style={{
                          left: `${leftPct}%`,
                          width: `${Math.max(widthPct, 3)}%`,
                          backgroundColor: color,
                          opacity: 0.85,
                        }}
                      >
                        <span className="text-[9px] text-white font-semibold truncate">
                          {(c.campaign_contents || []).length} itens
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
};

export default ScheduleTimeline;
