import { useRef, useState, useCallback, useEffect } from "react";
import { Canvas, IText, Rect, Circle, Line, Triangle, Polygon, FabricImage, FabricObject, ActiveSelection, Shadow } from "fabric";
import { attachSmartGuides } from "@/editor/smart-guides";
import type { AlignmentSettings } from "@/editor/alignment-engine";

export interface SelectedObjectProps {
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  fontSize?: number;
  fontFamily?: string;
  textAlign?: string;
  fontWeight?: string;
  fontStyle?: string;
  underline?: boolean;
  linethrough?: boolean;
  lineHeight?: number;
  charSpacing?: number;
  shadowBlur?: number;
  rx?: number;
  left?: number;
  top?: number;
  angle?: number;
  type: string;
}

export interface LayerItem {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  locked: boolean;
  active: boolean;
}

const MAX_HISTORY = 50;
const SMART_GUIDES_SETTINGS_KEY = "graphic-editor-smart-guides-settings";

function createStarPoints(spikes: number, outerR: number, innerR: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const step = Math.PI / spikes;
  for (let i = 0; i < 2 * spikes; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = i * step - Math.PI / 2;
    pts.push({ x: Math.cos(angle) * r + outerR, y: Math.sin(angle) * r + outerR });
  }
  return pts;
}

function createPolygonPoints(sides: number, radius: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (2 * Math.PI * i) / sides - Math.PI / 2;
    pts.push({ x: Math.cos(angle) * radius + radius, y: Math.sin(angle) * radius + radius });
  }
  return pts;
}

