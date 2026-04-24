import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserTenant } from "@/hooks/useUserTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, Tag, Users, Megaphone, Building2, MapPin, Store, Layers, Box, Monitor } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

// ─── TAGS CRUD ───
const TagsSection = () => {
  const { tenantId } = useUserTenant();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<any>(null);
  const [form, setForm] = useState({ name: "", slug: "", category: "general", color: "#6366f1", description: "" });

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ["enterprise-tags", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("tags").select("*").eq("tenant_id", tenantId!).order("category").order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const payload = { ...values, tenant_id: tenantId! };
      if (editingTag) {
        const { error } = await supabase.from("tags").update(payload).eq("id", editingTag.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tags").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enterprise-tags"] });
      setDialogOpen(false);
      setEditingTag(null);
      toast.success(editingTag ? "Tag atualizada!" : "Tag criada!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tags").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enterprise-tags"] });
      toast.success("Tag removida!");
    },
  });

  const openNew = () => {
    setEditingTag(null);
    setForm({ name: "", slug: "", category: "general", color: "#6366f1", description: "" });
    setDialogOpen(true);
  };

  const openEdit = (tag: any) => {
    setEditingTag(tag);
    setForm({ name: tag.name, slug: tag.slug, category: tag.category || "general", color: tag.color || "#6366f1", description: tag.description || "" });
    setDialogOpen(true);
  };

  const categories = useMemo(() => [...new Set(tags.map((t: any) => t.category))], [tags]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Tags ({tags.length})</h3>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nova Tag</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {tags.map((tag: any) => (
          <Badge
            key={tag.id}
            variant="outline"
            className="gap-2 py-1.5 px-3 cursor-pointer hover:bg-accent/50"
            onClick={() => openEdit(tag)}
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tag.color || "#6366f1" }} />
            {tag.name}
            <span className="text-[10px] text-muted-foreground">({tag.category})</span>
          </Badge>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTag ? "Editar Tag" : "Nova Tag"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") })} />
              </div>
              <div>
                <Label>Slug</Label>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Categoria</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="general" />
              </div>
              <div>
                <Label>Cor</Label>
                <div className="flex gap-2">
                  <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-10 h-10 rounded cursor-pointer" />
                  <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
                </div>
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            {editingTag && (
              <Button variant="destructive" size="sm" onClick={() => { deleteMutation.mutate(editingTag.id); setDialogOpen(false); }}>
                <Trash2 className="w-4 h-4 mr-1" /> Excluir
              </Button>
            )}
            <Button onClick={() => saveMutation.mutate(form)} disabled={!form.name || !form.slug}>
              {editingTag ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── SECTORS CRUD ───
const SectorsSection = () => {
  const { tenantId } = useUserTenant();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form, setForm] = useState({ name: "", code: "", store_id: "", description: "" });

  const { data: sectors = [] } = useQuery({
    queryKey: ["enterprise-sectors", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("sectors").select("*, stores!sectors_store_id_fkey(name, code)").eq("tenant_id", tenantId!).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: stores = [] } = useQuery({
    queryKey: ["stores-for-sectors", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("stores").select("id, name, code").eq("tenant_id", tenantId!).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const payload = { name: values.name, code: values.code || null, store_id: values.store_id, description: values.description || null, tenant_id: tenantId! };
      if (editingItem) {
        const { error } = await supabase.from("sectors").update(payload).eq("id", editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sectors").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enterprise-sectors"] });
      setDialogOpen(false);
      toast.success(editingItem ? "Setor atualizado!" : "Setor criado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sectors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enterprise-sectors"] });
      toast.success("Setor removido!");
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Setores ({sectors.length})</h3>
        <Button size="sm" onClick={() => { setEditingItem(null); setForm({ name: "", code: "", store_id: "", description: "" }); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Novo Setor
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Código</TableHead>
            <TableHead>Loja</TableHead>
            <TableHead className="w-24">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sectors.map((sector: any) => (
            <TableRow key={sector.id}>
              <TableCell className="font-medium">{sector.name}</TableCell>
              <TableCell>{sector.code || "-"}</TableCell>
              <TableCell>{(sector.stores as any)?.name || "-"}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingItem(sector); setForm({ name: sector.name, code: sector.code || "", store_id: sector.store_id, description: sector.description || "" }); setDialogOpen(true); }}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(sector.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingItem ? "Editar Setor" : "Novo Setor"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Loja</Label>
              <Select value={form.store_id} onValueChange={(v) => setForm({ ...form, store_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione a loja" /></SelectTrigger>
                <SelectContent>{stores.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Código</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            </div>
            <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button onClick={() => saveMutation.mutate(form)} disabled={!form.name || !form.store_id}>
              {editingItem ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── ADVERTISERS CRUD ───
const AdvertisersSection = () => {
  const { tenantId } = useUserTenant();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form, setForm] = useState({ name: "", slug: "", contact_name: "", contact_email: "", cnpj: "" });

  const { data: advertisers = [] } = useQuery({
    queryKey: ["enterprise-advertisers", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("advertisers").select("*").eq("tenant_id", tenantId!).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const payload = { ...values, tenant_id: tenantId! };
      if (editingItem) {
        const { error } = await supabase.from("advertisers").update(payload).eq("id", editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("advertisers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enterprise-advertisers"] });
      setDialogOpen(false);
      toast.success(editingItem ? "Anunciante atualizado!" : "Anunciante criado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("advertisers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enterprise-advertisers"] });
      toast.success("Anunciante removido!");
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Anunciantes ({advertisers.length})</h3>
        <Button size="sm" onClick={() => { setEditingItem(null); setForm({ name: "", slug: "", contact_name: "", contact_email: "", cnpj: "" }); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Novo Anunciante
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {advertisers.map((adv: any) => (
          <Card key={adv.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold">{adv.name}</h4>
                  <p className="text-xs text-muted-foreground">{adv.contact_email || adv.cnpj || "-"}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingItem(adv); setForm({ name: adv.name, slug: adv.slug, contact_name: adv.contact_name || "", contact_email: adv.contact_email || "", cnpj: adv.cnpj || "" }); setDialogOpen(true); }}>
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(adv.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingItem ? "Editar Anunciante" : "Novo Anunciante"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") })} /></div>
              <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Contato</Label><Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
            </div>
            <div><Label>CNPJ</Label><Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button onClick={() => saveMutation.mutate(form)} disabled={!form.name || !form.slug}>
              {editingItem ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── CAMPAIGNS CRUD ───
const CampaignsSection = () => {
  const { tenantId } = useUserTenant();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form, setForm] = useState({ name: "", description: "", campaign_type: "standard", priority: 5, weight: 1, status: "draft", advertiser_id: "", start_date: "", end_date: "", start_time: "", end_time: "" });

  const { data: campaigns = [] } = useQuery({
    queryKey: ["enterprise-campaigns", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("campaigns").select("*, advertisers(name)").eq("tenant_id", tenantId!).order("priority", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: advertisers = [] } = useQuery({
    queryKey: ["advertisers-for-campaigns", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("advertisers").select("id, name").eq("tenant_id", tenantId!);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const payload: any = {
        name: values.name,
        description: values.description || null,
        campaign_type: values.campaign_type,
        priority: Number(values.priority),
        weight: Number(values.weight),
        status: values.status,
        advertiser_id: values.advertiser_id || null,
        start_date: values.start_date || null,
        end_date: values.end_date || null,
        start_time: values.start_time || null,
        end_time: values.end_time || null,
        is_active: values.status === "active",
        tenant_id: tenantId!,
      };
      if (editingItem) {
        const { error } = await supabase.from("campaigns").update(payload).eq("id", editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("campaigns").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enterprise-campaigns"] });
      setDialogOpen(false);
      toast.success(editingItem ? "Campanha atualizada!" : "Campanha criada!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enterprise-campaigns"] });
      toast.success("Campanha removida!");
    },
  });

  const statusColors: Record<string, string> = { draft: "secondary", active: "default", paused: "outline", completed: "secondary" };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Campanhas ({campaigns.length})</h3>
        <Button size="sm" onClick={() => {
          setEditingItem(null);
          setForm({ name: "", description: "", campaign_type: "standard", priority: 5, weight: 1, status: "draft", advertiser_id: "", start_date: "", end_date: "", start_time: "", end_time: "" });
          setDialogOpen(true);
        }}>
          <Plus className="w-4 h-4 mr-1" /> Nova Campanha
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Anunciante</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Prioridade</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Período</TableHead>
            <TableHead className="w-24">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((c: any) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell>{(c.advertisers as any)?.name || "-"}</TableCell>
              <TableCell><Badge variant="outline">{c.campaign_type}</Badge></TableCell>
              <TableCell>{c.priority}</TableCell>
              <TableCell><Badge variant={statusColors[c.status] as any || "secondary"}>{c.status}</Badge></TableCell>
              <TableCell className="text-xs">{c.start_date || "-"} → {c.end_date || "-"}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                    setEditingItem(c);
                    setForm({ name: c.name, description: c.description || "", campaign_type: c.campaign_type, priority: c.priority, weight: c.weight, status: c.status, advertiser_id: c.advertiser_id || "", start_date: c.start_date || "", end_date: c.end_date || "", start_time: c.start_time || "", end_time: c.end_time || "" });
                    setDialogOpen(true);
                  }}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(c.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editingItem ? "Editar Campanha" : "Nova Campanha"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Anunciante</Label>
                <Select value={form.advertiser_id} onValueChange={(v) => setForm({ ...form, advertiser_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Sem anunciante" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {advertisers.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-4 gap-4">
              <div><Label>Tipo</Label>
                <Select value={form.campaign_type} onValueChange={(v) => setForm({ ...form, campaign_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="paid">Paga</SelectItem>
                    <SelectItem value="regional">Regional</SelectItem>
                    <SelectItem value="network">Rede</SelectItem>
                    <SelectItem value="store">Loja</SelectItem>
                    <SelectItem value="institutional">Institucional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Prioridade</Label><Input type="number" min={1} max={10} value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} /></div>
              <div><Label>Peso</Label><Input type="number" min={1} value={form.weight} onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })} /></div>
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="paused">Pausada</SelectItem>
                    <SelectItem value="completed">Finalizada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div><Label>Data Início</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><Label>Data Fim</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
              <div><Label>Hora Início</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
              <div><Label>Hora Fim</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => saveMutation.mutate(form)} disabled={!form.name}>
              {editingItem ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── MAIN PAGE ───
const EnterpriseCRUD = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Enterprise</h1>
        <p className="text-sm text-muted-foreground">Gerenciamento de Tags, Setores, Anunciantes e Campanhas</p>
      </div>
      <Tabs defaultValue="campaigns" className="space-y-4">
        <TabsList>
          <TabsTrigger value="campaigns" className="gap-1.5"><Megaphone className="w-4 h-4" /> Campanhas</TabsTrigger>
          <TabsTrigger value="advertisers" className="gap-1.5"><Users className="w-4 h-4" /> Anunciantes</TabsTrigger>
          <TabsTrigger value="tags" className="gap-1.5"><Tag className="w-4 h-4" /> Tags</TabsTrigger>
          <TabsTrigger value="sectors" className="gap-1.5"><Layers className="w-4 h-4" /> Setores</TabsTrigger>
        </TabsList>
        <TabsContent value="campaigns"><CampaignsSection /></TabsContent>
        <TabsContent value="advertisers"><AdvertisersSection /></TabsContent>
        <TabsContent value="tags"><TagsSection /></TabsContent>
        <TabsContent value="sectors"><SectorsSection /></TabsContent>
      </Tabs>
    </div>
  );
};

export default EnterpriseCRUD;
