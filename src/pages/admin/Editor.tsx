import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFabricCanvas } from "@/components/graphic-editor/useFabricCanvas";
import { EditorTopbar } from "@/components/graphic-editor/EditorTopbar";
import { EditorSidebar } from "@/components/graphic-editor/EditorSidebar";
import { EditorProperties } from "@/components/graphic-editor/EditorProperties";
import { SaveToFolderDialog } from "@/components/graphic-editor/SaveToFolderDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useMediaItems } from "@/hooks/useMediaItems";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { LayerItem } from "@/components/graphic-editor/useFabricCanvas";
import { DndContext, PointerSensor, closestCenter, type DragEndEvent, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown, ChevronUp, Circle, Eye, EyeOff, GripVertical, Image as ImageIcon, Lock, Minus, Plus, Square, Star, Triangle, Type, Unlock } from "lucide-react";
import type { Canvas } from "fabric";

function LayerTypeGlyph({ type }: { type: string }) {
  const t = (type || "").toLowerCase();
  if (t === "i-text" || t === "text") return <Type className="h-3.5 w-3.5 text-white/70" />;
  if (t === "image") return <ImageIcon className="h-3.5 w-3.5 text-white/70" />;
  if (t === "rect") return <Square className="h-3.5 w-3.5 text-white/70" />;
  if (t === "circle") return <Circle className="h-3.5 w-3.5 text-white/70" />;
  if (t === "triangle") return <Triangle className="h-3.5 w-3.5 text-white/70" />;
  if (t === "line") return <Minus className="h-3.5 w-3.5 text-white/70" />;
  if (t === "polygon") return <Star className="h-3.5 w-3.5 text-white/70" />;
  return <Square className="h-3.5 w-3.5 text-white/70" />;
}

function getObjectForLayer(canvas: Canvas | null, layerId: string) {
  if (!canvas) return null;
  return (
    canvas
      .getObjects()
      .find((o) => ((o as any).data?.layerId as string | undefined) === layerId) || null
  );
}

function LayerThumb({ layer, canvas }: { layer: LayerItem; canvas: Canvas | null }) {
  const obj = getObjectForLayer(canvas, layer.id) as any;
  const type = (layer.type || "").toLowerCase();

  if (type === "image") {
    const src =
      (typeof obj?.getSrc === "function" ? obj.getSrc() : null) ||
      obj?._originalElement?.src ||
      obj?._element?.src ||
      null;

    if (src) {
      return (
        <div className="h-8 w-8 rounded-md overflow-hidden border border-white/10 bg-white/5">
          <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" crossOrigin="anonymous" />
        </div>
      );
    }
  }

  const fill = typeof obj?.fill === "string" && obj.fill ? obj.fill : null;
  const stroke = typeof obj?.stroke === "string" && obj.stroke ? obj.stroke : null;
  const color = fill || stroke || "#ffffff";

  const text =
    (type === "i-text" || type === "text") && typeof obj?.text === "string"
      ? obj.text.trim().slice(0, 2).toUpperCase()
      : null;

  return (
    <div className="h-8 w-8 rounded-md border border-white/10 bg-white/5 flex items-center justify-center overflow-hidden">
      <div className="absolute pointer-events-none opacity-0" />
      {text ? (
        <div className="text-[10px] font-semibold text-white/80">{text}</div>
      ) : (
        <div className="h-4 w-4 rounded-sm" style={{ backgroundColor: color }} />
      )}
    </div>
  );
}

