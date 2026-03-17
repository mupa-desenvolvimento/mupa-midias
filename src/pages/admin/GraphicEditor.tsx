import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronDown, ChevronUp, Circle, Eye, EyeOff, GripVertical, Image as ImageIcon, Lock, Minus, Square, Star, Triangle, Type, Unlock } from "lucide-react";
import { useFabricCanvas } from "@/components/graphic-editor/useFabricCanvas";
import { EditorTopbar } from "@/components/graphic-editor/EditorTopbar";
import { EditorSidebar } from "@/components/graphic-editor/EditorSidebar";
import { EditorProperties } from "@/components/graphic-editor/EditorProperties";
import { SaveToFolderDialog } from "@/components/graphic-editor/SaveToFolderDialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { LayerItem } from "@/components/graphic-editor/useFabricCanvas";
import { PRESET_TEMPLATES, type PresetTemplate } from "@/components/graphic-editor/presetTemplates";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useMediaItems } from "@/hooks/useMediaItems";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function LayerTypeGlyph({ type }: { type: string }) {
  const t = (type || "").toLowerCase();
  if (t === "i-text" || t === "text") return <Type className="h-3.5 w-3.5 text-muted-foreground" />;
  if (t === "image") return <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />;
  if (t === "rect") return <Square className="h-3.5 w-3.5 text-muted-foreground" />;
  if (t === "circle") return <Circle className="h-3.5 w-3.5 text-muted-foreground" />;
  if (t === "triangle") return <Triangle className="h-3.5 w-3.5 text-muted-foreground" />;
  if (t === "line") return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  if (t === "polygon") return <Star className="h-3.5 w-3.5 text-muted-foreground" />;
  return <Square className="h-3.5 w-3.5 text-muted-foreground" />;
}

