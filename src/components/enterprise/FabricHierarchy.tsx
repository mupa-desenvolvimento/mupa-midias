import { useEffect, useRef, useState, useCallback } from "react";
import { Canvas, Rect, IText, Group, Line, ActiveSelection, FabricObject, Point } from "fabric";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Layers, Move, ZoomIn, ZoomOut, RefreshCw, Upload, Download, Database, Trash2 } from "lucide-react";
import { TreeNode } from "./HierarchyTree";

type PaletteType = "region" | "store" | "sector" | "device";

type VisualItem = {
  id: string;
  type: PaletteType | "state";
  name: string;
  color: string;
  children?: string[];
  parentId?: string | null;
};

type Props = {
  initialTree?: TreeNode[];
  onExportJson?: (json: string) => void;
  onImportJson?: (json: string) => void;
  onSaveToDb?: (items: VisualItem[]) => Promise<void> | void;
  height?: number;
  width?: number;
};

export default function FabricHierarchy({ initialTree, onExportJson, onImportJson, onSaveToDb, height = 650, width = 1100 }: Props) {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const [zoom, setZoom] = useState(1);
  const [jsonDialogOpen, setJsonDialogOpen] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [snapGrid, setSnapGrid] = useState(true);
  const [gridSize, setGridSize] = useState(10);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const draggingTypeRef = useRef<PaletteType | null>(null);
  const linksRef = useRef<Map<string, string[]>>(new Map());
  const parentRef = useRef<Map<string, string | null>>(new Map());

  const pushHistory = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const snapshot = JSON.stringify(c.toJSON(["data"]));
    setUndoStack((prev) => [...prev, snapshot].slice(-50));
    setRedoStack([]);
  }, []);

  const restoreFromJson = useCallback((json: string) => {
    const c = canvasRef.current;
    if (!c) return;
    c.loadFromJSON(json, () => {
      c.requestRenderAll();
      rebuildLinks();
    });
  }, []);

  const rebuildLinks = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const links = new Map<string, string[]>();
    const parents = new Map<string, string | null>();
    const objs = c.getObjects() as FabricObject[];
    for (const obj of objs) {
      const data = (obj as any).data || {};
      const id = data.id as string | undefined;
      const parentId = data.parentId as string | undefined;
      if (!id) continue;
      parents.set(id, parentId || null);
      if (parentId) {
        const arr = links.get(parentId) || [];
        arr.push(id);
        links.set(parentId, arr);
      }
    }
    linksRef.current = links;
    parentRef.current = parents;
  }, []);

  const toVisualItems = useCallback((): VisualItem[] => {
    const c = canvasRef.current;
    if (!c) return [];
    const res: VisualItem[] = [];
    const objs = c.getObjects() as FabricObject[];
    for (const obj of objs) {
      const data = (obj as any).data || {};
      const id = data.id as string | undefined;
      const type = data.type as any;
      const name = data.name as string | undefined;
      const color = data.color as string | undefined;
      if (!id || !type) continue;
      const children = linksRef.current.get(id) || [];
      const parentId = parentRef.current.get(id) || null;
      res.push({ id, type, name: name || "", color: color || "#999", children, parentId });
    }
    return res;
  }, []);

  const setViewportZoom = useCallback((next: number) => {
    const c = canvasRef.current;
    if (!c) return;
    const center = new Point(c.getWidth() / 2, c.getHeight() / 2);
    c.zoomToPoint(center, Math.max(0.1, Math.min(3, next)));
    setZoom(c.getZoom() || 1);
  }, []);

  const fitReset = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.setViewportTransform([1, 0, 0, 1, 0, 0]);
    setZoom(1);
    c.requestRenderAll();
  }, []);

  const createBlock = useCallback((opts: { x: number; y: number; w: number; h: number; name: string; type: PaletteType | "state"; color: string; parentId?: string | null }) => {
    const c = canvasRef.current;
    if (!c) return;
    const id = crypto.randomUUID();
    const rect = new Rect({
      left: opts.x,
      top: opts.y,
      width: opts.w,
      height: opts.h,
      rx: 8,
      ry: 8,
      fill: opts.color,
      stroke: "#0a58ca",
      strokeWidth: opts.type === "state" ? 4 : 0,
      selectable: true,
      evented: true,
      subTargetCheck: true,
    });
    (rect as any).data = { id, type: opts.type, name: opts.name, color: opts.color, parentId: opts.parentId || null };
    const text = new IText(opts.name, {
      left: opts.x + 12,
      top: opts.y + 8,
      fill: "#fff",
      fontSize: opts.type === "state" ? 28 : 18,
      fontWeight: "bold",
      selectable: true,
      evented: true,
    });
    (text as any).data = { id: `${id}:label`, type: "label", parentId: id };
    c.add(rect);
    c.add(text);
    c.bringToFront(text);
    parentRef.current.set(id, opts.parentId || null);
    const children = linksRef.current.get(opts.parentId || "") || [];
    if (opts.parentId) linksRef.current.set(opts.parentId, [...children, id]);
    pushHistory();
    c.requestRenderAll();
    return id;
  }, [pushHistory]);

  const paletteItems: { label: string; type: PaletteType; color: string }[] = [
    { label: "Região Serra", type: "region", color: "#00c853" },
    { label: "Região Litoral", type: "region", color: "#ff9800" },
    { label: "Loja", type: "store", color: "#8e24aa" },
    { label: "Setor", type: "sector", color: "#1b5e20" },
    { label: "Dispositivo", type: "device", color: "#0288d1" },
  ];

  useEffect(() => {
    const canvas = new Canvas(canvasElRef.current!, {
      preserveObjectStacking: true,
      selection: true,
      backgroundColor: "#0b1e3a",
      fireRightClick: true,
      stopContextMenu: true,
    });
    canvas.setWidth(width);
    canvas.setHeight(height);
    canvasRef.current = canvas;

    const handleMoving = (e: any) => {
      const obj = e.target as FabricObject;
      if (!obj) return;
      if (snapGrid) {
        obj.set({
          left: Math.round((obj.left || 0) / gridSize) * gridSize,
          top: Math.round((obj.top || 0) / gridSize) * gridSize,
        });
      }
      const data = (obj as any).data || {};
      const id = data.id as string | undefined;
      if (!id) return;
      const children = linksRef.current.get(id) || [];
      const dx = e.e?.movementX || 0;
      const dy = e.e?.movementY || 0;
      if (children.length > 0) {
        const objs = canvas.getObjects() as FabricObject[];
        for (const childId of children) {
          const child = objs.find((o) => (o as any).data?.id === childId) as FabricObject | undefined;
          if (child && child !== obj) {
            child.set({ left: (child.left || 0) + dx, top: (child.top || 0) + dy });
          }
        }
      }
    };
    const handleMouseUp = (e: any) => {
      const c = canvasRef.current;
      if (!c) return;
      const target = e.target as FabricObject | undefined;
      if (!target) return;
      const objs = c.getObjects() as FabricObject[];
      const data = (target as any).data || {};
      const id = data.id as string | undefined;
      const type = data.type as string | undefined;
      if (!id || !type) return;
      const bounds = target.getBoundingRect(true, true);
      for (const parent of objs) {
        if (parent === target) continue;
        const pd = (parent as any).data || {};
        const ptype = pd.type as string | undefined;
        const pid = pd.id as string | undefined;
        if (!ptype || !pid) continue;
        const pBounds = parent.getBoundingRect(true, true);
        const inside = bounds.left >= pBounds.left && bounds.top >= pBounds.top && bounds.left + bounds.width <= pBounds.left + pBounds.width && bounds.top + bounds.height <= pBounds.top + pBounds.height;
        if (inside) {
          const allowed =
            (type === "store" && ptype === "region") ||
            (type === "sector" && ptype === "store") ||
            (type === "device" && (ptype === "sector" || ptype === "store"));
          if (!allowed) continue;
          parentRef.current.set(id, pid);
          const arr = linksRef.current.get(pid) || [];
          if (!arr.includes(id)) linksRef.current.set(pid, [...arr, id]);
          pushHistory();
          break;
        }
      }
    };
    const handleSelectionCreated = () => {};
    const handleSelectionUpdated = () => {};
    const handleSelectionCleared = () => {};
    const handleKeyDown = (e: KeyboardEvent) => {
      const c = canvasRef.current;
      if (!c) return;
      if (e.key === "Delete") {
        const active = c.getActiveObject();
        if (!active) return;
        if (active instanceof ActiveSelection) {
          active.getObjects().forEach((o) => c.remove(o));
        } else {
          const id = (active as any).data?.id as string | undefined;
          if (id) {
            linksRef.current.delete(id);
            parentRef.current.delete(id);
          }
          c.remove(active);
        }
        pushHistory();
        c.discardActiveObject();
        c.requestRenderAll();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        const last = undoStack[undoStack.length - 1];
        if (last) {
          setUndoStack((prev) => prev.slice(0, -1));
          setRedoStack((prev) => [...prev, JSON.stringify(c.toJSON(["data"]))].slice(-50));
          restoreFromJson(last);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        const last = redoStack[redoStack.length - 1];
        if (last) {
          setRedoStack((prev) => prev.slice(0, -1));
          setUndoStack((prev) => [...prev, JSON.stringify(c.toJSON(["data"]))].slice(-50));
          restoreFromJson(last);
        }
      }
    };
    canvas.on("object:moving", handleMoving);
    canvas.on("mouse:up", handleMouseUp);
    canvas.on("selection:created", handleSelectionCreated);
    canvas.on("selection:updated", handleSelectionUpdated);
    canvas.on("selection:cleared", handleSelectionCleared);
    window.addEventListener("keydown", handleKeyDown);

    const stateId = createBlock({ x: 20, y: 20, w: width - 40, h: height - 40, name: "Estado RS", type: "state", color: "#2f6ef7", parentId: null })!;
    const regionSerraId = createBlock({ x: 40, y: 70, w: width - 80, h: 280, name: "Região Serra", type: "region", color: "#00c853", parentId: stateId })!;
    const loja002Id = createBlock({ x: 60, y: 110, w: 340, h: 200, name: "Loja 002", type: "store", color: "#8e24aa", parentId: regionSerraId })!;
    const setorBazarId = createBlock({ x: 80, y: 140, w: 150, h: 160, name: "Setor bazar", type: "sector", color: "#121212", parentId: loja002Id })!;
    createBlock({ x: 90, y: 170, w: 110, h: 28, name: "Dispositivo 02", type: "device", color: "#0288d1", parentId: setorBazarId });
    createBlock({ x: 90, y: 205, w: 110, h: 28, name: "Dispositivo 04", type: "device", color: "#0288d1", parentId: setorBazarId });
    createBlock({ x: 90, y: 240, w: 110, h: 28, name: "Dispositivo 05", type: "device", color: "#0288d1", parentId: setorBazarId });
    const setorHortiId = createBlock({ x: 240, y: 140, w: 150, h: 160, name: "Setor hortifruti", type: "sector", color: "#1b5e20", parentId: loja002Id })!;
    createBlock({ x: 255, y: 180, w: 120, h: 28, name: "Dispositivo 06", type: "device", color: "#0288d1", parentId: setorHortiId });
    createBlock({ x: 420, y: 110, w: 300, h: 200, name: "Loja 004", type: "store", color: "#ff5722", parentId: regionSerraId });
    createBlock({ x: 740, y: 110, w: 300, h: 200, name: "Loja 005", type: "store", color: "#f44336", parentId: regionSerraId });
    createBlock({ x: 40, y: 370, w: width - 80, h: 240, name: "Região Litoral", type: "region", color: "#ff9800", parentId: stateId });

    pushHistory();
    rebuildLinks();
    canvas.requestRenderAll();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      canvas.dispose();
      canvasRef.current = null;
    };
  }, [createBlock, gridSize, height, width, rebuildLinks, pushHistory, snapGrid]);

  const handleDragStart = (type: PaletteType) => {
    draggingTypeRef.current = type;
  };
  const handleDragEnd = () => {
    draggingTypeRef.current = null;
  };

  const handleCanvasDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const type = draggingTypeRef.current;
    if (!type) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const c = canvasRef.current;
    if (!c) return;
    const pt = c.getPointer({ clientX: e.clientX, clientY: e.clientY } as any);
    const colorMap: Record<PaletteType, string> = {
      region: "#00c853",
      store: "#8e24aa",
      sector: "#1b5e20",
      device: "#0288d1",
    };
    const defaultSize: Record<PaletteType, { w: number; h: number }> = {
      region: { w: 400, h: 240 },
      store: { w: 280, h: 160 },
      sector: { w: 160, h: 120 },
      device: { w: 120, h: 28 },
    };
    createBlock({ x: pt.x, y: pt.y, w: defaultSize[type].w, h: defaultSize[type].h, name: type === "store" ? "Loja" : type === "region" ? "Região" : type === "sector" ? "Setor" : "Dispositivo", type, color: colorMap[type], parentId: null });
  };

  const handleExport = () => {
    const c = canvasRef.current;
    if (!c) return;
    const json = JSON.stringify(c.toJSON(["data"]), null, 2);
    setJsonText(json);
    setJsonDialogOpen(true);
    onExportJson?.(json);
  };
  const handleImport = () => {
    setJsonDialogOpen(true);
  };
  const applyImport = () => {
    try {
      restoreFromJson(jsonText);
      onImportJson?.(jsonText);
      setJsonDialogOpen(false);
    } catch (e) {}
  };
  const saveToDb = async () => {
    const items = toVisualItems();
    await onSaveToDb?.(items);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <div className="lg:col-span-1 border border-border rounded-lg bg-card">
        <div className="p-3 border-b border-border flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Paleta</span>
        </div>
        <ScrollArea className="h-[580px]">
          <div className="p-3 space-y-2">
            {paletteItems.map((p) => (
              <div
                key={p.label}
                draggable
                onDragStart={() => handleDragStart(p.type)}
                onDragEnd={handleDragEnd}
                className="flex items-center justify-between rounded-md px-2 py-2 cursor-grab active:cursor-grabbing"
                style={{ backgroundColor: "#0f172a", border: "1px solid #1e293b" }}
              >
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: p.color }} />
                  <span className="text-sm">{p.label}</span>
                </div>
                <Badge variant="outline" className="text-[10px]">{p.type}</Badge>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="p-3 border-t border-border space-y-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setViewportZoom(zoom * 1.1)}><ZoomIn className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => setViewportZoom(zoom / 1.1)}><ZoomOut className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={fitReset}><RefreshCw className="h-4 w-4" /></Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4" /> Exportar JSON</Button>
            <Button variant="outline" size="sm" onClick={handleImport}><Upload className="h-4 w-4" /> Importar JSON</Button>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={saveToDb}><Database className="h-4 w-4" /> Salvar no banco</Button>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Snap to grid</Label>
            <div className="flex items-center gap-2">
              <Input type="number" className="h-8 w-20" value={gridSize} onChange={(e) => setGridSize(Number(e.target.value) || 10)} />
              <Button variant={snapGrid ? "default" : "outline"} size="sm" onClick={() => setSnapGrid((v) => !v)}>
                <Move className="h-4 w-4" /> {snapGrid ? "Ligado" : "Desligado"}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <div className="lg:col-span-4 border border-[#007bff] rounded-xl bg-[#0b1e3a] p-3">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleCanvasDrop}
          className="w-full h-[650px]"
          style={{ borderRadius: 8, overflow: "hidden" }}
        >
          <canvas ref={canvasElRef} />
        </div>
      </div>

      <Dialog open={jsonDialogOpen} onOpenChange={setJsonDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>JSON</DialogTitle></DialogHeader>
          <Input asChild />
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            rows={12}
            className="w-full rounded-md border border-border bg-card p-2 text-sm"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setJsonDialogOpen(false)}>Fechar</Button>
            <Button onClick={applyImport}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
