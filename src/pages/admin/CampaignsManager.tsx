import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Search, Target, Calendar, Layers, Tag } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

interface CampaignRow {
  id: string;
  name: string;
  description: string | null;
  campaign_type: string | null;
  priority: number | null;
  weight: number | null;
  is_active: boolean | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  days_of_week: number[] | null;
  advertiser_id: string | null;
  created_at: string | null;
}

interface TargetRow {
  id: string;
  campaign_id: string;
  target_type: string;
  state_id: string | null;
  region_id: string | null;
  city_id: string | null;
  store_id: string | null;
  sector_id: string | null;
  tag_id: string | null;
  include: boolean | null;
}

const CampaignsManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<CampaignRow | null>(null);
  const [targetDialogOpen, setTargetDialogOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    campaign_type: "institutional",
    priority: 5,
    weight: 1,
    is_active: true,
    start_date: "",
    end_date: "",
    start_time: "",
    end_time: "",
    days_of_week: [0, 1, 2, 3, 4, 5, 6] as number[],
  });

  // Target form
  const [targetForm, setTargetForm] = useState({
    target_type: "state",
    state_id: "",
    tag_id: "",
    sector_id: "",
    store_id: "",
  });

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["campaigns-manager"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("priority", { ascending: true });
      if (error) throw error;
      return data as CampaignRow[];
    },
  });

  const { data: targets = [] } = useQuery({
    queryKey: ["campaign-targets", selectedCampaignId],
    queryFn: async () => {
      if (!selectedCampaignId) return [];
      const { data, error } = await supabase
        .from("campaign_targets")
        .select("*")
        .eq("campaign_id", selectedCampaignId);
      if (error) throw error;
      return data as TargetRow[];
    },
    enabled: !!selectedCampaignId,
  });

  const { data: states = [] } = useQuery({
    queryKey: ["states-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("states").select("id, name, code").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["tags-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tags").select("id, name, slug, color").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: sectors = [] } = useQuery({
    queryKey: ["sectors-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sectors").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: stores = [] } = useQuery({
    queryKey: ["stores-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const createCampaign = useMutation({
    mutationFn: async (c: typeof form) => {
      const { error } = await supabase.from("campaigns").insert([{
        name: c.name,
        description: c.description || null,
        campaign_type: c.campaign_type,
        priority: c.priority,
        weight: c.weight,
        is_active: c.is_active,
        start_date: c.start_date || null,
        end_date: c.end_date || null,
        start_time: c.start_time || null,
        end_time: c.end_time || null,
        days_of_week: c.days_of_week,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns-manager"] });
      toast({ title: "Campanha criada" });
      closeDialog();
    },
    onError: (e) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateCampaign = useMutation({
    mutationFn: async ({ id, ...c }: typeof form & { id: string }) => {
      const { error } = await supabase.from("campaigns").update({
        name: c.name,
        description: c.description || null,
        campaign_type: c.campaign_type,
        priority: c.priority,
        weight: c.weight,
        is_active: c.is_active,
        start_date: c.start_date || null,
        end_date: c.end_date || null,
        start_time: c.start_time || null,
        end_time: c.end_time || null,
        days_of_week: c.days_of_week,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns-manager"] });
      toast({ title: "Campanha atualizada" });
      closeDialog();
    },
    onError: (e) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("campaign_targets").delete().eq("campaign_id", id);
      await supabase.from("campaign_contents").delete().eq("campaign_id", id);
      const { error } = await supabase.from("campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns-manager"] });
      toast({ title: "Campanha excluída" });
    },
    onError: (e) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const addTarget = useMutation({
    mutationFn: async (t: { campaign_id: string; target_type: string; state_id?: string; tag_id?: string; sector_id?: string; store_id?: string }) => {
      const payload = {
        campaign_id: t.campaign_id,
        target_type: t.target_type,
        state_id: t.target_type === "state" && t.state_id ? t.state_id : null,
        tag_id: t.target_type === "tag" && t.tag_id ? t.tag_id : null,
        sector_id: t.target_type === "sector" && t.sector_id ? t.sector_id : null,
        store_id: t.target_type === "store" && t.store_id ? t.store_id : null,
      };
      const { error } = await supabase.from("campaign_targets").insert([payload]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-targets", selectedCampaignId] });
      toast({ title: "Segmentação adicionada" });
      setTargetForm({ target_type: "state", state_id: "", tag_id: "", sector_id: "", store_id: "" });
    },
    onError: (e) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const removeTarget = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaign_targets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-targets", selectedCampaignId] });
      toast({ title: "Segmentação removida" });
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingCampaign(null);
    setForm({ name: "", description: "", campaign_type: "institutional", priority: 5, weight: 1, is_active: true, start_date: "", end_date: "", start_time: "", end_time: "", days_of_week: [0, 1, 2, 3, 4, 5, 6] });
  };

  const openCreate = () => {
    setEditingCampaign(null);
    setForm({ name: "", description: "", campaign_type: "institutional", priority: 5, weight: 1, is_active: true, start_date: "", end_date: "", start_time: "", end_time: "", days_of_week: [0, 1, 2, 3, 4, 5, 6] });
    setDialogOpen(true);
  };

  const openEdit = (c: CampaignRow) => {
    setEditingCampaign(c);
    setForm({
      name: c.name,
      description: c.description || "",
      campaign_type: c.campaign_type || "institutional",
      priority: c.priority || 5,
      weight: c.weight || 1,
      is_active: c.is_active ?? true,
      start_date: c.start_date || "",
      end_date: c.end_date || "",
      start_time: c.start_time || "",
      end_time: c.end_time || "",
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

  const toggleDay = (day: number) => {
    setForm((prev) => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day) ? prev.days_of_week.filter((d) => d !== day) : [...prev.days_of_week, day],
    }));
  };

  const filtered = campaigns.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  const getTargetLabel = (t: TargetRow) => {
    if (t.target_type === "state") {
      const s = states.find((s) => s.id === t.state_id);
      return `Estado: ${s?.code || s?.name || "?"}`;
    }
    if (t.target_type === "tag") {
      const tag = tags.find((tg) => tg.id === t.tag_id);
      return `Tag: ${tag?.name || "?"}`;
    }
    if (t.target_type === "sector") {
      const sec = sectors.find((s) => s.id === t.sector_id);
      return `Setor: ${sec?.name || "?"}`;
    }
    if (t.target_type === "store") {
      const st = stores.find((s) => s.id === t.store_id);
      return `Loja: ${st?.name || "?"}`;
    }
    return t.target_type;
  };

  const getPriorityInfo = (p: number) => PRIORITY_LABELS[p] || { label: `P${p}`, color: "bg-muted" };

  return (
    <PageShell header={<div><h1 className="text-2xl font-bold">Campanhas</h1><p className="text-sm text-muted-foreground">Gerencie campanhas com segmentação, prioridade e período</p></div>}>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar campanhas..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Campanha
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhuma campanha encontrada</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => {
            const pri = getPriorityInfo(c.priority || 5);
            const typeLabel = CAMPAIGN_TYPES.find((t) => t.value === c.campaign_type)?.label || c.campaign_type;
            return (
              <Card key={c.id} className="group hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`w-2 h-10 rounded-full ${pri.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-sm">{c.name}</h3>
                          <Badge variant={c.is_active ? "default" : "secondary"} className="text-[10px]">
                            {c.is_active ? "Ativa" : "Inativa"}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">{typeLabel}</Badge>
                          <Badge variant="outline" className="text-[10px]">{pri.label}</Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          {c.start_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {c.start_date} → {c.end_date || "∞"}
                            </span>
                          )}
                          {c.start_time && <span>{c.start_time} - {c.end_time}</span>}
                          {c.description && <span className="truncate max-w-[200px]">{c.description}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedCampaignId(c.id); setTargetDialogOpen(true); }}>
                        <Target className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteCampaign.mutate(c.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Campaign Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCampaign ? "Editar Campanha" : "Nova Campanha"}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="general" className="flex-1">Geral</TabsTrigger>
              <TabsTrigger value="schedule" className="flex-1">Período</TabsTrigger>
              <TabsTrigger value="rules" className="flex-1">Regras</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div>
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Coca verão" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.campaign_type} onValueChange={(v) => setForm({ ...form, campaign_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CAMPAIGN_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label>Ativa</Label>
              </div>
            </TabsContent>

            <TabsContent value="schedule" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data início</Label>
                  <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div>
                  <Label>Data fim</Label>
                  <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Horário início</Label>
                  <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
                </div>
                <div>
                  <Label>Horário fim</Label>
                  <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Dias da semana</Label>
                <div className="flex gap-1 mt-1">
                  {DAYS_OF_WEEK.map((d) => (
                    <Button
                      key={d.value}
                      type="button"
                      size="sm"
                      variant={form.days_of_week.includes(d.value) ? "default" : "outline"}
                      className="h-8 w-10 text-xs"
                      onClick={() => toggleDay(d.value)}
                    >
                      {d.label}
                    </Button>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="rules" className="space-y-4 mt-4">
              <div>
                <Label>Prioridade</Label>
                <Select value={String(form.priority)} onValueChange={(v) => setForm({ ...form, priority: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_LABELS).map(([val, info]) => (
                      <SelectItem key={val} value={val}>{info.label} (P{val})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Peso (1-10)</Label>
                <Input type="number" min={1} max={10} value={form.weight} onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })} />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name}>{editingCampaign ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Targeting Dialog */}
      <Dialog open={targetDialogOpen} onOpenChange={(v) => { setTargetDialogOpen(v); if (!v) setSelectedCampaignId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Segmentação
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Existing targets */}
            {targets.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Segmentações ativas</Label>
                <div className="flex flex-wrap gap-2">
                  {targets.map((t) => (
                    <Badge key={t.id} variant="secondary" className="gap-1 pr-1">
                      {getTargetLabel(t)}
                      <Button variant="ghost" size="icon" className="h-4 w-4 ml-1" onClick={() => removeTarget.mutate(t.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {targets.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">Sem segmentação = exibir para todos</p>
            )}

            {/* Add new target */}
            <div className="border-t pt-4 space-y-3">
              <Label>Adicionar segmentação</Label>
              <Select value={targetForm.target_type} onValueChange={(v) => setTargetForm({ ...targetForm, target_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="state">Estado</SelectItem>
                  <SelectItem value="tag">Tag</SelectItem>
                  <SelectItem value="sector">Setor</SelectItem>
                  <SelectItem value="store">Loja</SelectItem>
                </SelectContent>
              </Select>

              {targetForm.target_type === "state" && (
                <Select value={targetForm.state_id} onValueChange={(v) => setTargetForm({ ...targetForm, state_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o estado" /></SelectTrigger>
                  <SelectContent>
                    {states.map((s) => <SelectItem key={s.id} value={s.id}>{s.code} - {s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}

              {targetForm.target_type === "tag" && (
                <Select value={targetForm.tag_id} onValueChange={(v) => setTargetForm({ ...targetForm, tag_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione a tag" /></SelectTrigger>
                  <SelectContent>
                    {tags.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}

              {targetForm.target_type === "sector" && (
                <Select value={targetForm.sector_id} onValueChange={(v) => setTargetForm({ ...targetForm, sector_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                  <SelectContent>
                    {sectors.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}

              {targetForm.target_type === "store" && (
                <Select value={targetForm.store_id} onValueChange={(v) => setTargetForm({ ...targetForm, store_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione a loja" /></SelectTrigger>
                  <SelectContent>
                    {stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}

              <Button
                className="w-full"
                size="sm"
                onClick={() => {
                  if (!selectedCampaignId) return;
                  addTarget.mutate({
                    campaign_id: selectedCampaignId,
                    target_type: targetForm.target_type,
                    state_id: targetForm.state_id || undefined,
                    tag_id: targetForm.tag_id || undefined,
                    sector_id: targetForm.sector_id || undefined,
                    store_id: targetForm.store_id || undefined,
                  });
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};

export default CampaignsManager;