function SortableLayerRow({
  layer,
  onSelect,
  onToggleVisible,
  onToggleLocked,
}: {
  layer: LayerItem;
  onSelect: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleLocked: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: layer.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="touch-none">
      <button
        type="button"
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md border ${
          layer.active ? "bg-accent border-border" : "bg-muted/40 border-border/60 hover:bg-muted/60"
        } ${isDragging ? "opacity-70" : ""}`}
        onClick={() => onSelect(layer.id)}
      >
        <span
          {...attributes}
          {...listeners}
          className="p-1 rounded text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </span>

        <LayerTypeGlyph type={layer.type} />

        <span className="flex-1 min-w-0 text-left">
          <span className="block text-xs font-medium truncate">{layer.name}</span>
        </span>

        <span className="flex items-center gap-1">
          <span
            className="p-1 rounded hover:bg-accent"
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisible(layer.id);
            }}
            role="button"
            tabIndex={0}
            aria-label={layer.visible ? "Ocultar" : "Mostrar"}
          >
            {layer.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </span>
          <span
            className="p-1 rounded hover:bg-accent"
            onClick={(e) => {
              e.stopPropagation();
              onToggleLocked(layer.id);
            }}
            role="button"
            tabIndex={0}
            aria-label={layer.locked ? "Desbloquear" : "Bloquear"}
          >
            {layer.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
          </span>
        </span>
      </button>
    </div>
  );
}

function FloatingLayersPanel({
  layers,
  onSelectLayer,
  onToggleLayerVisible,
  onToggleLayerLocked,
  onMoveLayerToListIndex,
  boundsRef,
}: {
  layers: LayerItem[];
  onSelectLayer: (id: string) => void;
  onToggleLayerVisible: (id: string) => void;
  onToggleLayerLocked: (id: string) => void;
  onMoveLayerToListIndex: (id: string, toIndex: number) => void;
  boundsRef: React.RefObject<HTMLElement>;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [orderedIds, setOrderedIds] = useState<string[]>(() => layers.map((l) => l.id));
  const panelRef = useRef<HTMLDivElement>(null);
  const isDraggingPanelRef = useRef(false);
  const dragStartRef = useRef<{ clientX: number; clientY: number; x: number; y: number; pointerId: number } | null>(null);

  const storageKey = "graphic-editor-floating-layers-panel";
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return !!parsed?.collapsed;
    } catch {
      return false;
    }
  });
  const [pos, setPos] = useState<{ x: number; y: number } | null>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const x = typeof parsed?.x === "number" ? parsed.x : null;
      const y = typeof parsed?.y === "number" ? parsed.y : null;
      if (x === null || y === null) return null;
      return { x, y };
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ ...pos, collapsed }));
    } catch {
      void 0;
    }
  }, [collapsed, pos]);

  useEffect(() => {
    if (pos) return;
    const boundsEl = boundsRef.current;
    if (!boundsEl) return;
    const bounds = boundsEl.getBoundingClientRect();
    const panelWidth = panelRef.current?.getBoundingClientRect().width || 280;
    setPos({ x: Math.max(0, bounds.width - panelWidth - 24), y: 24 });
  }, [boundsRef, pos]);

  useEffect(() => {
    const ids = layers.map((l) => l.id);
    setOrderedIds((prev) => {
      const set = new Set(ids);
      const kept = prev.filter((id) => set.has(id));
      const missing = ids.filter((id) => !kept.includes(id));
      return [...kept, ...missing];
    });
  }, [layers]);

  const orderedLayers = orderedIds.map((id) => layers.find((l) => l.id === id)).filter(Boolean) as LayerItem[];

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedIds.indexOf(active.id as string);
    const newIndex = orderedIds.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;
    setOrderedIds((prev) => arrayMove(prev, oldIndex, newIndex));
    onMoveLayerToListIndex(active.id as string, newIndex);
  };

  const clampToBounds = useCallback(
    (nextX: number, nextY: number) => {
      const boundsEl = boundsRef.current;
      const panelEl = panelRef.current;
      if (!boundsEl || !panelEl) return { x: nextX, y: nextY };
      const bounds = boundsEl.getBoundingClientRect();
      const rect = panelEl.getBoundingClientRect();
      const maxX = Math.max(0, bounds.width - rect.width);
      const maxY = Math.max(0, bounds.height - rect.height);
      return {
        x: Math.min(Math.max(0, nextX), maxX),
        y: Math.min(Math.max(0, nextY), maxY),
      };
    },
    [boundsRef]
  );

  const onHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (!pos) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-no-drag]")) return;

    isDraggingPanelRef.current = true;
    dragStartRef.current = { clientX: e.clientX, clientY: e.clientY, x: pos.x, y: pos.y, pointerId: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onHeaderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingPanelRef.current) return;
    const start = dragStartRef.current;
    if (!start || start.pointerId !== e.pointerId) return;
    const nextX = start.x + (e.clientX - start.clientX);
    const nextY = start.y + (e.clientY - start.clientY);
    setPos(clampToBounds(nextX, nextY));
  };

  const endPanelDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start || start.pointerId !== e.pointerId) return;
    isDraggingPanelRef.current = false;
    dragStartRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      void 0;
    }
  };

  const positionStyle = pos ? { left: pos.x, top: pos.y } : { right: 24, top: 24 };

  return (
    <div
      ref={panelRef}
      className={`absolute w-[280px] bg-card border border-border rounded-xl shadow-lg overflow-hidden flex flex-col ${collapsed ? "" : "max-h-[70%]"}`}
      style={positionStyle}
    >
      <div
        className="px-3 py-2 border-b border-border flex items-center justify-between select-none cursor-grab active:cursor-grabbing"
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={endPanelDrag}
        onPointerCancel={endPanelDrag}
      >
        <div className="flex items-center gap-2 min-w-0">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <div className="text-sm font-semibold truncate">Layers</div>
          <div className="text-xs text-muted-foreground">{layers.length}</div>
        </div>
        <button
          type="button"
          data-no-drag
          className="p-1 rounded hover:bg-accent"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expandir" : "Minimizar"}
        >
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>

      {!collapsed && (
        <div className="flex-1 min-h-0">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
            <ScrollArea className="h-full">
              <div className="p-2 space-y-1">
                {orderedLayers.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">Sem camadas</div>
                ) : (
                  orderedLayers.map((layer) => (
                    <SortableLayerRow
                      key={layer.id}
                      layer={layer}
                      onSelect={onSelectLayer}
                      onToggleVisible={onToggleLayerVisible}
                      onToggleLocked={onToggleLayerLocked}
                    />
                  ))
                )}
                <div className="pt-2">
                  <div className="px-2 py-1.5 rounded-md border border-border/60 bg-muted/30 text-xs text-muted-foreground flex items-center justify-between">
                    <span>Background</span>
                    <span className="opacity-70">•</span>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </SortableContext>
        </DndContext>
        </div>
      )}
    </div>
  );
}

export default function GraphicEditor() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templates, setTemplates] = useState<any[]>([]);

  const {
    initCanvas, canvasElRef,
    selectedObject, projectName, setProjectName, zoom,
    showGrid, toggleGrid, canvasBgColor, changeCanvasBg,
    canvasWidth, canvasHeight, resizeCanvas, swapCanvasOrientation,
    addText, addRect, addCircle, addLine, addTriangle, addStar, addPolygon,
    addImage, addImageFromUrl,
    addSVGFromString, addSVGFromURL,
    deleteSelected, duplicateSelected, bringToFront, sendToBack,
    layers, selectLayer, toggleLayerVisible, toggleLayerLocked, moveLayerForward, moveLayerBackward, moveLayerToListIndex, renameLayer,
    updateObjectProp,
    undo, redo, exportPNG, exportSVG, saveProject, handleZoom, handleWheelNavigation,
    getCanvasDataUrl,
    getProjectData, loadProjectData,
    alignmentSettings, updateAlignmentSettings,
    setViewportSize,
  } = useFabricCanvas();

  const { mediaItems, isLoading: galleryLoading, refetch: refetchMediaItems } = useMediaItems(undefined);

  useEffect(() => {
    const el = canvasElRef.current;
    if (el) initCanvas(el, canvasContainerRef.current);
  }, [canvasElRef, initCanvas]);

  // Auto-load preset template from URL param
  const templateAppliedRef = useRef(false);
  useEffect(() => {
    if (templateAppliedRef.current) return;
    const templateId = searchParams.get("template");
    if (!templateId) return;
    const preset = PRESET_TEMPLATES.find((t) => t.id === templateId);
    if (!preset) return;
    templateAppliedRef.current = true;
    // Small delay to ensure canvas is initialized
    const timer = setTimeout(() => {
      loadProjectData({
        name: preset.name,
        canvas: preset.canvas,
        bgColor: preset.bgColor,
        width: preset.width,
        height: preset.height,
      }).then(() => {
        toast.success(`Template "${preset.name}" carregado!`);
      }).catch(() => {
        toast.error("Falha ao carregar template");
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [searchParams, loadProjectData]);

  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;
    const apply = () => setViewportSize(container.clientWidth, container.clientHeight);
    apply();
    const ro = new ResizeObserver(() => apply());
    ro.observe(container);
    return () => ro.disconnect();
  }, [setViewportSize]);

  useEffect(() => {
    const raw = localStorage.getItem("graphic-editor-templates");
    if (!raw) { setTemplates([]); return; }
    try {
      const parsed = JSON.parse(raw);
      setTemplates(Array.isArray(parsed) ? parsed : []);
    } catch {
      setTemplates([]);
    }
  }, []);

  const persistTemplates = useCallback((next: any[]) => {
    setTemplates(next);
    localStorage.setItem("graphic-editor-templates", JSON.stringify(next));
  }, []);

  const handleSaveTemplate = useCallback(() => {
    const data = getProjectData();
    if (!data) {
      toast.error("Canvas não carregado");
      return;
    }
    const name = (templateName || projectName).trim();
    if (!name) {
      toast.error("Informe um nome para o template");
      return;
    }
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const item = { id, name, createdAt: new Date().toISOString(), project: { ...data, name } };
    persistTemplates([item, ...templates]);
    setTemplateName("");
    toast.success("Template salvo");
  }, [getProjectData, templateName, projectName, persistTemplates, templates]);

  const handleApplyTemplate = useCallback(async (tpl: any) => {
    if (!tpl?.project) return;
    try {
      await loadProjectData(tpl.project);
      toast.success("Template aplicado");
      setShowTemplatesDialog(false);
    } catch {
      toast.error("Falha ao aplicar template");
    }
  }, [loadProjectData]);

  const handleApplyPresetTemplate = useCallback(async (preset: PresetTemplate) => {
    try {
      await loadProjectData({
        name: preset.name,
        canvas: preset.canvas,
        bgColor: preset.bgColor,
        width: preset.width,
        height: preset.height,
      });
      toast.success(`Template "${preset.name}" aplicado!`);
      setShowTemplatesDialog(false);
    } catch {
      toast.error("Falha ao aplicar template");
    }
  }, [loadProjectData]);

  const handleDeleteTemplate = useCallback((id: string) => {
    const next = templates.filter((t) => t.id !== id);
    persistTemplates(next);
    toast.success("Template removido");
  }, [templates, persistTemplates]);

  // Wheel zoom
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;
    const handler = (e: WheelEvent) => {
      handleWheelNavigation(e);
      e.preventDefault();
    };
    container.addEventListener("wheel", handler, { passive: false });
    return () => container.removeEventListener("wheel", handler);
  }, [handleWheelNavigation]);

  const handleSaveToGallery = useCallback(async (folderId: string | null, fileName: string) => {
    const dataUrl = getCanvasDataUrl();
    if (!dataUrl) throw new Error("Falha ao capturar canvas");

    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], `${fileName}.png`, { type: "image/png" });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Não autenticado");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", fileName);
    formData.append("type", "image");
    if (folderId) formData.append("folder_id", folderId);

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-media`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: "Erro desconhecido" }));
      throw new Error(err.error || "Erro ao salvar");
    }

    saveProject();
    toast.success("Imagem salva na galeria!");
  }, [getCanvasDataUrl, saveProject]);

  const galleryItems = mediaItems
    .filter((m) => m.type !== "font")
    .map((m) => ({
      id: m.id,
      name: m.name,
      file_url: m.file_url,
      thumbnail_url: m.thumbnail_url,
      type: m.type,
    }));

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-card">
      {/* Topbar */}
      <div className="flex items-center">
        <Button
          variant="ghost" size="icon"
          className="h-14 w-12 rounded-none border-r border-border shrink-0"
          onClick={() => navigate("/admin/canva")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <EditorTopbar
            projectName={projectName}
            setProjectName={setProjectName}
            zoom={zoom}
            onUndo={undo}
            onRedo={redo}
            onExportPNG={exportPNG}
            onExportSVG={exportSVG}
            onSave={() => { saveProject(); toast.success("Projeto salvo localmente!"); }}
            onSaveToGallery={() => setShowSaveDialog(true)}
            onZoom={handleZoom}
            onOpenTemplates={() => setShowTemplatesDialog(true)}
          />
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <EditorSidebar
          onAddText={addText}
          onAddRect={addRect}
          onAddCircle={addCircle}
          onAddLine={addLine}
          onAddTriangle={addTriangle}
          onAddStar={addStar}
          onAddPolygon={addPolygon}
          onAddImage={addImage}
          onAddImageFromUrl={addImageFromUrl}
          onAddSVGFromString={addSVGFromString}
          onSvgSaved={async () => { await refetchMediaItems(); }}
          onDelete={deleteSelected}
          onDuplicate={duplicateSelected}
          onBringToFront={bringToFront}
          onSendToBack={sendToBack}
          onToggleGrid={toggleGrid}
          hasSelection={!!selectedObject}
          showGrid={showGrid}
          layers={layers}
          onSelectLayer={selectLayer}
          onToggleLayerVisible={toggleLayerVisible}
          onToggleLayerLocked={toggleLayerLocked}
          onMoveLayerForward={moveLayerForward}
          onMoveLayerBackward={moveLayerBackward}
          onRenameLayer={renameLayer}
          galleryItems={galleryItems}
          galleryLoading={galleryLoading}
        />

        {/* Canvas area */}
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              ref={canvasContainerRef}
              className="flex-1 overflow-hidden bg-muted/30 relative"
            >
              {showGrid && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage: "linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)",
                    backgroundSize: "20px 20px",
                  }}
                />
              )}
              <canvas ref={canvasElRef} className="block rounded-lg" />
              <FloatingLayersPanel
                layers={layers}
                onSelectLayer={selectLayer}
                onToggleLayerVisible={toggleLayerVisible}
                onToggleLayerLocked={toggleLayerLocked}
                onMoveLayerToListIndex={moveLayerToListIndex}
                boundsRef={canvasContainerRef}
              />
            </div>
          </ContextMenuTrigger>

          <ContextMenuContent className="w-56">
            <ContextMenuLabel>Editor</ContextMenuLabel>
            <ContextMenuItem onSelect={() => addText()}>
              Adicionar texto
            </ContextMenuItem>
            <ContextMenuSeparator />

            <ContextMenuItem onSelect={() => undo()}>
              Desfazer
              <ContextMenuShortcut>Ctrl+Z</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => redo()}>
              Refazer
              <ContextMenuShortcut>Ctrl+Y</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuSeparator />

            <ContextMenuItem disabled={!selectedObject} onSelect={() => duplicateSelected()}>
              Duplicar
              <ContextMenuShortcut>Ctrl+D</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem disabled={!selectedObject} onSelect={() => bringToFront()}>
              Trazer para frente
            </ContextMenuItem>
            <ContextMenuItem disabled={!selectedObject} onSelect={() => sendToBack()}>
              Enviar para trás
            </ContextMenuItem>
            <ContextMenuItem disabled={!selectedObject} onSelect={() => deleteSelected()}>
              Excluir
              <ContextMenuShortcut>Del</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuSeparator />

            <ContextMenuCheckboxItem checked={showGrid} onCheckedChange={() => toggleGrid()}>
              Mostrar grade
            </ContextMenuCheckboxItem>

            <ContextMenuSeparator />

            <ContextMenuItem onSelect={() => setShowTemplatesDialog(true)}>
              Templates
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        {/* Right sidebar */}
        <EditorProperties
          selected={selectedObject}
          onUpdate={updateObjectProp}
          canvasBgColor={canvasBgColor}
          onCanvasBgChange={changeCanvasBg}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          onCanvasResize={resizeCanvas}
          onCanvasSwapOrientation={swapCanvasOrientation}
          alignmentSettings={alignmentSettings}
          onAlignmentSettingsChange={updateAlignmentSettings}
        />
      </div>

      {/* Save to folder dialog */}
      <SaveToFolderDialog
        open={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        projectName={projectName}
        onSave={handleSaveToGallery}
      />

      <Dialog open={showTemplatesDialog} onOpenChange={(o) => !o && setShowTemplatesDialog(false)}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Templates</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="presets" className="flex-1 min-h-0">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="presets">Templates Prontos</TabsTrigger>
              <TabsTrigger value="saved">Meus Templates ({templates.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="presets" className="mt-4">
              <ScrollArea className="h-[50vh]">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pr-4">
                  {PRESET_TEMPLATES.map((preset) => (
                    <button
                      key={preset.id}
                      className="group relative rounded-xl border border-border/60 overflow-hidden hover:border-primary/60 hover:shadow-lg hover:shadow-primary/10 transition-all text-left"
                      onClick={() => handleApplyPresetTemplate(preset)}
                    >
                      <div
                        className="aspect-[9/16] max-h-[200px] flex flex-col items-center justify-center p-4"
                        style={{ backgroundColor: preset.bgColor }}
                      >
                        <span className="text-4xl mb-2">{preset.icon}</span>
                        <span className="text-white text-xs font-semibold text-center leading-tight">{preset.name}</span>
                      </div>
                      <div className="p-2.5 bg-card">
                        <div className="text-xs font-medium truncate">{preset.name}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {preset.width}×{preset.height} • {preset.category}
                        </div>
                        <p className="text-[10px] text-muted-foreground/70 mt-1 line-clamp-2">{preset.description}</p>
                      </div>
                      <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="saved" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Salvar template do layout atual</Label>
                <div className="flex gap-2">
                  <Input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Nome do template"
                    className="h-9"
                  />
                  <Button className="h-9" onClick={handleSaveTemplate}>Salvar</Button>
                </div>
              </div>

              <Separator />

              <ScrollArea className="h-[40vh]">
                <div className="space-y-1">
                  {templates.length === 0 ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">Nenhum template salvo</div>
                  ) : (
                    templates.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{t.name}</div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {t.project?.width}×{t.project?.height} • {new Date(t.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <Button variant="outline" size="sm" className="h-8" onClick={() => handleApplyTemplate(t)}>
                          Usar
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 text-destructive" onClick={() => handleDeleteTemplate(t.id)}>
                          Excluir
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplatesDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
