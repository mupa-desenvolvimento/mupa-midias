import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, Monitor, Layers, Target } from "lucide-react";

const PRIORITY_COLORS: Record<number, string> = {
  1: "bg-red-500", 2: "bg-orange-500", 3: "bg-yellow-500", 5: "bg-blue-500", 8: "bg-muted",
};

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6h to 23h

const ScheduleTimeline = () => {
  const [view, setView] = useState<"campaign" | "device">("campaign");
  const [filterState, setFilterState] = useState("");
  const [filterStore, setFilterStore] = useState("");

  const { data: campaigns = [] } = useQuery({
    queryKey: ["schedule-campaigns"],
    queryFn: async () => {
      const { data } = await supabase
        .from("campaigns")
        .select("*, campaign_contents(id, media:media_items(id, name, type, file_url, duration), position, duration_override), campaign_targets(id, target_type, state_id, tag_id, sector_id, store_id)")
        .eq("is_active", true)
        .order("priority", { ascending: true });
      return data || [];
    },
  });

  const { data: states = [] } = useQuery({
    queryKey: ["states-filter"],
    queryFn: async () => { const { data } = await supabase.from("states").select("id, name, code").order("name"); return data || []; },
  });

  const { data: stores = [] } = useQuery({
    queryKey: ["stores-filter"],
    queryFn: async () => { const { data } = await supabase.from("stores").select("id, name").order("name"); return data || []; },
  });

  const { data: devices = [] } = useQuery({
    queryKey: ["devices-schedule"],
    queryFn: async () => {
      const { data } = await supabase.from("devices").select("id, name, device_code, store_id, sector_id").eq("is_active", true).order("name").limit(100);
      return data || [];
    },
  });

  // Filter campaigns by state/store if selected
  const filteredCampaigns = campaigns.filter((c: any) => {
    const targets = c.campaign_targets || [];
    if (!filterState && !filterStore) return true;
    if (targets.length === 0) return true; // No targets = all
    if (filterState) {
      const hasStateTarget = targets.some((t: any) => t.target_type === "state" && t.state_id === filterState);
      if (hasStateTarget) return true;
    }
    if (filterStore) {
      const hasStoreTarget = targets.some((t: any) => t.target_type === "store" && t.store_id === filterStore);
      if (hasStoreTarget) return true;
    }
    return false;
  });

  const getTimeSlot = (campaign: any): { start: number; end: number } => {
    const start = campaign.start_time ? parseInt(campaign.start_time.split(":")[0]) : 6;
    const end = campaign.end_time ? parseInt(campaign.end_time.split(":")[0]) : 23;
    return { start: Math.max(start, 6), end: Math.min(end, 23) };
  };

  return (
    <PageShell header={<div><h1 className="text-2xl font-bold">Programação</h1><p className="text-sm text-muted-foreground">Visualize a timeline de campanhas e dispositivos</p></div>}>
      {/* Filters */}
      <div className="flex items-end gap-4 mb-6">
        <div className="w-48">
          <Label className="text-xs">Estado</Label>
          <Select value={filterState} onValueChange={setFilterState}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {states.map(s => <SelectItem key={s.id} value={s.id}>{s.code} - {s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <Label className="text-xs">Loja</Label>
          <Select value={filterStore} onValueChange={setFilterStore}>
            <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={view} onValueChange={v => setView(v as any)}>
        <TabsList>
          <TabsTrigger value="campaign" className="gap-1"><Layers className="h-3 w-3" />Por Campanha</TabsTrigger>
          <TabsTrigger value="device" className="gap-1"><Monitor className="h-3 w-3" />Por Dispositivo</TabsTrigger>
        </TabsList>

        {/* Campaign View */}
        <TabsContent value="campaign" className="mt-4">
          {filteredCampaigns.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma campanha ativa</p>
          ) : (
            <div className="space-y-1">
              {/* Time header */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-48 shrink-0" />
                <div className="flex-1 flex">
                  {HOURS.map(h => (
                    <div key={h} className="flex-1 text-center text-[10px] text-muted-foreground font-mono">{String(h).padStart(2, "0")}h</div>
                  ))}
                </div>
              </div>

              {filteredCampaigns.map((c: any) => {
                const slot = getTimeSlot(c);
                const color = PRIORITY_COLORS[c.priority] || "bg-primary";
                const startPercent = ((slot.start - 6) / (23 - 6)) * 100;
                const widthPercent = ((slot.end - slot.start) / (23 - 6)) * 100;

                return (
                  <div key={c.id} className="flex items-center gap-2 group">
                    <div className="w-48 shrink-0 truncate text-sm font-medium pr-2 text-right">{c.name}</div>
                    <div className="flex-1 h-8 bg-muted/30 rounded relative">
                      <div
                        className={`absolute top-0.5 bottom-0.5 rounded ${color} opacity-80 flex items-center px-2`}
                        style={{ left: `${startPercent}%`, width: `${widthPercent}%` }}
                      >
                        <span className="text-[10px] text-white font-medium truncate">
                          {(c.campaign_contents || []).length} itens
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Device View */}
        <TabsContent value="device" className="mt-4">
          <div className="space-y-3">
            {devices.slice(0, 20).map((d: any) => (
              <Card key={d.id}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <Monitor className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{d.name}</p>
                      <p className="text-xs text-muted-foreground">{d.device_code}</p>
                    </div>
                    <div className="flex gap-1 flex-wrap justify-end">
                      {filteredCampaigns.filter((c: any) => {
                        const targets = c.campaign_targets || [];
                        if (targets.length === 0) return true;
                        return targets.some((t: any) => {
                          if (t.target_type === "store" && t.store_id === d.store_id) return true;
                          if (t.target_type === "sector" && t.sector_id === d.sector_id) return true;
                          return false;
                        });
                      }).map((c: any) => (
                        <Badge key={c.id} variant="outline" className="text-[10px]">{c.name}</Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
};

export default ScheduleTimeline;
