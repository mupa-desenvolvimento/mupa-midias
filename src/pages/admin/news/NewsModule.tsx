
import { useNews, NewsSettings } from "@/hooks/useNews";
import { NewsFeedManager } from "@/components/news/NewsFeedManager";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RefreshCw, List } from "lucide-react";
import { NewsContainer } from "@/components/news/NewsContainer";

export function NewsModule() {
  const { 
    settings, 
    articles, 
    categories,
    isLoading, 
    updateSettings, 
    triggerCollection 
  } = useNews();
  
  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Carregando módulo de notícias...</div>;
  }

  // Ensure settings has default values if null (though hook handles this, safe to check)
  const currentSettings: NewsSettings = settings || {
    id: "default-settings",
    type_view: "list",
    display_time: 10,
    max_items: 20,
    theme_mode: "light",
    layout_type: "modern",
    active_categories: []
  };

  // Filter articles for preview based on active_categories
  const previewArticles = (articles || []).filter(article => {
    if (!currentSettings.active_categories || currentSettings.active_categories.length === 0) return true;
    return currentSettings.active_categories.includes(article.category);
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Settings & Feeds */}
        <div className="lg:col-span-2 space-y-6">
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
                              // Currently "All" (empty). Unchecking one means selecting all others.
                              if (checked === false && categories) {
                                newCats = categories.filter(c => c !== cat);
                              } else {
                                // If checked is true, but we are already at "All", nothing changes.
                                // Wait, if I click a checked box, it becomes unchecked (false).
                                // So this branch is for when checked === true.
                                // If I force check? No, user interaction toggles.
                                newCats = []; 
                              }
                            } else {
                              // Specific selection
                              if (checked) {
                                newCats = [...currentCats, cat];
                              } else {
                                newCats = currentCats.filter(c => c !== cat);
                              }
                            }
                            
                            // Optimization: If newCats has all categories, reset to empty
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
                Como aparecerá na TV.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="aspect-video w-full bg-slate-100 dark:bg-slate-950 rounded-lg overflow-hidden border shadow-sm relative">
                {/* We simulate the container with the current settings and mocked/real data */}
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
    </div>
  );
}
