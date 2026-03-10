
import { useState } from "react";
import { useNews } from "@/hooks/useNews";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Download, Globe } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DEFAULT_FEEDS } from "@/data/default-feeds";

export function NewsFeedManager() {
  const { feeds, isLoading, addFeed } = useNews();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    rss_url: "",
    category: "Geral",
    priority: 1
  });

  const handleOpenDialog = () => {
    setFormData({
      name: "",
      rss_url: "",
      category: "Geral",
      priority: 1
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addFeed.mutateAsync(formData);
      setIsDialogOpen(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  const CATEGORIES = ["Geral", "Brasil", "Mundo", "Política", "Economia", "Tecnologia", "Esportes", "Cotidiano", "Entretenimento", "Saúde", "Ciência"];

  const handleImportDefaults = async () => {
    setImporting(true);
    try {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_strict');
      if (!tenantId) throw new Error("Usuário sem tenant");

      const feedsToInsert = DEFAULT_FEEDS
        .filter(df => !feeds?.some(f => f.rss_url === df.url))
        .map(df => ({
          tenant_id: tenantId,
          name: df.fonte,
          rss_url: df.url,
          category: df.categoria.charAt(0).toUpperCase() + df.categoria.slice(1),
          priority: 1,
          active: true
        }));

      if (feedsToInsert.length === 0) {
        toast.info("Todos os feeds padrão já foram importados.");
        return;
      }

      const { error } = await supabase.from("news_feeds").insert(feedsToInsert);
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ["news-feeds"] });
      toast.success(`${feedsToInsert.length} feeds importados com sucesso!`);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao importar feeds.");
    } finally {
      setImporting(false);
    }
  };

  const handleImportNewsData = async () => {
    setImporting(true);
    try {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id_strict');
      if (!tenantId) throw new Error("Usuário sem tenant");

      const { data: defaultLocation } = await supabase
        .from("weather_locations")
        .select("city,state")
        .eq("tenant_id", tenantId)
        .eq("is_default", true)
        .maybeSingle();

      const localTerms = [defaultLocation?.city, defaultLocation?.state].filter(Boolean) as string[];
      const localQuery = localTerms.length > 0 ? localTerms.map((t) => `"${t}"`).join(" OR ") : null;

      const defaultNewsDataFeeds = [
        { name: "NewsData.io — Geral", category: "Geral", query: null, priority: 3 },
        { name: "NewsData.io — Política", category: "Política", query: null, priority: 3 },
        { name: "NewsData.io — Economia", category: "Economia", query: null, priority: 3 },
        { name: "NewsData.io — Tecnologia", category: "Tecnologia", query: null, priority: 3 },
        { name: "NewsData.io — Esportes", category: "Esportes", query: null, priority: 2 },
        { name: "NewsData.io — Mundo", category: "Mundo", query: null, priority: 2 },
        ...(localQuery ? [{ name: "NewsData.io — Local", category: "Cotidiano", query: localQuery, priority: 5 }] : []),
      ];

      const existingNewsDataNames = new Set(
        (feeds || [])
          .filter((f) => (f as any).collector === "newsdata")
          .map((f) => f.name)
      );

      const feedsToInsert = defaultNewsDataFeeds
        .filter((f) => !existingNewsDataNames.has(f.name))
        .map((f) => ({
          tenant_id: tenantId,
          name: f.name,
          rss_url: "https://newsdata.io/api/1/news",
          category: f.category,
          priority: f.priority,
          active: true,
          collector: "newsdata",
          query: f.query,
        }));

      if (feedsToInsert.length === 0) {
        toast.info("Feeds do NewsData.io já estão configurados.");
        return;
      }

      const { error } = await supabase.from("news_feeds").insert(feedsToInsert);
      if (error) {
        const msg = (error as any)?.message?.toString?.() || "";
        if (msg.toLowerCase().includes("collector") && msg.toLowerCase().includes("does not exist")) {
          toast.error("Seu banco ainda não tem suporte a NewsData.io. Rode a migração de newsdata_integration.");
          return;
        }
        throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["news-feeds"] });
      toast.success(`${feedsToInsert.length} feeds do NewsData.io adicionados!`);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao configurar NewsData.io.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Fontes de Notícias</h3>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleImportDefaults} disabled={importing || isLoading}>
            <Download className="w-4 h-4 mr-2" />
            {importing ? "Importando..." : "Importar Padrões"}
          </Button>
          <Button variant="outline" onClick={handleImportNewsData} disabled={importing || isLoading}>
            <Globe className="w-4 h-4 mr-2" />
            {importing ? "Importando..." : "Ativar NewsData.io"}
          </Button>
          <Button onClick={() => handleOpenDialog()} className="gap-2">
            <Plus className="w-4 h-4" /> Adicionar Feed
          </Button>
        </div>
      </div>
      
      <div className="text-sm text-muted-foreground">
        {feeds?.length || 0} feeds configurados.
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Feed RSS</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Feed</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: CNN Brasil - Tecnologia"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="url">URL do RSS</Label>
              <Input
                id="url"
                value={formData.rss_url}
                onChange={(e) => setFormData({ ...formData, rss_url: e.target.value })}
                placeholder="https://..."
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(v) => setFormData({ ...formData, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Prioridade</Label>
                <Input
                  id="priority"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={addFeed.isPending}>
                Adicionar Feed
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
