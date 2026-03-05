
import { useState, useMemo } from "react";
import { useNews, NewsArticle } from "@/hooks/useNews";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, Newspaper, LayoutGrid, List, Trash2, 
  Clock, Eye, RefreshCw, Tv, Monitor, ImageDown
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { 
  NewsLayoutRenderer, 
  NEWS_LAYOUTS, 
  type NewsLayoutId 
} from "@/components/news/NewsLayoutPreview";

interface NewsSlide {
  id: string;
  name: string;
  duration: number | null;
  metadata: any;
  created_at: string;
  status: string;
}

export function NewsModule() {
  const queryClient = useQueryClient();
  const { articles, categories, triggerCollection, triggerImageCache } = useNews();

  const [activeTab, setActiveTab] = useState("preview");
  const [slideViewMode, setSlideViewMode] = useState<"grid" | "list">("grid");
  const [previewCategory, setPreviewCategory] = useState<string>("all");
  const [previewLayout, setPreviewLayout] = useState<NewsLayoutId>("hero-sidebar");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedSlide, setSelectedSlide] = useState<NewsSlide | null>(null);
  const [slideName, setSlideName] = useState("");
  const [slideCategory, setSlideCategory] = useState("all");
  const [slideDuration, setSlideDuration] = useState(15);
  const [creatingSlide, setCreatingSlide] = useState(false);

  const { data: slides = [], isLoading: slidesLoading } = useQuery({
    queryKey: ["news-slides"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_items")
        .select("*")
        .eq("type", "news")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as NewsSlide[];
    },
  });

  const handleCreateSlide = async () => {
    if (!slideName.trim()) { toast.error("Informe um nome"); return; }
    setCreatingSlide(true);
    try {
      const { error } = await supabase.from("media_items").insert({
        name: slideName,
        type: "news",
        status: "active",
        duration: slideDuration,
        metadata: {
          news_category: slideCategory === "all" ? null : slideCategory,
          layout: previewLayout,
        },
      });
      if (error) throw error;
      toast.success("Slide criado!");
      queryClient.invalidateQueries({ queryKey: ["news-slides"] });
      queryClient.invalidateQueries({ queryKey: ["media-items"] });
      setIsCreateOpen(false);
      setSlideName("");
      setSlideCategory("all");
      setSlideDuration(15);
    } catch { toast.error("Erro ao criar slide"); }
    finally { setCreatingSlide(false); }
  };

  const deleteSlide = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("media_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news-slides"] });
      queryClient.invalidateQueries({ queryKey: ["media-items"] });
      toast.success("Slide removido");
      setIsDeleteOpen(false);
      setSelectedSlide(null);
    },
    onError: () => toast.error("Erro ao remover slide"),
  });

  const filteredArticles = useMemo(() => {
    if (!articles) return [];
    const filtered = previewCategory === "all" ? articles : articles.filter((a) => a.category === previewCategory);
    return filtered.slice(0, 20);
  }, [articles, previewCategory]);

  const articlesWithImages = useMemo(() => {
    return filteredArticles.filter(a => a.image_url);
  }, [filteredArticles]);

  const getCategoryLabel = (cat: string | null) => cat || "Todas";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Newspaper className="h-6 w-6 text-primary" />
            Notícias
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie slides de notícias e visualize como ficarão nos dispositivos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => triggerCollection.mutate()}
            disabled={triggerCollection.isPending}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", triggerCollection.isPending && "animate-spin")} />
            Atualizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => triggerImageCache.mutate()}
            disabled={triggerImageCache.isPending}
          >
            <ImageDown className={cn("h-4 w-4 mr-2", triggerImageCache.isPending && "animate-spin")} />
            Cachear Imagens
          </Button>
          <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Slide
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Notícias" value={articles?.length || 0} />
        <StatCard label="Com Imagem" value={articlesWithImages.length} />
        <StatCard label="Categorias" value={categories?.length || 0} />
        <StatCard label="Slides" value={slides.length} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="preview" className="gap-2">
            <Monitor className="h-4 w-4" />
            Pré-visualização TV
          </TabsTrigger>
          <TabsTrigger value="slides" className="gap-2">
            <Tv className="h-4 w-4" />
            Slides Criados
          </TabsTrigger>
        </TabsList>

        {/* ━━━ TAB: Preview ━━━ */}
        <TabsContent value="preview" className="mt-4 space-y-4">
          {/* Category pills */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={previewCategory === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setPreviewCategory("all")}
              className="rounded-full"
            >
              Todas ({articles?.length || 0})
            </Button>
            {categories?.map((cat) => {
              const count = articles?.filter(a => a.category === cat).length || 0;
              return (
                <Button
                  key={cat}
                  variant={previewCategory === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPreviewCategory(cat)}
                  className="rounded-full"
                >
                  {cat} ({count})
                </Button>
              );
            })}
          </div>

          {/* Layout selector */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">Layout:</span>
            <div className="flex gap-2">
              {NEWS_LAYOUTS.map((layout) => (
                <Button
                  key={layout.id}
                  variant={previewLayout === layout.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPreviewLayout(layout.id)}
                  className="text-xs"
                >
                  {layout.label}
                </Button>
              ))}
            </div>
          </div>

          {/* TV Preview */}
          <div className="max-w-4xl mx-auto">
            <NewsLayoutRenderer
              layoutId={previewLayout}
              articles={filteredArticles}
              category={previewCategory}
            />
            <p className="text-xs text-muted-foreground text-center mt-2">
              {filteredArticles.length} notícias • {articlesWithImages.length} com imagem
            </p>
          </div>

          {/* Layout thumbnails */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Todos os layouts disponíveis</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {NEWS_LAYOUTS.map((layout) => (
                <button
                  key={layout.id}
                  onClick={() => setPreviewLayout(layout.id)}
                  className={cn(
                    "text-left rounded-xl border-2 overflow-hidden transition-all hover:shadow-lg",
                    previewLayout === layout.id ? "border-primary shadow-md" : "border-transparent"
                  )}
                >
                  <div className="scale-100">
                    <NewsLayoutRenderer
                      layoutId={layout.id}
                      articles={filteredArticles.length > 0 ? filteredArticles : []}
                      category={previewCategory}
                    />
                  </div>
                  <div className="p-3 bg-card">
                    <p className="font-medium text-sm">{layout.label}</p>
                    <p className="text-xs text-muted-foreground">{layout.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ━━━ TAB: Slides ━━━ */}
        <TabsContent value="slides" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {slides.length} {slides.length === 1 ? "slide criado" : "slides criados"}
            </p>
            <div className="flex items-center gap-1 border rounded-md p-0.5">
              <Button variant={slideViewMode === "grid" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setSlideViewMode("grid")}>
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button variant={slideViewMode === "list" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setSlideViewMode("list")}>
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {slidesLoading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando...</div>
          ) : slides.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Newspaper className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-1">Nenhum slide de notícias</h3>
                <p className="text-muted-foreground text-sm max-w-sm mb-6">
                  Crie um slide para exibir nas TVs. Escolha a categoria e o layout.
                </p>
                <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Criar Primeiro Slide
                </Button>
              </CardContent>
            </Card>
          ) : slideViewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {slides.map((slide) => (
                <SlideCard
                  key={slide.id}
                  slide={slide}
                  onDelete={() => { setSelectedSlide(slide); setIsDeleteOpen(true); }}
                  articlesCount={articles?.filter(a => slide.metadata?.news_category ? a.category === slide.metadata.news_category : true).length || 0}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {slides.map((slide) => (
                <SlideListItem
                  key={slide.id}
                  slide={slide}
                  onDelete={() => { setSelectedSlide(slide); setIsDeleteOpen(true); }}
                  articlesCount={articles?.filter(a => slide.metadata?.news_category ? a.category === slide.metadata.news_category : true).length || 0}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Slide de Notícias</DialogTitle>
            <DialogDescription>Configure como as notícias serão exibidas no dispositivo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={slideName} onChange={(e) => setSlideName(e.target.value)} placeholder="Ex: Notícias de Economia" />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={slideCategory} onValueChange={setSlideCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {categories?.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Layout</Label>
              <Select value={previewLayout} onValueChange={(v) => setPreviewLayout(v as NewsLayoutId)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NEWS_LAYOUTS.map((l) => <SelectItem key={l.id} value={l.id}>{l.label} — {l.description}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Duração (segundos)</Label>
              <Select value={String(slideDuration)} onValueChange={(v) => setSlideDuration(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[10, 15, 20, 30, 60].map(s => <SelectItem key={s} value={String(s)}>{s}s</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateSlide} disabled={creatingSlide}>
              {creatingSlide ? "Criando..." : "Criar Slide"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover slide?</DialogTitle>
            <DialogDescription>O slide "{selectedSlide?.name}" será removido.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => selectedSlide && deleteSlide.mutate(selectedSlide.id)} disabled={deleteSlide.isPending}>
              {deleteSlide.isPending ? "Removendo..." : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sub-components ───

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="text-2xl font-bold text-primary">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function SlideCard({ slide, onDelete, articlesCount }: { slide: NewsSlide; onDelete: () => void; articlesCount: number }) {
  const category = slide.metadata?.news_category || "Todas";
  const layout = NEWS_LAYOUTS.find(l => l.id === slide.metadata?.layout)?.label || "Destaque";
  return (
    <Card className="group hover:shadow-md transition-all overflow-hidden">
      <div className="h-1.5 bg-gradient-to-r from-primary to-primary/50" />
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 min-w-0 flex-1">
            <h3 className="font-semibold truncate">{slide.name}</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">{category}</Badge>
              <Badge variant="outline" className="text-xs">{layout}</Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />{slide.duration || 15}s
              </span>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <span>{articlesCount} notícias</span>
          <span>{format(new Date(slide.created_at), "dd/MM/yy", { locale: ptBR })}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function SlideListItem({ slide, onDelete, articlesCount }: { slide: NewsSlide; onDelete: () => void; articlesCount: number }) {
  const category = slide.metadata?.news_category || "Todas";
  const layout = NEWS_LAYOUTS.find(l => l.id === slide.metadata?.layout)?.label || "Destaque";
  return (
    <div className="group flex items-center gap-4 p-3 rounded-lg border bg-card hover:shadow-sm transition-all">
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Newspaper className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium truncate">{slide.name}</h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
          <Badge variant="secondary" className="text-xs">{category}</Badge>
          <Badge variant="outline" className="text-xs">{layout}</Badge>
          <span>{slide.duration || 15}s</span>
          <span>{articlesCount} notícias</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
        {format(new Date(slide.created_at), "dd/MM/yy", { locale: ptBR })}
      </span>
      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive shrink-0" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