function SortableLayerRow({
  layer,
  canvas,
  editing,
  editingName,
  onEditStart,
  onEditChange,
  onEditCommit,
  onEditCancel,
  onSelect,
  onToggleVisible,
  onToggleLocked,
}: {
  layer: LayerItem;
  canvas: Canvas | null;
  editing: boolean;
  editingName: string;
  onEditStart: (layer: LayerItem) => void;
  onEditChange: (v: string) => void;
  onEditCommit: (layer: LayerItem) => void;
  onEditCancel: () => void;
  onSelect: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleLocked: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: layer.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="touch-none">
      <button
        type="button"
        className={[
          "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-colors",
          "bg-[#14141a]/50 border-white/10 hover:bg-white/5",
          layer.active ? "ring-1 ring-[#00d4ff]/40 border-[#00d4ff]/20" : "",
          isDragging ? "opacity-70" : "",
        ].join(" ")}
        onClick={() => onSelect(layer.id)}
        onDoubleClick={() => onEditStart(layer)}
      >
        <span
          {...attributes}
          {...listeners}
          className="p-1 rounded text-white/60 hover:text-white cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
          data-no-drag
        >
          <GripVertical className="h-4 w-4" />
        </span>

        <LayerThumb layer={layer} canvas={canvas} />

        <div className="min-w-0 flex-1 text-left">
          {editing ? (
            <Input
              value={editingName}
              autoFocus
              className="h-8 bg-white/5 border-white/10 text-white"
              onChange={(e) => onEditChange(e.target.value)}
              onBlur={() => onEditCommit(layer)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onEditCommit(layer);
                if (e.key === "Escape") onEditCancel();
              }}
              onClick={(e) => e.stopPropagation()}
              data-no-drag
            />
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <div className="text-xs font-medium truncate text-white/90">{layer.name}</div>
              <div className="shrink-0 text-[10px] text-white/40 flex items-center gap-1">
                <LayerTypeGlyph type={layer.type} />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0" data-no-drag>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/5"
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisible(layer.id);
            }}
          >
            {layer.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/5"
            onClick={(e) => {
              e.stopPropagation();
              onToggleLocked(layer.id);
            }}
          >
            {layer.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
          </Button>
        </div>
      </button>
    </div>
  );
}

function FloatingLayersPanel({
  layers,
  canvas,
  onSelectLayer,
  onToggleLayerVisible,
  onToggleLayerLocked,
  onMoveLayerToListIndex,
  onRenameLayer,
  onAddText,
  onAddRect,
  onAddCircle,
  onAddImage,
  boundsRef,
}: {
  layers: LayerItem[];
  canvas: Canvas | null;
  onSelectLayer: (id: string) => void;
  onToggleLayerVisible: (id: string) => void;
  onToggleLayerLocked: (id: string) => void;
  onMoveLayerToListIndex: (id: string, toIndex: number) => void;
  onRenameLayer: (id: string, name: string) => void;
  onAddText: () => void;
  onAddRect: () => void;
  onAddCircle: () => void;
  onAddImage: (f: File) => void;
  boundsRef: React.RefObject<HTMLElement>;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [orderedIds, setOrderedIds] = useState<string[]>(() => layers.map((l) => l.id));
  const panelRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
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

  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingLayerName, setEditingLayerName] = useState("");

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
    const panelWidth = panelRef.current?.getBoundingClientRect().width || 320;
    setPos({ x: Math.max(0, bounds.width - panelWidth - 24), y: 24 });
  }, [boundsRef, pos]);

  useEffect(() => {
    setOrderedIds(layers.map((l) => l.id));
  }, [layers]);

  const clampToBounds = useCallback(
    (nextX: number, nextY: number) => {
      const boundsEl = boundsRef.current;
      const el = panelRef.current;
      if (!boundsEl || !el) return { x: nextX, y: nextY };
      const bounds = boundsEl.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      const maxX = Math.max(0, bounds.width - rect.width);
      const maxY = Math.max(0, bounds.height - rect.height);
      return { x: Math.min(Math.max(0, nextX), maxX), y: Math.min(Math.max(0, nextY), maxY) };
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

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!active || !over) return;
    if (active.id === over.id) return;
    const oldIndex = orderedIds.indexOf(String(active.id));
    const newIndex = orderedIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(orderedIds, oldIndex, newIndex);
    setOrderedIds(next);
    onMoveLayerToListIndex(String(active.id), newIndex);
  };

  const onCommitRename = (layer: LayerItem) => {
    const nextName = editingLayerName.trim();
    if (editingLayerId === layer.id) {
      if (nextName) onRenameLayer(layer.id, nextName);
      setEditingLayerId(null);
    }
  };

  return (
    <div
      ref={panelRef}
      className="absolute z-20"
      style={{
        left: pos ? pos.x : undefined,
        top: pos ? pos.y : undefined,
        width: collapsed ? 260 : 360,
      }}
    >
      <div className="rounded-xl border border-white/10 bg-[#1f1f25]/90 backdrop-blur shadow-[0_10px_35px_rgba(0,0,0,0.45)] overflow-hidden">
        <div
          className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10 cursor-grab active:cursor-grabbing select-none"
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={endPanelDrag}
          onPointerCancel={endPanelDrag}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-2 w-2 rounded-full bg-[#00d4ff]" />
            <div className="text-xs font-semibold text-white/90 tracking-wide truncate">Layers</div>
          </div>

          <div className="flex items-center gap-1" data-no-drag>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/5"
              data-no-drag
              onClick={() => setCollapsed((v) => !v)}
            >
              {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {!collapsed && (
          <>
            <div className="p-2">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
                  <ScrollArea className="h-[320px]">
                    <div className="space-y-2 pr-2">
                      {layers.length === 0 ? (
                        <div className="py-10 text-center text-xs text-white/50">Sem camadas</div>
                      ) : (
                        layers.map((layer) => (
                          <SortableLayerRow
                            key={layer.id}
                            layer={layer}
                            canvas={canvas}
                            editing={editingLayerId === layer.id}
                            editingName={editingLayerName}
                            onEditStart={(l) => {
                              setEditingLayerId(l.id);
                              setEditingLayerName(l.name);
                            }}
                            onEditChange={setEditingLayerName}
                            onEditCommit={onCommitRename}
                            onEditCancel={() => setEditingLayerId(null)}
                            onSelect={onSelectLayer}
                            onToggleVisible={onToggleLayerVisible}
                            onToggleLocked={onToggleLayerLocked}
                          />
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </SortableContext>
              </DndContext>
            </div>

            <div className="border-t border-white/10 px-2 py-2 flex items-center justify-between gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onAddImage(f);
                  e.currentTarget.value = "";
                }}
              />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="h-9 flex-1 bg-[#00d4ff] text-[#0a0a0f] hover:bg-[#00d4ff]/90">
                    <Plus className="h-4 w-4 mr-2" /> Add Layer
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={onAddText}>
                    <Type className="h-4 w-4 mr-2" /> Texto
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onAddRect}>
                    <Square className="h-4 w-4 mr-2" /> Retângulo
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onAddCircle}>
                    <Circle className="h-4 w-4 mr-2" /> Círculo
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => fileRef.current?.click()}>
                    <ImageIcon className="h-4 w-4 mr-2" /> Imagem
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

type ProjectPreset = { id: string; label: string; width: number; height: number };

export default function Editor() {
  const navigate = useNavigate();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templates, setTemplates] = useState<any[]>([]);

  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [customW, setCustomW] = useState("1920");
  const [customH, setCustomH] = useState("1080");

  const presets: ProjectPreset[] = useMemo(
    () => [
      { id: "h", label: "Horizontal (TV)", width: 1920, height: 1080 },
      { id: "v", label: "Vertical (Totem)", width: 1080, height: 1920 },
      { id: "s", label: "Quadrado", width: 1080, height: 1080 },
    ],
    []
  );

  const {
    canvasRef,
    initCanvas,
    canvasElRef,
    selectedObject,
    projectName,
    setProjectName,
    zoom,
    showGrid,
    toggleGrid,
    canvasBgColor,
    changeCanvasBg,
    canvasWidth,
    canvasHeight,
    resizeCanvas,
    swapCanvasOrientation,
    addText,
    addRect,
    addCircle,
    addLine,
    addTriangle,
    addStar,
    addPolygon,
    addImage,
    addImageFromUrl,
    deleteSelected,
    duplicateSelected,
    bringToFront,
    sendToBack,
    addSVGFromString,
    layers,
    selectLayer,
    toggleLayerVisible,
    toggleLayerLocked,
    moveLayerForward,
    moveLayerBackward,
    moveLayerToListIndex,
    renameLayer,
    updateObjectProp,
    undo,
    redo,
    exportPNG,
    exportSVG,
    saveProject,
    handleZoom,
    handleWheelNavigation,
    getCanvasDataUrl,
    getProjectData,
    loadProjectData,
    alignmentSettings,
    updateAlignmentSettings,
    newProject,
    setViewportSize,
  } = useFabricCanvas();

  const { mediaItems, isLoading: galleryLoading } = useMediaItems(undefined);

  useEffect(() => {
    const el = canvasElRef.current;
    if (el) initCanvas(el, canvasContainerRef.current);
  }, [canvasElRef, initCanvas]);

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
    if (!raw) {
      setTemplates([]);
      return;
    }
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

  const handleApplyTemplate = useCallback(
    async (tpl: any) => {
      if (!tpl?.project) return;
      try {
        await loadProjectData(tpl.project);
        toast.success("Template aplicado");
        setShowTemplatesDialog(false);
      } catch {
        toast.error("Falha ao aplicar template");
      }
    },
    [loadProjectData]
  );

  const handleDeleteTemplate = useCallback(
    (id: string) => {
      const next = templates.filter((t) => t.id !== id);
      persistTemplates(next);
      toast.success("Template removido");
    },
    [templates, persistTemplates]
  );

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

  const handleSaveToGallery = useCallback(
    async (folderId: string | null, fileName: string) => {
      const dataUrl = getCanvasDataUrl();
      if (!dataUrl) throw new Error("Falha ao capturar canvas");

      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `${fileName}.png`, { type: "image/png" });

      const {
        data: { session },
      } = await (supabase.auth as any).getSession();
      if (!session) throw new Error("Não autenticado");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", fileName);
      formData.append("type", "image");
      if (folderId) formData.append("folder_id", folderId);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-media`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(err.error || "Erro ao salvar");
      }

      saveProject();
      toast.success("Imagem salva na galeria!");
    },
    [getCanvasDataUrl, saveProject]
  );

  const galleryItems = mediaItems.map((m) => ({
    id: m.id,
    name: m.name,
    file_url: m.file_url,
    thumbnail_url: m.thumbnail_url,
    type: m.type,
  }));

  const applyPreset = (preset: ProjectPreset) => {
    newProject({ width: preset.width, height: preset.height, name: projectName, bgColor: canvasBgColor });
    setShowNewProjectDialog(false);
    toast.success(`Novo projeto: ${preset.width}×${preset.height}`);
  };

  const applyCustom = () => {
    const w = Number(customW);
    const h = Number(customH);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
      toast.error("Dimensões inválidas");
      return;
    }
    newProject({ width: w, height: h, name: projectName, bgColor: canvasBgColor });
    setShowNewProjectDialog(false);
    toast.success(`Novo projeto: ${w}×${h}`);
  };

  return (
    <div className="mupa-editor dark flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f] text-white">
      <div className="fixed top-0 left-0 right-0 z-30">
        <EditorTopbar
          projectName={projectName}
          setProjectName={setProjectName}
          zoom={zoom}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          onBack={() => navigate("/admin/canva")}
          onNewProject={() => setShowNewProjectDialog(true)}
          onUndo={undo}
          onRedo={redo}
          onExportPNG={exportPNG}
          onExportSVG={exportSVG}
          onSave={() => {
            saveProject();
            toast.success("Projeto salvo localmente!");
          }}
          onSaveToGallery={() => setShowSaveDialog(true)}
          onZoom={handleZoom}
          onOpenTemplates={() => setShowTemplatesDialog(true)}
        />
      </div>

      <div className="flex flex-1 overflow-hidden pt-14">
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
          onSvgSaved={() => undefined}
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

        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div ref={canvasContainerRef} className="flex-1 overflow-hidden bg-[#1a1a1f] relative">
              {showGrid && (
                <div
                  className="absolute inset-0 pointer-events-none opacity-50"
                  style={{
                    backgroundImage:
                      "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
                    backgroundSize: "22px 22px",
                  }}
                />
              )}

              <canvas ref={canvasElRef} className="block rounded-xl" />

              <FloatingLayersPanel
                layers={layers}
                canvas={canvasRef.current}
                onSelectLayer={selectLayer}
                onToggleLayerVisible={toggleLayerVisible}
                onToggleLayerLocked={toggleLayerLocked}
                onMoveLayerToListIndex={moveLayerToListIndex}
                onRenameLayer={renameLayer}
                onAddText={addText}
                onAddRect={addRect}
                onAddCircle={addCircle}
                onAddImage={addImage}
                boundsRef={canvasContainerRef}
              />
            </div>
          </ContextMenuTrigger>

          <ContextMenuContent className="w-56">
            <ContextMenuLabel>Editor</ContextMenuLabel>
            <ContextMenuItem onSelect={() => addText()}>Adicionar texto</ContextMenuItem>
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

            <ContextMenuItem onSelect={() => setShowTemplatesDialog(true)}>Templates</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

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

      <footer className="h-10 border-t border-white/10 bg-[#0a0a0f] flex items-center justify-between px-4 text-[11px] text-white/45">
        <div className="flex items-center gap-3">
          <span>Space: Pan</span>
          <span>Ctrl/Cmd + Scroll: Zoom</span>
          <span>Del: Delete</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Ctrl+Z / Ctrl+Y</span>
          <span>Ctrl+D</span>
        </div>
      </footer>

      <SaveToFolderDialog open={showSaveDialog} onClose={() => setShowSaveDialog(false)} projectName={projectName} onSave={handleSaveToGallery} />

      <Dialog open={showTemplatesDialog} onOpenChange={(o) => !o && setShowTemplatesDialog(false)}>
        <DialogContent className="sm:max-w-lg bg-[#1f1f25] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Templates</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-white/70">Salvar template do layout atual</Label>
              <div className="flex gap-2">
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Nome do template"
                  className="h-9 bg-white/5 border-white/10 text-white placeholder:text-white/40"
                />
                <Button className="h-9 bg-[#00d4ff] text-[#0a0a0f] hover:bg-[#00d4ff]/90" onClick={handleSaveTemplate}>
                  Salvar
                </Button>
              </div>
            </div>

            <Separator className="bg-white/10" />

            <div className="space-y-2">
              <Label className="text-xs text-white/70">Meus templates</Label>
              <ScrollArea className="h-64 border rounded-md border-white/10">
                <div className="p-2 space-y-1">
                  {templates.length === 0 ? (
                    <div className="py-10 text-center text-sm text-white/50">Nenhum template salvo</div>
                  ) : (
                    templates.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-white/5">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{t.name}</div>
                          <div className="text-[10px] text-white/45 truncate">
                            {t.project?.width}×{t.project?.height} • {new Date(t.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                          onClick={() => handleApplyTemplate(t)}
                        >
                          Usar
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 text-red-400 hover:text-red-300 hover:bg-white/5" onClick={() => handleDeleteTemplate(t.id)}>
                          Excluir
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => setShowTemplatesDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewProjectDialog} onOpenChange={(o) => !o && setShowNewProjectDialog(false)}>
        <DialogContent className="sm:max-w-lg bg-[#1f1f25] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Novo Projeto</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2">
              {presets.map((p) => (
                <Button
                  key={p.id}
                  variant="outline"
                  className="h-11 justify-between border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                  onClick={() => applyPreset(p)}
                >
                  <span className="font-medium">{p.label}</span>
                  <span className="text-xs text-white/60 tabular-nums">
                    {p.width} × {p.height}
                  </span>
                </Button>
              ))}
            </div>

            <Separator className="bg-white/10" />

            <div className="space-y-2">
              <Label className="text-xs text-white/70">Custom</Label>
              <div className="flex items-end gap-2">
                <div className="space-y-1 flex-1">
                  <Label className="text-[11px] text-white/60">Largura</Label>
                  <Input value={customW} onChange={(e) => setCustomW(e.target.value)} className="h-9 bg-white/5 border-white/10 text-white" />
                </div>
                <div className="space-y-1 flex-1">
                  <Label className="text-[11px] text-white/60">Altura</Label>
                  <Input value={customH} onChange={(e) => setCustomH(e.target.value)} className="h-9 bg-white/5 border-white/10 text-white" />
                </div>
                <Button className="h-9 bg-[#00d4ff] text-[#0a0a0f] hover:bg-[#00d4ff]/90" onClick={applyCustom}>
                  Criar
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => setShowNewProjectDialog(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
