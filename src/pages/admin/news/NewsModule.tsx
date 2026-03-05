
import { useState } from "react";
import { useNews, NewsSettings } from "@/hooks/useNews";
import { NewsFeedManager } from "@/components/news/NewsFeedManager";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RefreshCw, List, Tv, Plus } from "lucide-react";
import { NewsContainer } from "@/components/news/NewsContainer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function NewsModule() {
  const queryClient = useQueryClient();
  const { 
    settings, 
    articles, 
    categories,
    isLoading, 
    updateSettings, 
    triggerCollection 
  } = useNews();
  const [isSlideDialogOpen, setIsSlideDialogOpen] = useState(false);
  const [slideName, setSlideName] = useState("");
  const [slideCategory, setSlideCategory] = useState("all");
  const [slideDuration, setSlideDuration] = useState(15);
  const [creatingSlide, setCreatingSlide] = useState(false);

  const handleCreateSlide = async () => {
    if (!slideName.trim()) {
      toast.error("Informe um nome para o slide");
      return;
    }
    setCreatingSlide(true);
    try {
      const metadata = {
        news_category: slideCategory === "all" ? null : slideCategory,
        news_layout: settings?.layout_type || "modern",
        news_theme: settings?.theme_mode || "dark",
        news_view: settings?.type_view || "list",
        news_max_items: settings?.max_items || 20,
      };

      const { error } = await supabase
        .from("media_items")
        .insert({
          name: slideName,
          type: "news",
          status: "active",
          duration: slideDuration,
          metadata,
        });

      if (error) throw error;

      toast.success("Slide de notícias criado! Agora adicione-o a uma playlist.");
      queryClient.invalidateQueries({ queryKey: ["media-items"] });
      setIsSlideDialogOpen(false);
      setSlideName("");
      setSlideCategory("all");
      setSlideDuration(15);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao criar slide de notícias");
    } finally {
      setCreatingSlide(false);
    }
  };
  
  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Carregando módulo de notícias...</div>;
  }

  const currentSettings: NewsSettings = settings || {
    id: "default-settings",
    type_view: "list",
    display_time: 10,
    max_items: 20,
    theme_mode: "light",
    layout_type: "modern",
    active_categories: []
  };

  const previewArticles = (articles || []).filter(article => {
    if (!currentSettings.active_categories || currentSettings.active_categories.length === 0) return true;
    return currentSettings.active_categories.includes(article.category);
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Settings & Feeds */}
        <div className="lg:col-span-2 space-y-6">
          {/* Slide Creation Card */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Tv className="h-5 w-5" />
                    Slides de Notícias para TV
                  </CardTitle>
                  <CardDescription>
                    Crie slides de notícias por categoria e adicione-os às suas playlists.
                  </CardDescription>
                </div>
                <Button onClick={() => setIsSlideDialogOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Criar Slide
                </Button>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <List className="h-5 w-5" />
                    Gerenciamento de Feeds
                  </CardTitle>
                  <CardDescription>
                    Configure as fontes de notícias (RSS) e categorias.
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => triggerCollection.mutate()}
                  disabled={triggerCollection.isPending}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${triggerCollection.isPending ? 'animate-spin' : ''}`} />
                  {triggerCollection.isPending ? "Coletando..." : "Forçar Coleta"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <NewsFeedManager />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Configurações de Exibição</CardTitle>
              <CardDescription>
                Personalize como as notícias aparecem na tela.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Categorias Ativas</Label>
                  <span className="text-xs text-muted-foreground">
                    {currentSettings.active_categories.length === 0 
                      ? "Todas as categorias exibidas" 
                      : `${currentSettings.active_categories.length} selecionadas`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 p-4 border rounded-md bg-muted/20 min-h-[80px]">
                  {(!categories || categories.length === 0) && (
                    <div className="w-full text-center text-sm text-muted-foreground flex flex-col items-center justify-center h-full">
                      <span>Nenhuma categoria encontrada.</span>
                      <span className="text-xs opacity-70">Adicione feeds RSS para carregar categorias.</span>
                    </div>
                  )}
                  {categories?.map((cat) => {
                    const isSelected = currentSettings.active_categories.length === 0 || currentSettings.active_categories.includes(cat);
                    return (
                      <div key={cat} className="flex items-center space-x-2 bg-background p-2 rounded border shadow-sm">
                        <Checkbox 
                          id={`cat-${cat}`} 
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            const currentCats = currentSettings.active_categories || [];
                            let newCats: string[] = [];
                            
                            if (currentCats.length === 0) {
                              if (checked === false && categories) {
                                newCats = categories.filter(c => c !== cat);
                              } else {
                                newCats = []; 
                              }
                            } else {
                              if (checked) {
                                newCats = [...currentCats, cat];
                              } else {
                                newCats = currentCats.filter(c => c !== cat);
                              }
                            }
                            
                            if (categories && newCats.length === categories.length) {
                              newCats = [];
                            }
                            
                            updateSettings.mutate({ active_categories: newCats });
                          }}
                        />
                        <Label htmlFor={`cat-${cat}`} className="cursor-pointer text-sm font-medium">{cat}</Label>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Modo de Visualização</Label>
                  <Select
                    value={currentSettings.type_view}
                    onValueChange={(val: any) => updateSettings.mutate({ type_view: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="list">Lista Vertical</SelectItem>
                      <SelectItem value="grid">Grade (Grid)</SelectItem>
                      <SelectItem value="ticker">Ticker (Rodapé)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Layout do Card</Label>
                  <Select
                    value={currentSettings.layout_type}
                    onValueChange={(val: any) => updateSettings.mutate({ layout_type: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="modern">Moderno</SelectItem>
                      <SelectItem value="classic">Clássico</SelectItem>
                      <SelectItem value="minimal">Minimalista</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tempo de Exibição (segundos)</Label>
                  <Select
                    value={String(currentSettings.display_time)}
                    onValueChange={(val) => updateSettings.mutate({ display_time: parseInt(val) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 segundos</SelectItem>
                      <SelectItem value="10">10 segundos</SelectItem>
                      <SelectItem value="15">15 segundos</SelectItem>
                      <SelectItem value="20">20 segundos</SelectItem>
                      <SelectItem value="30">30 segundos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tema</Label>
                  <Select
                    value={currentSettings.theme_mode}
                    onValueChange={(val: any) => updateSettings.mutate({ theme_mode: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Claro</SelectItem>
                      <SelectItem value="dark">Escuro</SelectItem>
                      <SelectItem value="system">Sistema</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Preview */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Pré-visualização</CardTitle>
              <CardDescription>
                Como aparecerá na TV. {articles?.length || 0} notícias disponíveis.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="aspect-video w-full bg-slate-100 dark:bg-slate-950 rounded-lg overflow-hidden border shadow-sm relative">
                <div className="absolute inset-0 overflow-auto">
                   <NewsContainer 
                     settings={currentSettings}
                     articles={previewArticles}
                     preview={true}
                   />
                </div>
              </div>
              <div className="mt-4 text-xs text-muted-foreground text-center">
                * A visualização pode variar dependendo da resolução da tela.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Slide Dialog */}
      <Dialog open={isSlideDialogOpen} onOpenChange={setIsSlideDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Slide de Notícias</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Slide</Label>
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
              <Label>Duração (segundos)</Label>
              <Select value={String(slideDuration)} onValueChange={(v) => setSlideDuration(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 segundos</SelectItem>
                  <SelectItem value="15">15 segundos</SelectItem>
                  <SelectItem value="20">20 segundos</SelectItem>
                  <SelectItem value="30">30 segundos</SelectItem>
                  <SelectItem value="60">60 segundos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <p className="text-xs text-muted-foreground">
              Após criar, o slide aparecerá na Biblioteca de Mídias do editor de playlist. 
              As notícias serão atualizadas automaticamente.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSlideDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateSlide} disabled={creatingSlide}>
              {creatingSlide ? "Criando..." : "Criar Slide"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