export function useFabricCanvas() {
  const canvasRef = useRef<Canvas | null>(null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedObject, setSelectedObject] = useState<SelectedObjectProps | null>(null);
  const [layers, setLayers] = useState<LayerItem[]>([]);
  const [projectName, setProjectName] = useState("Projeto sem título");
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(false);
  const [canvasBgColor, setCanvasBgColor] = useState("#ffffff");
  const [canvasWidth, setCanvasWidth] = useState(900);
  const [canvasHeight, setCanvasHeight] = useState(600);
  const [alignmentSettings, setAlignmentSettings] = useState<AlignmentSettings>(() => {
    const fallback: AlignmentSettings = {
      enabled: true,
      snapEnabled: true,
      snapCenter: true,
      snapObjects: true,
      snapGrid: false,
      snapDistancePx: 5,
      gridSize: 20,
    };
    try {
      const raw = localStorage.getItem(SMART_GUIDES_SETTINGS_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return { ...fallback, ...parsed };
    } catch {
      return fallback;
    }
  });
  const alignmentSettingsRef = useRef<AlignmentSettings>(alignmentSettings);
  const smartGuidesCleanupRef = useRef<null | (() => void)>(null);

  // History
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const isRestoringRef = useRef(false);
  const layerNameCountersRef = useRef<Record<string, number>>({});

  const getNextLayerName = useCallback((base: string) => {
    const key = base.trim() || "Objeto";
    const next = (layerNameCountersRef.current[key] || 0) + 1;
    layerNameCountersRef.current[key] = next;
    return `${key} ${next}`;
  }, []);

  const ensureLayerData = useCallback((obj: FabricObject) => {
    const anyObj = obj as any;
    const currentData = anyObj?.data && typeof anyObj.data === "object" ? anyObj.data : {};
    const nextData: any = { ...currentData };

    if (!nextData.layerId) {
      nextData.layerId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    if (!nextData.layerName) {
      const type = obj.type || "objeto";
      if (type === "i-text" || type === "text") {
        const txt = `${(obj as any).text || ""}`.trim();
        nextData.layerName = txt ? `Texto: ${txt.slice(0, 18)}` : getNextLayerName("Texto");
      } else if (type === "image") {
        nextData.layerName = getNextLayerName("Imagem");
      } else if (type === "rect") {
        nextData.layerName = getNextLayerName("Retângulo");
      } else if (type === "circle") {
        nextData.layerName = getNextLayerName("Círculo");
      } else if (type === "triangle") {
        nextData.layerName = getNextLayerName("Triângulo");
      } else if (type === "line") {
        nextData.layerName = getNextLayerName("Linha");
      } else if (type === "polygon") {
        nextData.layerName = getNextLayerName("Polígono");
      } else {
        nextData.layerName = getNextLayerName("Objeto");
      }
    }

    anyObj.set("data", nextData);
    return nextData as { layerId: string; layerName: string };
  }, [getNextLayerName]);

  const refreshLayers = useCallback((canvas: Canvas) => {
    const active = canvas.getActiveObject();
    const activeIds = new Set<string>();
    if (active) {
      if (active.type === "activeselection") {
        (active as ActiveSelection).forEachObject((obj: FabricObject) => {
          const data = ensureLayerData(obj);
          if (data?.layerId) activeIds.add(data.layerId);
        });
      } else {
        const data = ensureLayerData(active as FabricObject);
        if (data?.layerId) activeIds.add(data.layerId);
      }
    }

    const items: LayerItem[] = canvas
      .getObjects()
      .slice()
      .reverse()
      .map((obj) => {
        const data = ensureLayerData(obj);
        const locked = !!(
          obj.lockMovementX ||
          obj.lockMovementY ||
          obj.lockScalingX ||
          obj.lockScalingY ||
          obj.lockRotation ||
          obj.selectable === false
        );
        return {
          id: data.layerId,
          name: data.layerName,
          type: obj.type || "objeto",
          visible: obj.visible !== false,
          locked,
          active: activeIds.has(data.layerId),
        };
      });

    setLayers(items);
  }, [ensureLayerData]);

  const saveHistory = useCallback(() => {
    if (isRestoringRef.current || !canvasRef.current) return;
    const json = JSON.stringify((canvasRef.current as any).toJSON(["data"]));
    const idx = historyIndexRef.current;
    historyRef.current = historyRef.current.slice(0, idx + 1);
    historyRef.current.push(json);
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
    historyIndexRef.current = historyRef.current.length - 1;
  }, []);

  useEffect(() => {
    alignmentSettingsRef.current = alignmentSettings;
    try {
      localStorage.setItem(SMART_GUIDES_SETTINGS_KEY, JSON.stringify(alignmentSettings));
    } catch {
      void 0;
    }
  }, [alignmentSettings]);

  useEffect(() => {
    return () => {
      smartGuidesCleanupRef.current?.();
      smartGuidesCleanupRef.current = null;
    };
  }, []);

  const initCanvas = useCallback((el: HTMLCanvasElement) => {
    smartGuidesCleanupRef.current?.();
    smartGuidesCleanupRef.current = null;
    if (canvasRef.current) canvasRef.current.dispose();
    canvasElRef.current = el;

    const canvas = new Canvas(el, {
      width: 900,
      height: 600,
      backgroundColor: "#ffffff",
      selection: true,
      preserveObjectStacking: true,
    });

    canvas.on("selection:created", () => { updateSelection(canvas); refreshLayers(canvas); });
    canvas.on("selection:updated", () => { updateSelection(canvas); refreshLayers(canvas); });
    canvas.on("selection:cleared", () => { setSelectedObject(null); refreshLayers(canvas); });
    canvas.on("object:modified", () => { saveHistory(); updateSelection(canvas); refreshLayers(canvas); });
    canvas.on("object:added", (opt: any) => { if (opt?.target) ensureLayerData(opt.target); saveHistory(); refreshLayers(canvas); });
    canvas.on("object:removed", () => { saveHistory(); refreshLayers(canvas); });
    canvas.on("mouse:down", (opt: any) => {
      const ev = opt?.e as MouseEvent | undefined;
      if (!ev) return;
      if (ev.button !== 2) return;
      if (opt?.target) {
        canvas.setActiveObject(opt.target);
      } else {
        canvas.discardActiveObject();
      }
      canvas.renderAll();
      updateSelection(canvas);
      refreshLayers(canvas);
    });

    canvasRef.current = canvas;
    smartGuidesCleanupRef.current = attachSmartGuides({
      canvas,
      getSettings: () => alignmentSettingsRef.current,
      guideColor: "#00AEEF",
    });
    saveHistory();

    // Load from localStorage
    const saved = localStorage.getItem("graphic-editor-project");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.name) setProjectName(data.name);
        if (data.bgColor) {
          setCanvasBgColor(data.bgColor);
          canvas.backgroundColor = data.bgColor;
        }
        if (data.width && data.height) {
          setCanvasWidth(data.width);
          setCanvasHeight(data.height);
          canvas.setDimensions({ width: data.width, height: data.height });
        }
        if (data.canvas) {
          canvas.loadFromJSON(data.canvas).then(() => {
            canvas.getObjects().forEach((obj) => ensureLayerData(obj));
            canvas.renderAll();
            saveHistory();
            refreshLayers(canvas);
          });
        }
      } catch {
        localStorage.removeItem("graphic-editor-project");
      }
    }

    refreshLayers(canvas);
    return canvas;
  }, [ensureLayerData, refreshLayers, saveHistory]);

  const updateAlignmentSettings = useCallback((updates: Partial<AlignmentSettings>) => {
    setAlignmentSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  const getProjectData = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return null;
    return {
      name: projectName,
      canvas: (c as any).toJSON(["data"]),
      bgColor: canvasBgColor,
      width: canvasWidth,
      height: canvasHeight,
    };
  }, [projectName, canvasBgColor, canvasWidth, canvasHeight]);

  const loadProjectData = useCallback(async (data: any) => {
    const c = canvasRef.current;
    if (!c || !data?.canvas) return;
    isRestoringRef.current = true;

    if (typeof data.name === "string" && data.name.trim()) setProjectName(data.name);
    if (typeof data.bgColor === "string" && data.bgColor) {
      setCanvasBgColor(data.bgColor);
      c.backgroundColor = data.bgColor;
    }
    if (typeof data.width === "number" && typeof data.height === "number" && data.width > 0 && data.height > 0) {
      setCanvasWidth(data.width);
      setCanvasHeight(data.height);
      c.setDimensions({ width: data.width, height: data.height });
    }

    await c.loadFromJSON(data.canvas);
    c.getObjects().forEach((obj) => ensureLayerData(obj));
    c.discardActiveObject();
    c.renderAll();
    isRestoringRef.current = false;
    saveHistory();
    updateSelection(c);
    refreshLayers(c);
  }, [ensureLayerData, refreshLayers, saveHistory]);

  const updateSelection = (canvas: Canvas) => {
    const obj = canvas.getActiveObject();
    if (!obj) { setSelectedObject(null); return; }
    const shadow = obj.shadow as Shadow | null;
    const props: SelectedObjectProps = {
      fill: (obj.fill as string) || "transparent",
      stroke: (obj.stroke as string) || "transparent",
      strokeWidth: obj.strokeWidth || 0,
      opacity: obj.opacity ?? 1,
      type: obj.type || "object",
      shadowBlur: shadow?.blur || 0,
      rx: (obj as any).rx || 0,
      left: obj.left || 0,
      top: obj.top || 0,
      angle: obj.angle || 0,
    };
    if (obj.type === "i-text" || obj.type === "text") {
      const t = obj as IText;
      props.fontSize = t.fontSize;
      props.fontFamily = t.fontFamily;
      props.textAlign = t.textAlign;
      props.fontWeight = t.fontWeight as string;
      props.fontStyle = t.fontStyle as string;
      props.underline = t.underline;
      props.linethrough = t.linethrough;
      props.lineHeight = t.lineHeight;
      props.charSpacing = t.charSpacing;
    }
    setSelectedObject(props);
  };

  // Canvas resize
  const resizeCanvas = useCallback((w: number, h: number) => {
    const c = canvasRef.current;
    if (!c) return;
    c.setDimensions({ width: w, height: h });
    setCanvasWidth(w);
    setCanvasHeight(h);
    c.renderAll();
  }, []);

  // ---- Actions ----

  const addText = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const text = new IText("Texto aqui", {
      left: 100, top: 100,
      fontSize: 28, fontFamily: "Inter",
      fill: "#1a1a1a",
    });
    ensureLayerData(text);
    c.add(text);
    c.setActiveObject(text);
    c.renderAll();
    refreshLayers(c);
  }, [ensureLayerData, refreshLayers]);

  const addRect = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const rect = new Rect({
      left: 150, top: 150, width: 150, height: 100,
      fill: "#3b82f6", stroke: "#1d4ed8", strokeWidth: 2,
      rx: 8, ry: 8,
    });
    ensureLayerData(rect);
    c.add(rect);
    c.setActiveObject(rect);
    c.renderAll();
    refreshLayers(c);
  }, [ensureLayerData, refreshLayers]);

  const addCircle = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const circle = new Circle({
      left: 200, top: 200, radius: 60,
      fill: "#10b981", stroke: "#047857", strokeWidth: 2,
    });
    ensureLayerData(circle);
    c.add(circle);
    c.setActiveObject(circle);
    c.renderAll();
    refreshLayers(c);
  }, [ensureLayerData, refreshLayers]);

  const addLine = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const line = new Line([50, 300, 300, 300], {
      stroke: "#1a1a1a", strokeWidth: 3,
    });
    ensureLayerData(line as any);
    c.add(line);
    c.setActiveObject(line);
    c.renderAll();
    refreshLayers(c);
  }, [ensureLayerData, refreshLayers]);

  const addTriangle = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const tri = new Triangle({
      left: 250, top: 150, width: 100, height: 100,
      fill: "#f59e0b", stroke: "#d97706", strokeWidth: 2,
    });
    ensureLayerData(tri);
    c.add(tri);
    c.setActiveObject(tri);
    c.renderAll();
    refreshLayers(c);
  }, [ensureLayerData, refreshLayers]);

  const addStar = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const pts = createStarPoints(5, 50, 20);
    const star = new Polygon(pts, {
      left: 200, top: 150,
      fill: "#eab308", stroke: "#ca8a04", strokeWidth: 2,
    });
    ensureLayerData(star);
    c.add(star);
    c.setActiveObject(star);
    c.renderAll();
    refreshLayers(c);
  }, [ensureLayerData, refreshLayers]);

  const addPolygon = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const pts = createPolygonPoints(6, 50);
    const poly = new Polygon(pts, {
      left: 200, top: 200,
      fill: "#8b5cf6", stroke: "#7c3aed", strokeWidth: 2,
    });
    ensureLayerData(poly);
    c.add(poly);
    c.setActiveObject(poly);
    c.renderAll();
    refreshLayers(c);
  }, [ensureLayerData, refreshLayers]);

  const addImage = useCallback((file: File) => {
    const c = canvasRef.current;
    if (!c) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      const imgEl = new Image();
      imgEl.crossOrigin = "anonymous";
      imgEl.onload = () => {
        const fImg = new FabricImage(imgEl, { left: 50, top: 50 });
        ensureLayerData(fImg as any);
        const maxW = Math.min(400, c.width! * 0.6);
        if (fImg.width && fImg.width > maxW) fImg.scaleToWidth(maxW);
        c.add(fImg);
        c.setActiveObject(fImg);
        c.renderAll();
        refreshLayers(c);
      };
      imgEl.src = url;
    };
    reader.readAsDataURL(file);
  }, [ensureLayerData, refreshLayers]);

  const addImageFromUrl = useCallback((url: string) => {
    const c = canvasRef.current;
    if (!c) return;
    const imgEl = new Image();
    imgEl.crossOrigin = "anonymous";
    imgEl.onload = () => {
      const fImg = new FabricImage(imgEl, { left: 50, top: 50 });
      ensureLayerData(fImg as any);
      const maxW = Math.min(400, c.width! * 0.6);
      if (fImg.width && fImg.width > maxW) fImg.scaleToWidth(maxW);
      c.add(fImg);
      c.setActiveObject(fImg);
      c.renderAll();
      refreshLayers(c);
    };
    imgEl.onerror = () => {
      console.error("Failed to load image from URL:", url);
    };
    imgEl.src = url;
  }, [ensureLayerData, refreshLayers]);

  const deleteSelected = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const active = c.getActiveObject();
    if (!active) return;
    if (active.type === "activeselection") {
      (active as ActiveSelection).forEachObject((obj: FabricObject) => c.remove(obj));
      c.discardActiveObject();
    } else {
      c.remove(active);
    }
    c.renderAll();
    refreshLayers(c);
  }, [refreshLayers]);

  const duplicateSelected = useCallback(async () => {
    const c = canvasRef.current;
    if (!c) return;
    const active = c.getActiveObject();
    if (!active) return;
    const cloned = await active.clone();
    cloned.set({ left: (cloned.left || 0) + 20, top: (cloned.top || 0) + 20 });
    const anyCloned = cloned as any;
    const currentData = anyCloned?.data && typeof anyCloned.data === "object" ? anyCloned.data : {};
    anyCloned.set("data", {
      ...currentData,
      layerId:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      layerName: getNextLayerName("Cópia"),
    });
    c.add(cloned);
    c.setActiveObject(cloned);
    c.renderAll();
    refreshLayers(c);
  }, [getNextLayerName, refreshLayers]);

  const bringToFront = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const active = c.getActiveObject();
    if (active) { c.bringObjectToFront(active); c.renderAll(); }
    refreshLayers(c);
  }, [refreshLayers]);

  const sendToBack = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const active = c.getActiveObject();
    if (active) { c.sendObjectToBack(active); c.renderAll(); }
    refreshLayers(c);
  }, [refreshLayers]);

  const selectLayer = useCallback((layerId: string) => {
    const c = canvasRef.current;
    if (!c) return;
    const target = c.getObjects().find((o) => ((o as any).data?.layerId as string | undefined) === layerId);
    if (!target) return;
    c.setActiveObject(target);
    c.renderAll();
    updateSelection(c);
    refreshLayers(c);
  }, [refreshLayers]);

  const toggleLayerVisible = useCallback((layerId: string) => {
    const c = canvasRef.current;
    if (!c) return;
    const target = c.getObjects().find((o) => ((o as any).data?.layerId as string | undefined) === layerId) as FabricObject | undefined;
    if (!target) return;
    target.set("visible", !(target.visible !== false));
    if (c.getActiveObject() === target && target.visible === false) {
      c.discardActiveObject();
      setSelectedObject(null);
    }
    c.renderAll();
    saveHistory();
    refreshLayers(c);
  }, [refreshLayers, saveHistory]);

  const toggleLayerLocked = useCallback((layerId: string) => {
    const c = canvasRef.current;
    if (!c) return;
    const target = c.getObjects().find((o) => ((o as any).data?.layerId as string | undefined) === layerId) as FabricObject | undefined;
    if (!target) return;
    const isLocked = !!(
      target.lockMovementX ||
      target.lockMovementY ||
      target.lockScalingX ||
      target.lockScalingY ||
      target.lockRotation ||
      target.selectable === false
    );
    const nextLocked = !isLocked;
    target.set({
      selectable: !nextLocked,
      evented: !nextLocked,
      lockMovementX: nextLocked,
      lockMovementY: nextLocked,
      lockScalingX: nextLocked,
      lockScalingY: nextLocked,
      lockRotation: nextLocked,
    } as any);
    if (nextLocked && c.getActiveObject() === target) {
      c.discardActiveObject();
      setSelectedObject(null);
    }
    c.renderAll();
    saveHistory();
    refreshLayers(c);
  }, [refreshLayers, saveHistory]);

  const moveLayerForward = useCallback((layerId: string) => {
    const c = canvasRef.current;
    if (!c) return;
    const objects = c.getObjects();
    const idx = objects.findIndex((o) => ((o as any).data?.layerId as string | undefined) === layerId);
    if (idx < 0 || idx >= objects.length - 1) return;
    const obj = objects[idx];
    if (typeof (c as any).moveObjectTo === "function") {
      (c as any).moveObjectTo(obj, idx + 1);
    } else {
      c.bringObjectForward(obj);
    }
    c.renderAll();
    saveHistory();
    refreshLayers(c);
  }, [refreshLayers, saveHistory]);

  const moveLayerBackward = useCallback((layerId: string) => {
    const c = canvasRef.current;
    if (!c) return;
    const objects = c.getObjects();
    const idx = objects.findIndex((o) => ((o as any).data?.layerId as string | undefined) === layerId);
    if (idx <= 0) return;
    const obj = objects[idx];
    if (typeof (c as any).moveObjectTo === "function") {
      (c as any).moveObjectTo(obj, idx - 1);
    } else {
      c.sendObjectBackwards(obj);
    }
    c.renderAll();
    saveHistory();
    refreshLayers(c);
  }, [refreshLayers, saveHistory]);

  const moveLayerToListIndex = useCallback((layerId: string, toListIndex: number) => {
    const c = canvasRef.current;
    if (!c) return;
    const objects = c.getObjects();
    if (!objects.length) return;
    const fromCanvasIndex = objects.findIndex((o) => ((o as any).data?.layerId as string | undefined) === layerId);
    if (fromCanvasIndex < 0) return;

    const clampedListIndex = Math.max(0, Math.min(toListIndex, objects.length - 1));
    const toCanvasIndex = Math.max(0, Math.min(objects.length - 1 - clampedListIndex, objects.length - 1));
    if (toCanvasIndex === fromCanvasIndex) return;

    const obj = objects[fromCanvasIndex];
    if (typeof (c as any).moveObjectTo === "function") {
      (c as any).moveObjectTo(obj, toCanvasIndex);
    } else {
      const steps = Math.abs(toCanvasIndex - fromCanvasIndex);
      if (toCanvasIndex > fromCanvasIndex) {
        for (let i = 0; i < steps; i++) c.bringObjectForward(obj);
      } else {
        for (let i = 0; i < steps; i++) c.sendObjectBackwards(obj);
      }
    }
    c.renderAll();
    saveHistory();
    refreshLayers(c);
  }, [refreshLayers, saveHistory]);

  const renameLayer = useCallback((layerId: string, name: string) => {
    const c = canvasRef.current;
    if (!c) return;
    const target = c.getObjects().find((o) => ((o as any).data?.layerId as string | undefined) === layerId) as FabricObject | undefined;
    if (!target) return;
    const anyObj = target as any;
    const currentData = anyObj?.data && typeof anyObj.data === "object" ? anyObj.data : {};
    anyObj.set("data", { ...currentData, layerName: name.trim() || currentData.layerName || "Camada" });
    saveHistory();
    refreshLayers(c);
  }, [refreshLayers, saveHistory]);

  const updateObjectProp = useCallback((prop: string, value: any) => {
    const c = canvasRef.current;
    if (!c) return;
    const active = c.getActiveObject();
    if (!active) return;

    if (prop === "shadow") {
      active.set("shadow", value ? new Shadow(value) : null);
    } else {
      active.set(prop as keyof FabricObject, value);
    }
    if (active.type === "i-text" || active.type === "text") {
      const isTextProp =
        prop === "fontFamily" ||
        prop === "fontSize" ||
        prop === "fontWeight" ||
        prop === "fontStyle" ||
        prop === "underline" ||
        prop === "linethrough" ||
        prop === "textAlign" ||
        prop === "lineHeight" ||
        prop === "charSpacing";
      if (isTextProp) {
        const anyActive = active as any;
        if (typeof anyActive.initDimensions === "function") anyActive.initDimensions();
        if (prop === "fontFamily" && typeof value === "string") {
          if (typeof document !== "undefined" && "fonts" in document) {
            document.fonts.load(`16px "${value}"`).then(() => c.renderAll()).catch(() => {});
          }
        }
      }
    }
    c.renderAll();
    updateSelection(c);
    saveHistory();
    refreshLayers(c);
  }, [refreshLayers, saveHistory]);

  const changeCanvasBg = useCallback((color: string) => {
    const c = canvasRef.current;
    if (!c) return;
    c.backgroundColor = color;
    setCanvasBgColor(color);
    c.renderAll();
  }, []);

  const toggleGrid = useCallback(() => {
    setShowGrid((prev) => !prev);
  }, []);

  // Undo / Redo
  const undo = useCallback(() => {
    const c = canvasRef.current;
    if (!c || historyIndexRef.current <= 0) return;
    historyIndexRef.current--;
    isRestoringRef.current = true;
    c.loadFromJSON(historyRef.current[historyIndexRef.current]).then(() => {
      c.getObjects().forEach((obj) => ensureLayerData(obj));
      c.renderAll();
      isRestoringRef.current = false;
      updateSelection(c);
      refreshLayers(c);
    });
  }, [ensureLayerData, refreshLayers]);

  const redo = useCallback(() => {
    const c = canvasRef.current;
    if (!c || historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current++;
    isRestoringRef.current = true;
    c.loadFromJSON(historyRef.current[historyIndexRef.current]).then(() => {
      c.getObjects().forEach((obj) => ensureLayerData(obj));
      c.renderAll();
      isRestoringRef.current = false;
      updateSelection(c);
      refreshLayers(c);
    });
  }, [ensureLayerData, refreshLayers]);

  // Export
  const getCanvasDataUrl = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return null;
    return c.toDataURL({ format: "png", quality: 1, multiplier: 2 });
  }, []);

  const exportPNG = useCallback(() => {
    const dataUrl = getCanvasDataUrl();
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${projectName}.png`;
    a.click();
  }, [projectName, getCanvasDataUrl]);

  const exportSVG = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const svg = c.toSVG();
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${projectName}.svg`;
    a.click();
  }, [projectName]);

  const saveProject = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const data = {
      name: projectName,
      canvas: (c as any).toJSON(["data"]),
      bgColor: canvasBgColor,
      width: canvasWidth,
      height: canvasHeight,
    };
    localStorage.setItem("graphic-editor-project", JSON.stringify(data));
  }, [projectName, canvasBgColor, canvasWidth, canvasHeight]);

  // Zoom
  const handleZoom = useCallback((delta: number) => {
    const c = canvasRef.current;
    if (!c) return;
    let z = c.getZoom() + delta;
    z = Math.min(Math.max(z, 0.1), 3);
    c.setZoom(z);
    setZoom(z);
    c.renderAll();
  }, []);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        const active = canvasRef.current?.getActiveObject();
        if (active && active.type !== "i-text") deleteSelected();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") { e.preventDefault(); redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "d") { e.preventDefault(); duplicateSelected(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [deleteSelected, undo, redo, duplicateSelected]);

  return {
    canvasRef, canvasElRef, initCanvas,
    selectedObject, layers, projectName, setProjectName, zoom,
    showGrid, toggleGrid, canvasBgColor, changeCanvasBg,
    canvasWidth, canvasHeight, resizeCanvas,
    addText, addRect, addCircle, addLine, addTriangle, addStar, addPolygon,
    addImage, addImageFromUrl,
    deleteSelected, duplicateSelected, bringToFront, sendToBack,
    selectLayer, toggleLayerVisible, toggleLayerLocked, moveLayerForward, moveLayerBackward, moveLayerToListIndex, renameLayer,
    updateObjectProp,
    undo, redo, exportPNG, exportSVG, saveProject, handleZoom,
    getCanvasDataUrl,
    getProjectData, loadProjectData,
    alignmentSettings, updateAlignmentSettings,
  };
}
