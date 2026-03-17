import { useRef, useState, useCallback } from "react";
import {
  Type, Square, Circle, Minus, Triangle, Upload, Search, Loader2,
  Trash2, Copy, ArrowUpToLine, ArrowDownToLine, Star, Hexagon, Image as ImageIcon,
  Layers, GalleryHorizontalEnd, Grid3X3, Wrench, Eye, EyeOff, Lock, Unlock, ChevronUp, ChevronDown,
  Monitor, Smartphone, SquareIcon, ChevronLeft, ChevronRight, FileCode, Link,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { LayerItem } from "@/components/graphic-editor/useFabricCanvas";

interface MediaGalleryItem {
  id: string;
  name: string;
  file_url: string | null;
  thumbnail_url: string | null;
  type: string;
}

interface Props {
  onAddText: () => void;
  onAddRect: () => void;
  onAddCircle: () => void;
  onAddLine: () => void;
  onAddTriangle: () => void;
  onAddStar: () => void;
  onAddPolygon: () => void;
  onAddImage: (f: File) => void;
  onAddImageFromUrl: (url: string) => void;
  onAddSVGFromString?: (svg: string, name?: string) => Promise<any>;
  onAddSVGFromURL?: (url: string) => Promise<any>;
  onSvgSaved?: () => Promise<void> | void;
  onDelete: () => void;
  onDuplicate: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onToggleGrid: () => void;
  hasSelection: boolean;
  showGrid: boolean;
  layers: LayerItem[];
  onSelectLayer: (layerId: string) => void;
  onToggleLayerVisible: (layerId: string) => void;
  onToggleLayerLocked: (layerId: string) => void;
  onMoveLayerForward: (layerId: string) => void;
  onMoveLayerBackward: (layerId: string) => void;
  onRenameLayer: (layerId: string, name: string) => void;
  galleryItems: MediaGalleryItem[];
  galleryLoading: boolean;
}

type SearchSource = "pexels" | "unsplash";
type SearchOrientation = "" | "landscape" | "portrait" | "square";

interface SearchResult {
  id: string;
  url: string;
  thumb: string;
  source: string;
  photographer?: string;
  width?: number;
  height?: number;
}

export function EditorSidebar({
  onAddText, onAddRect, onAddCircle, onAddLine, onAddTriangle,
  onAddStar, onAddPolygon,
  onAddImage, onAddImageFromUrl,
  onAddSVGFromString, onAddSVGFromURL, onSvgSaved,
  onDelete, onDuplicate, onBringToFront, onSendToBack,
  onToggleGrid,
  hasSelection, showGrid,
  layers,
  onSelectLayer,
  onToggleLayerVisible,
  onToggleLayerLocked,
  onMoveLayerForward,
  onMoveLayerBackward,
  onRenameLayer,
  galleryItems, galleryLoading,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const svgFileRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeSource, setActiveSource] = useState<SearchSource>("pexels");
  const [orientation, setOrientation] = useState<SearchOrientation>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [galleryFilter, setGalleryFilter] = useState("");
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingLayerName, setEditingLayerName] = useState("");
  const [showSvgDialog, setShowSvgDialog] = useState(false);
  const [svgUrl, setSvgUrl] = useState("");
  const [svgLoading, setSvgLoading] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onAddImage(file);
    e.target.value = "";
  };

  const uploadSvgToGlobal = async (file: File): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error("Você precisa estar autenticado para importar SVGs.");
    }

    const normalizedName = file.name.toLowerCase().endsWith(".svg") ? file.name : `${file.name}.svg`;
    const normalizedFile = new File([file], normalizedName, { type: "image/svg+xml" });

    const formData = new FormData();
    formData.append("file", normalizedFile);
    formData.append("fileName", normalizedFile.name);
    formData.append("fileType", "image/svg+xml");

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-media`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      }
    );

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || result.details || "Erro ao salvar SVG no servidor.");
    }
    return result.fileUrl || result.file_url || result.url || result.proxyUrl || null;
  };

  const handleSvgFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onAddSVGFromString) return;
    e.target.value = "";

    if (!file.name.toLowerCase().endsWith('.svg') && !file.type.includes('svg')) {
      toast.error("Arquivo inválido. Selecione um arquivo .svg");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error(`Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Limite: 10MB.`);
      return;
    }

    setSvgLoading(true);
    try {
      const text = await file.text();
      await onAddSVGFromString(text, file.name.replace(/\.svg$/i, ""));
      await uploadSvgToGlobal(file);
      await onSvgSaved?.();
      toast.success("SVG importado e salvo na biblioteca!");
      setShowSvgDialog(false);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao importar SVG.");
    } finally {
      setSvgLoading(false);
    }
  };

  const handleSvgFromUrl = async () => {
    if (!svgUrl.trim() || !onAddSVGFromURL) return;

    try {
      new URL(svgUrl.trim());
    } catch {
      toast.error("URL inválida. Informe uma URL completa (ex: https://...)");
      return;
    }

    setSvgLoading(true);
    try {
      await onAddSVGFromURL(svgUrl.trim());

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Você precisa estar autenticado para importar SVGs.");

      const formData = new FormData();
      formData.append("sourceUrl", svgUrl.trim());
      formData.append("fileType", "image/svg+xml");

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-media`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || result.details || "Falha ao salvar SVG da URL na biblioteca.");
      }

      await onSvgSaved?.();
      toast.success("SVG importado e salvo na biblioteca!");
      setSvgUrl("");
      setShowSvgDialog(false);
    } catch (err: any) {
      toast.error(err?.message || "Falha ao carregar SVG da URL.");
    } finally {
      setSvgLoading(false);
    }
  };

  const searchImages = useCallback(async (page = 1, source?: SearchSource) => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    if (page === 1) setSearchResults([]);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-search`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({
            query: searchQuery.trim(),
            source: source || activeSource,
            per_page: 20,
            page,
            orientation: orientation || undefined,
          }),
        }
      );

      if (!response.ok) throw new Error("Search failed");
      const data = await response.json();
      const newResults = data.results || [];
      
      if (page === 1) {
        setSearchResults(newResults);
      } else {
        setSearchResults(prev => [...prev, ...newResults]);
      }
      setCurrentPage(page);
      setHasMore(data.hasMore || false);
      setTotalResults(data.total || 0);
    } catch (err) {
      console.error("Image search error:", err);
      if (page === 1) setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchQuery, activeSource, orientation]);

  const tools = [
    { icon: Type, label: "Texto", action: onAddText, color: "text-blue-500" },
    { icon: Square, label: "Retângulo", action: onAddRect, color: "text-indigo-500" },
    { icon: Circle, label: "Círculo", action: onAddCircle, color: "text-emerald-500" },
    { icon: Minus, label: "Linha", action: onAddLine, color: "text-muted-foreground" },
    { icon: Triangle, label: "Triângulo", action: onAddTriangle, color: "text-amber-500" },
    { icon: Star, label: "Estrela", action: onAddStar, color: "text-yellow-500" },
    { icon: Hexagon, label: "Polígono", action: onAddPolygon, color: "text-purple-500" },
  ];

  const filteredGallery = galleryItems.filter(
    (item) =>
      (item.type === "image" || item.type === "video") &&
      item.file_url &&
      (!galleryFilter || item.name.toLowerCase().includes(galleryFilter.toLowerCase()))
  );

  return (
    <div className="w-[300px] border-r border-border bg-card flex flex-col shrink-0 h-full">
      <Tabs defaultValue="tools" className="flex flex-col h-full">
        <TabsList className="mx-2 mt-2 grid grid-cols-4 h-9">
          <TabsTrigger value="tools" className="text-xs gap-1">
            <Wrench className="h-3 w-3" /> Ferramentas
          </TabsTrigger>
          <TabsTrigger value="search" className="text-xs gap-1">
            <Search className="h-3 w-3" /> Buscar
          </TabsTrigger>
          <TabsTrigger value="layers" className="text-xs gap-1">
            <Layers className="h-3 w-3" /> Camadas
          </TabsTrigger>
          <TabsTrigger value="gallery" className="text-xs gap-1">
            <GalleryHorizontalEnd className="h-3 w-3" /> Galeria
          </TabsTrigger>
        </TabsList>

        {/* Tools Tab */}
        <TabsContent value="tools" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-5">
              {/* Upload */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Mídia</p>
                <Button
                  variant="outline" size="sm" className="w-full h-9 gap-1.5 text-xs"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" /> Upload de Imagem
                </Button>
                <input
                  ref={fileRef} type="file" accept="image/*"
                  onChange={handleFileUpload} className="hidden"
                />
                <input
                  ref={svgFileRef} type="file" accept=".svg"
                  onChange={handleSvgFileUpload} className="hidden"
                />
              </div>

              <Separator />

              {/* Shapes */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Elementos</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                    onClick={() => setShowSvgDialog(true)}
                  >
                    <FileCode className="h-3.5 w-3.5" />
                    Importar SVG
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {tools.map((t) => (
                    <Button
                      key={t.label}
                      variant="outline"
                      size="sm"
                      className="h-14 flex-col gap-1 text-xs hover:bg-accent"
                      onClick={t.action}
                    >
                      <t.icon className={`h-5 w-5 ${t.color}`} />
                      {t.label}
                    </Button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Canvas options */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Canvas</p>
                <Button
                  variant={showGrid ? "secondary" : "outline"}
                  size="sm"
                  className="w-full h-9 gap-1.5 text-xs"
                  onClick={onToggleGrid}
                >
                  <Grid3X3 className="h-3.5 w-3.5" />
                  {showGrid ? "Ocultar Grid" : "Mostrar Grid"}
                </Button>
              </div>

              <Separator />

              {/* Object actions */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Ações do Objeto</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" disabled={!hasSelection} onClick={onDuplicate}>
                    <Copy className="h-3.5 w-3.5" /> Duplicar
                  </Button>
                  <Button variant="destructive" size="sm" className="h-9 gap-1.5 text-xs" disabled={!hasSelection} onClick={onDelete}>
                    <Trash2 className="h-3.5 w-3.5" /> Excluir
                  </Button>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" disabled={!hasSelection} onClick={onBringToFront}>
                    <ArrowUpToLine className="h-3.5 w-3.5" /> Frente
                  </Button>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" disabled={!hasSelection} onClick={onSendToBack}>
                    <ArrowDownToLine className="h-3.5 w-3.5" /> Trás
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Search Tab */}
        <TabsContent value="search" className="flex-1 overflow-hidden m-0">
          <div className="p-3 space-y-2">
            {/* Source selector */}
            <div className="flex gap-1">
              {(["pexels", "unsplash"] as SearchSource[]).map((src) => (
                <Badge
                  key={src}
                  variant={activeSource === src ? "default" : "outline"}
                  className="cursor-pointer text-[10px] capitalize"
                  onClick={() => { setActiveSource(src); if (searchQuery.trim()) setTimeout(() => searchImages(1, src), 100); }}
                >
                  {src === "pexels" ? "Pexels" : "Unsplash"}
                </Badge>
              ))}
            </div>

            {/* Orientation filter */}
            <div className="flex gap-1">
              {([
                { value: "" as SearchOrientation, icon: ImageIcon, label: "Todas" },
                { value: "landscape" as SearchOrientation, icon: Monitor, label: "Horizontal" },
                { value: "portrait" as SearchOrientation, icon: Smartphone, label: "Vertical" },
                { value: "square" as SearchOrientation, icon: SquareIcon, label: "Quadrada" },
              ]).map((opt) => (
                <Badge
                  key={opt.value}
                  variant={orientation === opt.value ? "default" : "outline"}
                  className="cursor-pointer text-[10px] gap-0.5"
                  onClick={() => { setOrientation(opt.value); if (searchQuery.trim()) setTimeout(() => searchImages(1), 100); }}
                >
                  <opt.icon className="h-2.5 w-2.5" />
                  {opt.label}
                </Badge>
              ))}
            </div>

            {/* Search input */}
            <div className="flex gap-1.5">
              <Input
                placeholder="Ex: supermercado, frutas, tecnologia..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchImages(1)}
                className="h-8 text-xs"
              />
              <Button size="icon" variant="default" className="h-8 w-8 shrink-0" onClick={() => searchImages(1)} disabled={searching}>
                {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              </Button>
            </div>

            {/* Results count */}
            {totalResults > 0 && (
              <p className="text-[10px] text-muted-foreground">
                {totalResults.toLocaleString("pt-BR")} resultados encontrados
              </p>
            )}
          </div>

          <ScrollArea className="flex-1" style={{ height: "calc(100% - 140px)" }}>
            <div className="px-3 pb-3">
              {searching && searchResults.length === 0 && (
                <div className="grid grid-cols-2 gap-1.5">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-[4/3] rounded-md" />
                  ))}
                </div>
              )}
              {searchResults.length > 0 && (
                <>
                  <div className="grid grid-cols-2 gap-1.5">
                    {searchResults.map((result) => (
                      <button
                        key={result.id}
                        className="aspect-[4/3] rounded-md overflow-hidden border border-border hover:border-primary hover:shadow-md transition-all group relative"
                        onClick={() => onAddImageFromUrl(result.url)}
                        title={result.photographer ? `📷 ${result.photographer}` : result.source}
                      >
                        <img src={result.thumb} alt="" className="w-full h-full object-cover" loading="lazy" crossOrigin="anonymous" />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity truncate">
                          {result.photographer ? `📷 ${result.photographer}` : result.source}
                        </div>
                      </button>
                    ))}
                  </div>
                  
                  {/* Load more / pagination */}
                  {hasMore && (
                    <div className="mt-3 flex justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5 w-full"
                        onClick={() => searchImages(currentPage + 1)}
                        disabled={searching}
                      >
                        {searching ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3 w-3" />}
                        Carregar mais
                      </Button>
                    </div>
                  )}
                </>
              )}
              {!searching && searchResults.length === 0 && (
                <div className="text-center py-8">
                  <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">Pesquise imagens gratuitas</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">Pexels e Unsplash</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Layers Tab */}
        <TabsContent value="layers" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-2">
              {layers.length === 0 ? (
                <div className="text-center py-8">
                  <Layers className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">Sem camadas</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">Adicione elementos para aparecer aqui</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {layers.map((layer) => {
                    const isEditing = editingLayerId === layer.id;
                    return (
                      <button
                        key={layer.id}
                        className={`w-full flex items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors ${
                          layer.active ? "bg-accent border-accent-foreground/10" : "border-border hover:bg-accent/60"
                        }`}
                        onClick={() => onSelectLayer(layer.id)}
                        onDoubleClick={() => { setEditingLayerId(layer.id); setEditingLayerName(layer.name); }}
                      >
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {layer.type}
                        </Badge>

                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <Input
                              value={editingLayerName}
                              autoFocus
                              className="h-7 text-xs"
                              onChange={(e) => setEditingLayerName(e.target.value)}
                              onBlur={() => {
                                onRenameLayer(layer.id, editingLayerName);
                                setEditingLayerId(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  onRenameLayer(layer.id, editingLayerName);
                                  setEditingLayerId(null);
                                }
                                if (e.key === "Escape") {
                                  setEditingLayerId(null);
                                }
                              }}
                            />
                          ) : (
                            <div className="text-xs truncate">{layer.name}</div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={(e) => { e.stopPropagation(); onMoveLayerForward(layer.id); }}
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={(e) => { e.stopPropagation(); onMoveLayerBackward(layer.id); }}
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={(e) => { e.stopPropagation(); onToggleLayerVisible(layer.id); }}
                          >
                            {layer.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={(e) => { e.stopPropagation(); onToggleLayerLocked(layer.id); }}
                          >
                            {layer.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Gallery Tab */}
        <TabsContent value="gallery" className="flex-1 overflow-hidden m-0">
          <div className="p-3">
            <Input
              placeholder="Filtrar galeria..."
              value={galleryFilter}
              onChange={(e) => setGalleryFilter(e.target.value)}
              className="h-8 text-xs"
            />
          </div>

          <ScrollArea className="flex-1" style={{ height: "calc(100% - 60px)" }}>
            <div className="px-3 pb-3">
              {galleryLoading ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-[4/3] rounded-md" />
                  ))}
                </div>
              ) : filteredGallery.length > 0 ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {filteredGallery.map((item) => (
                    <button
                      key={item.id}
                      className="aspect-[4/3] rounded-md overflow-hidden border border-border hover:border-primary hover:shadow-md transition-all group relative"
                      onClick={() => item.file_url && onAddImageFromUrl(item.file_url)}
                    >
                      <img
                        src={item.thumbnail_url || item.file_url || ""}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.name}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <GalleryHorizontalEnd className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">Nenhuma mídia encontrada</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">Suas imagens da biblioteca aparecem aqui</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* SVG Import Dialog */}
      <Dialog open={showSvgDialog} onOpenChange={setShowSvgDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCode className="h-5 w-5" /> Importar SVG
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs mb-2 block">Upload de arquivo .svg</Label>
              <Button
                variant="outline"
                className="w-full h-12 gap-2"
                onClick={() => svgFileRef.current?.click()}
                disabled={svgLoading}
              >
                {svgLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Selecionar arquivo SVG
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">ou</span>
              <Separator className="flex-1" />
            </div>

            <div>
              <Label className="text-xs mb-2 block">Carregar de URL</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://example.com/icon.svg"
                  value={svgUrl}
                  onChange={(e) => setSvgUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSvgFromUrl()}
                  className="h-10 text-sm"
                />
                <Button
                  onClick={handleSvgFromUrl}
                  disabled={!svgUrl.trim() || svgLoading}
                  className="h-10 shrink-0"
                >
                  {svgLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground">
              O SVG será salvo na biblioteca global (acessível para todos os usuários) e adicionado ao canvas atual.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
