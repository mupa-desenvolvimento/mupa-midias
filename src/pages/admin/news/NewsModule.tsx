
import { useState, useMemo } from "react";
import { useNews, NewsArticle, NewsSettings } from "@/hooks/useNews";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, Newspaper, LayoutGrid, List, Trash2, Edit2, 
  Clock, Eye, RefreshCw, Tv 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

// ─── News Slide type ───
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
  const { articles, categories, triggerCollection } = useNews();

  // ─── State ───
  const [activeTab, setActiveTab] = useState("slides");
  const [slideViewMode, setSlideViewMode] = useState<"grid" | "list">("grid");
  const [previewCategory, setPreviewCategory] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedSlide, setSelectedSlide] = useState<NewsSlide | null>(null);
  const [slideName, setSlideName] = useState("");
  const [slideCategory, setSlideCategory] = useState("all");
  const [slideDuration, setSlideDuration] = useState(15);
  const [creatingSlide, setCreatingSlide] = useState(false);

  // ─── Fetch created news slides ───
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

  // ─── Create slide ───
  const handleCreateSlide = async () => {
    if (!slideName.trim()) {
      toast.error("Informe um nome para o slide");
      return;
    }
    setCreatingSlide(true);
    try {
      const metadata = {
        news_category: slideCategory === "all" ? null : slideCategory,
      };
      const { error } = await supabase.from("media_items").insert({
        name: slideName,
        type: "news",
        status: "active",
        duration: slideDuration,
        metadata,
      });
      if (error) throw error;
      toast.success("Slide criado! Adicione-o a uma playlist.");
      queryClient.invalidateQueries({ queryKey: ["news-slides"] });
      queryClient.invalidateQueries({ queryKey: ["media-items"] });
      setIsCreateOpen(false);
      setSlideName("");
      setSlideCategory("all");
      setSlideDuration(15);
    } catch {
      toast.error("Erro ao criar slide");
    } finally {
      setCreatingSlide(false);
    }
  };

  // ─── Delete slide ───
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

  // ─── Preview articles filtered by selected category ───
  const filteredArticles = useMemo(() => {
    if (!articles) return [];
    if (previewCategory === "all") return articles.slice(0, 20);
    return articles.filter((a) => a.category === previewCategory).slice(0, 20);
  }, [articles, previewCategory]);

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
            Crie slides de notícias por categoria e adicione às suas playlists
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
          <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Slide
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="slides" className="gap-2">
            <Tv className="h-4 w-4" />
            Slides Criados
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-2">
            <Eye className="h-4 w-4" />
            Pré-visualização
          </TabsTrigger>
        </TabsList>

        {/* ━━━ TAB: Slides ━━━ */}
        <TabsContent value="slides" className="mt-4">
          {/* View mode toggle */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {slides.length} {slides.length === 1 ? "slide criado" : "slides criados"}
            </p>
            <div className="flex items-center gap-1 border rounded-md p-0.5">
              <Button
                variant={slideViewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setSlideViewMode("grid")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={slideViewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setSlideViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {slidesLoading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando slides...</div>
          ) : slides.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Newspaper className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-1">Nenhum slide de notícias</h3>
                <p className="text-muted-foreground text-sm max-w-sm mb-6">
                  Crie seu primeiro slide de notícias para exibir nas suas TVs. 
                  Escolha uma categoria e ele será atualizado automaticamente.
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
                  articlesCount={
                    articles?.filter((a) =>
                      slide.metadata?.news_category ? a.category === slide.metadata.news_category : true
                    ).length || 0
                  }
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
                  articlesCount={
                    articles?.filter((a) =>
                      slide.metadata?.news_category ? a.category === slide.metadata.news_category : true
                    ).length || 0
                  }
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ━━━ TAB: Preview ━━━ */}
        <TabsContent value="preview" className="mt-4">
          <div className="space-y-4">
            {/* Category filter bar */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={previewCategory === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setPreviewCategory("all")}
                className="rounded-full"
              >
                Todas
              </Button>
              {categories?.map((cat) => (
                <Button
                  key={cat}
                  variant={previewCategory === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPreviewCategory(cat)}
                  className="rounded-full"
                >
                  {cat}
                </Button>
              ))}
            </div>

            {/* Preview area */}
            <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
              {/* Simulated TV header */}
              <div className="bg-gradient-to-r from-foreground/95 to-foreground/80 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                  <span className="text-background font-semibold text-sm tracking-wider uppercase">
                    Notícias {previewCategory !== "all" ? `• ${previewCategory}` : ""}
                  </span>
                </div>
                <span className="text-background/60 text-xs">
                  {format(new Date(), "HH:mm • dd MMM yyyy", { locale: ptBR })}
                </span>
              </div>

              {/* Articles */}
              <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
                {filteredArticles.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Newspaper className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">Sem notícias nesta categoria</p>
                    <p className="text-xs mt-1">Clique em "Atualizar" para coletar as últimas notícias</p>
                  </div>
                ) : (
                  filteredArticles.map((article) => (
                    <PreviewArticleCard key={article.id} article={article} />
                  ))
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Mostrando {filteredArticles.length} de {articles?.length || 0} notícias disponíveis
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── Create Dialog ─── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Slide de Notícias</DialogTitle>
            <DialogDescription>
              Escolha uma categoria. As notícias serão atualizadas automaticamente no dispositivo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={slideName}
                onChange={(e) => setSlideName(e.target.value)}
                placeholder="Ex: Notícias de Economia"
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={slideCategory} onValueChange={setSlideCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {categories?.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Duração na playlist (segundos)</Label>
              <Select value={String(slideDuration)} onValueChange={(v) => setSlideDuration(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10s</SelectItem>
                  <SelectItem value="15">15s</SelectItem>
                  <SelectItem value="20">20s</SelectItem>
                  <SelectItem value="30">30s</SelectItem>
                  <SelectItem value="60">60s</SelectItem>
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

      {/* ─── Delete Confirmation ─── */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover slide?</DialogTitle>
            <DialogDescription>
              O slide "{selectedSlide?.name}" será removido da biblioteca de mídias.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => selectedSlide && deleteSlide.mutate(selectedSlide.id)}
              disabled={deleteSlide.isPending}
            >
              {deleteSlide.isPending ? "Removendo..." : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sub-components ───

function SlideCard({ slide, onDelete, articlesCount }: { slide: NewsSlide; onDelete: () => void; articlesCount: number }) {
  const category = slide.metadata?.news_category || "Todas";
  return (
    <Card className="group hover:shadow-md transition-all overflow-hidden">
      {/* Color strip */}
      <div className="h-1.5 bg-gradient-to-r from-primary to-primary/50" />
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 min-w-0 flex-1">
            <h3 className="font-semibold truncate">{slide.name}</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">{category}</Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {slide.duration || 15}s
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
            onClick={onDelete}
          >
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
  return (
    <div className="group flex items-center gap-4 p-3 rounded-lg border bg-card hover:shadow-sm transition-all">
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Newspaper className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium truncate">{slide.name}</h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
          <Badge variant="secondary" className="text-xs">{category}</Badge>
          <span>{slide.duration || 15}s</span>
          <span>{articlesCount} notícias</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
        {format(new Date(slide.created_at), "dd/MM/yy", { locale: ptBR })}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive shrink-0"
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function PreviewArticleCard({ article }: { article: NewsArticle }) {
  return (
    <div className="flex gap-4 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors group">
      {article.image_url && (
        <div className="w-24 h-16 rounded-md overflow-hidden shrink-0 bg-muted">
          <img
            src={article.image_url}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        </div>
      )}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
            {article.category}
          </Badge>
          <span className="text-[10px] text-muted-foreground truncate">
            {article.source} • {format(new Date(article.published_at), "HH:mm", { locale: ptBR })}
          </span>
        </div>
        <h4 className="text-sm font-medium leading-snug line-clamp-2">{article.title}</h4>
      </div>
    </div>
  );
}
