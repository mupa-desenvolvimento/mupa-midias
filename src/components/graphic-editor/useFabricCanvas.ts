import { useRef, useState, useCallback, useEffect } from "react";
import { Canvas, IText, Rect, Circle, Line, Triangle, Polygon, FabricImage, FabricObject, ActiveSelection, Shadow, Point, loadSVGFromString, loadSVGFromURL, util } from "fabric";
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
  const bgRectRef = useRef<Rect | null>(null);
  const [selectedObject, setSelectedObject] = useState<SelectedObjectProps | null>(null);
  const [layers, setLayers] = useState<LayerItem[]>([]);
  const [projectName, setProjectName] = useState("Projeto sem título");
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
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
  const isSpacePressedRef = useRef(false);
  const isPanningRef = useRef(false);
  const lastPanClientRef = useRef<{ x: number; y: number } | null>(null);
  const prevSkipTargetFindRef = useRef<boolean | null>(null);
  const prevSelectionRef = useRef<boolean | null>(null);
  const prevDefaultCursorRef = useRef<string | null>(null);
  const prevHoverCursorRef = useRef<string | null>(null);

  const getViewportCenterInCanvasCoords = useCallback((c: Canvas) => {
    const vpt = c.viewportTransform || [1, 0, 0, 1, 0, 0];
    const scaleX = vpt[0] || 1;
    const scaleY = vpt[3] || 1;
    const viewportCx = c.getWidth() / 2;
    const viewportCy = c.getHeight() / 2;
    return {
      x: (viewportCx - (vpt[4] || 0)) / scaleX,
      y: (viewportCy - (vpt[5] || 0)) / scaleY,
    };
  }, []);

  const isBackgroundObject = useCallback((obj: FabricObject) => {
    const anyObj = obj as any;
    const data = anyObj?.data && typeof anyObj.data === "object" ? anyObj.data : null;
    return !!data?.isBackground;
  }, []);

  const syncProjectFromBackground = useCallback((c: Canvas) => {
    const bg = c.getObjects().find((o) => isBackgroundObject(o as any) && (o as any).type === "rect") as Rect | undefined;
    if (!bg) return null;
    const w = Math.max(1, Math.round(bg.getScaledWidth()));
    const h = Math.max(1, Math.round(bg.getScaledHeight()));
    const fill = typeof (bg as any).fill === "string" ? ((bg as any).fill as string) : null;
    setCanvasWidth(w);
    setCanvasHeight(h);
    if (fill) setCanvasBgColor(fill);
    bgRectRef.current = bg;
    return { width: w, height: h, bgColor: fill || canvasBgColor };
  }, [canvasBgColor, isBackgroundObject]);

  const fitPageToViewport = useCallback((c: Canvas, pageW: number, pageH: number) => {
    const vw = c.getWidth();
    const vh = c.getHeight();
    if (!vw || !vh || !pageW || !pageH) return;
    const padding = 48;
    const maxScale = 1;
    const scale = Math.max(
      0.05,
      Math.min(
        maxScale,
        (vw - padding * 2) / pageW,
        (vh - padding * 2) / pageH
      )
    );
    const tx = (vw - pageW * scale) / 2;
    const ty = (vh - pageH * scale) / 2;
    c.setViewportTransform([scale, 0, 0, scale, tx, ty]);
    setZoom(scale);
    c.requestRenderAll();
  }, []);

  const panViewportToObject = useCallback((obj: FabricObject) => {
    const c = canvasRef.current;
    if (!c) return;
    const vpt = c.viewportTransform;
    if (!vpt) return;
    const zoom = c.getZoom() || 1;
    const viewportCx = c.getWidth() / 2;
    const viewportCy = c.getHeight() / 2;
    const center = obj.getCenterPoint();
    vpt[4] = viewportCx - center.x * zoom;
    vpt[5] = viewportCy - center.y * zoom;
    c.setViewportTransform(vpt);
  }, []);

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

  const ensureBackgroundRect = useCallback((canvas: Canvas, opts: { width: number; height: number; color: string }) => {
    const { width, height, color } = opts;
    let bg = bgRectRef.current;

    const objects = canvas.getObjects();
    const bgFromCanvas = objects.find((o) => isBackgroundObject(o as any)) as any;
    if (!bg || !objects.includes(bg)) {
      if (bgFromCanvas && bgFromCanvas.type === "rect") bg = bgFromCanvas as Rect;
      else bg = null;
    }

    if (!bg) {
      bg = new Rect({
        left: 0,
        top: 0,
        width,
        height,
        fill: color,
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
        hoverCursor: "default",
        objectCaching: false,
      });
      (bg as any).set("data", { isBackground: true, layerId: "__background__", layerName: "Fundo" });
      canvas.add(bg);
      canvas.sendObjectToBack(bg);
      (canvas as any).clipPath = new Rect({ left: 0, top: 0, width, height, absolutePositioned: true, evented: false });
      bgRectRef.current = bg;
      return bg;
    }

    const anyBg = bg as any;
    const currentData = anyBg?.data && typeof anyBg.data === "object" ? anyBg.data : {};
    if (!currentData.isBackground || !currentData.layerId) {
      bg.set("data" as any, { ...currentData, isBackground: true, layerId: "__background__", layerName: currentData.layerName || "Fundo" });
    }

    bg.set({ left: 0, top: 0, width, height, fill: color } as any);
    canvas.sendObjectToBack(bg);
    bg.setCoords();
    (canvas as any).clipPath = new Rect({ left: 0, top: 0, width, height, absolutePositioned: true, evented: false });
    bgRectRef.current = bg;
    return bg;
  }, [isBackgroundObject]);

  const ensureLayerData = useCallback((obj: FabricObject) => {
    const anyObj = obj as any;
    const currentData = anyObj?.data && typeof anyObj.data === "object" ? anyObj.data : {};
    const nextData: any = { ...currentData };

    if (nextData?.isBackground) {
      if (!nextData.layerId) nextData.layerId = "__background__";
      if (!nextData.layerName) nextData.layerName = "Fundo";
      anyObj.set("data", nextData);
      return nextData as { layerId: string; layerName: string };
    }

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
          if (isBackgroundObject(obj)) return;
          const data = ensureLayerData(obj);
          if (data?.layerId) activeIds.add(data.layerId);
        });
      } else {
        if (!isBackgroundObject(active as any)) {
          const data = ensureLayerData(active as FabricObject);
          if (data?.layerId) activeIds.add(data.layerId);
        }
      }
    }

    const items: LayerItem[] = canvas
      .getObjects()
      .slice()
      .reverse()
      .filter((obj) => !isBackgroundObject(obj as any))
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
  }, [ensureLayerData, isBackgroundObject]);

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

  const initCanvas = useCallback((el: HTMLCanvasElement, containerEl?: HTMLElement | null) => {
    smartGuidesCleanupRef.current?.();
    smartGuidesCleanupRef.current = null;
    if (canvasRef.current) canvasRef.current.dispose();
    canvasElRef.current = el;

    const viewportW = Math.max(1, Math.floor(containerEl?.clientWidth || 900));
    const viewportH = Math.max(1, Math.floor(containerEl?.clientHeight || 600));

    const canvas = new Canvas(el, {
      width: viewportW,
      height: viewportH,
      backgroundColor: "transparent",
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

      if (isSpacePressedRef.current && ev.button === 0) {
        isPanningRef.current = true;
        lastPanClientRef.current = { x: ev.clientX, y: ev.clientY };
        prevSkipTargetFindRef.current = canvas.skipTargetFind;
        canvas.skipTargetFind = true;
        canvas.discardActiveObject();
        canvas.defaultCursor = "grabbing";
        canvas.requestRenderAll();
        return;
      }

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

    canvas.on("mouse:move", (opt: any) => {
      if (!isPanningRef.current) return;
      const ev = opt?.e as MouseEvent | undefined;
      if (!ev) return;
      const last = lastPanClientRef.current;
      if (!last) return;
      const vpt = canvas.viewportTransform;
      if (!vpt) return;

      vpt[4] += ev.clientX - last.x;
      vpt[5] += ev.clientY - last.y;
      lastPanClientRef.current = { x: ev.clientX, y: ev.clientY };
      canvas.requestRenderAll();
    });

    canvas.on("mouse:up", () => {
      if (!isPanningRef.current) return;
      isPanningRef.current = false;
      lastPanClientRef.current = null;
      canvas.skipTargetFind = prevSkipTargetFindRef.current ?? false;
      prevSkipTargetFindRef.current = null;
      canvas.defaultCursor = isSpacePressedRef.current ? "grab" : (prevDefaultCursorRef.current ?? "default");
      canvas.requestRenderAll();
    });

    canvasRef.current = canvas;
    bgRectRef.current = null;
    ensureBackgroundRect(canvas, { width: canvasWidth, height: canvasHeight, color: canvasBgColor });
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
          ensureBackgroundRect(canvas, { width: canvasWidth, height: canvasHeight, color: data.bgColor });
        }
        if (data.width && data.height) {
          setCanvasWidth(data.width);
          setCanvasHeight(data.height);
          ensureBackgroundRect(canvas, { width: data.width, height: data.height, color: (typeof data.bgColor === "string" && data.bgColor) ? data.bgColor : canvasBgColor });
        }
        if (data.canvas) {
          canvas.loadFromJSON(data.canvas).then(() => {
            canvas.getObjects().forEach((obj) => ensureLayerData(obj));
            const synced = syncProjectFromBackground(canvas);
            const bg = (typeof data.bgColor === "string" && data.bgColor) ? data.bgColor : (synced?.bgColor || canvasBgColor);
            const w = synced?.width || canvasWidth;
            const h = synced?.height || canvasHeight;
            ensureBackgroundRect(canvas, { width: w, height: h, color: bg });
            canvas.renderAll();
            fitPageToViewport(canvas, w, h);
            saveHistory();
            refreshLayers(canvas);
          });
        }
      } catch {
        localStorage.removeItem("graphic-editor-project");
      }
    }

    refreshLayers(canvas);
    fitPageToViewport(canvas, canvasWidth, canvasHeight);
    return canvas;
  }, [canvasBgColor, canvasHeight, canvasWidth, ensureBackgroundRect, ensureLayerData, fitPageToViewport, refreshLayers, saveHistory, syncProjectFromBackground]);

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
      ensureBackgroundRect(c, { width: canvasWidth, height: canvasHeight, color: data.bgColor });
    }
    if (typeof data.width === "number" && typeof data.height === "number" && data.width > 0 && data.height > 0) {
      setCanvasWidth(data.width);
      setCanvasHeight(data.height);
      ensureBackgroundRect(c, { width: data.width, height: data.height, color: (typeof data.bgColor === "string" && data.bgColor) ? data.bgColor : canvasBgColor });
    }

    await c.loadFromJSON(data.canvas);
    c.getObjects().forEach((obj) => ensureLayerData(obj));
    const synced = syncProjectFromBackground(c);
    const bg = (typeof data.bgColor === "string" && data.bgColor) ? data.bgColor : (synced?.bgColor || canvasBgColor);
    const w = synced?.width || canvasWidth;
    const h = synced?.height || canvasHeight;
    ensureBackgroundRect(c, { width: w, height: h, color: bg });
    c.discardActiveObject();
    c.renderAll();
    fitPageToViewport(c, w, h);
    isRestoringRef.current = false;
    saveHistory();
    updateSelection(c);
    refreshLayers(c);
  }, [canvasBgColor, canvasHeight, canvasWidth, ensureBackgroundRect, ensureLayerData, fitPageToViewport, refreshLayers, saveHistory, syncProjectFromBackground]);

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

  // Zoom-to-fit: scales canvas to fill its container
  const zoomToFit = useCallback((containerWidth: number, containerHeight: number) => {
    const c = canvasRef.current;
    if (!c) return;
    const cw = c.getWidth();
    const ch = c.getHeight();
    if (!cw || !ch) return;

    const padding = 40; // px padding around canvas
    const availW = containerWidth - padding * 2;
    const availH = containerHeight - padding * 2;
    if (availW <= 0 || availH <= 0) return;

    const scale = Math.min(availW / cw, availH / ch, 1);
    const vpLeft = (containerWidth - cw * scale) / 2;
    const vpTop = (containerHeight - ch * scale) / 2;

    c.setViewportTransform([scale, 0, 0, scale, vpLeft, vpTop]);
    setZoom(scale);
    c.requestRenderAll();
  }, []);

  // Canvas resize
  const resizeCanvas = useCallback((w: number, h: number) => {
    const c = canvasRef.current;
    if (!c) return;
    setCanvasWidth(w);
    setCanvasHeight(h);
    ensureBackgroundRect(c, { width: w, height: h, color: canvasBgColor });
    fitPageToViewport(c, w, h);
    c.renderAll();
  }, [canvasBgColor, ensureBackgroundRect, fitPageToViewport]);

  const swapCanvasOrientation = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;

    const newW = canvasHeight;
    const newH = canvasWidth;

    setCanvasWidth(newW);
    setCanvasHeight(newH);
    ensureBackgroundRect(c, { width: newW, height: newH, color: canvasBgColor });

    const objects = c.getObjects().filter((o) => !isBackgroundObject(o as any));
    if (objects.length === 0) {
      c.renderAll();
      saveHistory();
      refreshLayers(c);
      return;
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const obj of objects) {
      const rect = obj.getBoundingRect();
      minX = Math.min(minX, rect.left);
      minY = Math.min(minY, rect.top);
      maxX = Math.max(maxX, rect.left + rect.width);
      maxY = Math.max(maxY, rect.top + rect.height);
    }

    const boundsW = Math.max(1, maxX - minX);
    const boundsH = Math.max(1, maxY - minY);
    const oldCenterX = minX + boundsW / 2;
    const oldCenterY = minY + boundsH / 2;

    const targetW = newW * 0.92;
    const targetH = newH * 0.92;
    const scale = Math.min(targetW / boundsW, targetH / boundsH);

    const newCenterX = newW / 2;
    const newCenterY = newH / 2;

    for (const obj of objects) {
      const center = obj.getCenterPoint();
      const dx = center.x - oldCenterX;
      const dy = center.y - oldCenterY;
      const nextCenterX = newCenterX + dx * scale;
      const nextCenterY = newCenterY + dy * scale;

      obj.set({
        scaleX: (obj.scaleX || 1) * scale,
        scaleY: (obj.scaleY || 1) * scale,
      } as any);
      obj.setPositionByOrigin(new Point(nextCenterX, nextCenterY), "center", "center");
      obj.setCoords();
    }

    c.renderAll();
    updateSelection(c);
    saveHistory();
    refreshLayers(c);
    fitPageToViewport(c, newW, newH);
  }, [canvasBgColor, canvasHeight, canvasWidth, ensureBackgroundRect, fitPageToViewport, isBackgroundObject, refreshLayers, saveHistory]);

  // ---- Actions ----

  const addText = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const { x, y } = getViewportCenterInCanvasCoords(c);
    const text = new IText("Texto aqui", {
      left: x, top: y,
      fontSize: 28, fontFamily: "Inter",
      fill: "#1a1a1a",
    });
    ensureLayerData(text);
    c.add(text);
    text.set({ left: x - text.getScaledWidth() / 2, top: y - text.getScaledHeight() / 2 } as any);
    text.setCoords();
    c.setActiveObject(text);
    c.renderAll();
    refreshLayers(c);
  }, [ensureLayerData, getViewportCenterInCanvasCoords, refreshLayers]);

  const addRect = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const { x, y } = getViewportCenterInCanvasCoords(c);
    const rect = new Rect({
      left: x - 150 / 2, top: y - 100 / 2, width: 150, height: 100,
      fill: "#3b82f6", stroke: "#1d4ed8", strokeWidth: 2,
      rx: 8, ry: 8,
    });
    ensureLayerData(rect);
    c.add(rect);
    c.setActiveObject(rect);
    c.renderAll();
    refreshLayers(c);
  }, [ensureLayerData, getViewportCenterInCanvasCoords, refreshLayers]);

  const addCircle = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const { x, y } = getViewportCenterInCanvasCoords(c);
    const circle = new Circle({
      left: x - 60, top: y - 60, radius: 60,
      fill: "#10b981", stroke: "#047857", strokeWidth: 2,
    });
    ensureLayerData(circle);
    c.add(circle);
    c.setActiveObject(circle);
    c.renderAll();
    refreshLayers(c);
  }, [ensureLayerData, getViewportCenterInCanvasCoords, refreshLayers]);

  const addLine = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const { x, y } = getViewportCenterInCanvasCoords(c);
    const line = new Line([50, 300, 300, 300], {
      left: x - 250 / 2,
      top: y,
      stroke: "#1a1a1a", strokeWidth: 3,
    });
    ensureLayerData(line as any);
    c.add(line);
    c.setActiveObject(line);
    c.renderAll();
    refreshLayers(c);
  }, [ensureLayerData, getViewportCenterInCanvasCoords, refreshLayers]);

  const addTriangle = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const { x, y } = getViewportCenterInCanvasCoords(c);
    const tri = new Triangle({
      left: x - 100 / 2, top: y - 100 / 2, width: 100, height: 100,
      fill: "#f59e0b", stroke: "#d97706", strokeWidth: 2,
    });
    ensureLayerData(tri);
    c.add(tri);
    c.setActiveObject(tri);
    c.renderAll();
    refreshLayers(c);
  }, [ensureLayerData, getViewportCenterInCanvasCoords, refreshLayers]);

  const addStar = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const { x, y } = getViewportCenterInCanvasCoords(c);
    const pts = createStarPoints(5, 50, 20);
    const star = new Polygon(pts, {
      left: x - 50, top: y - 50,
      fill: "#eab308", stroke: "#ca8a04", strokeWidth: 2,
    });
    ensureLayerData(star);
    c.add(star);
    c.setActiveObject(star);
    c.renderAll();
    refreshLayers(c);
  }, [ensureLayerData, getViewportCenterInCanvasCoords, refreshLayers]);

  const addPolygon = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const { x, y } = getViewportCenterInCanvasCoords(c);
    const pts = createPolygonPoints(6, 50);
    const poly = new Polygon(pts, {
      left: x - 50, top: y - 50,
      fill: "#8b5cf6", stroke: "#7c3aed", strokeWidth: 2,
    });
    ensureLayerData(poly);
    c.add(poly);
    c.setActiveObject(poly);
    c.renderAll();
    refreshLayers(c);
  }, [ensureLayerData, getViewportCenterInCanvasCoords, refreshLayers]);

  const addImage = useCallback((file: File) => {
    const c = canvasRef.current;
    if (!c) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      const imgEl = new Image();
      imgEl.crossOrigin = "anonymous";
      imgEl.onload = () => {
        const { x, y } = getViewportCenterInCanvasCoords(c);
        const fImg = new FabricImage(imgEl, { left: x, top: y });
        ensureLayerData(fImg as any);
        const maxW = Math.min(400, c.width! * 0.6);
        if (fImg.width && fImg.width > maxW) fImg.scaleToWidth(maxW);
        fImg.set({ left: x - fImg.getScaledWidth() / 2, top: y - fImg.getScaledHeight() / 2 } as any);
        fImg.setCoords();
        c.add(fImg);
        c.setActiveObject(fImg);
        c.renderAll();
        refreshLayers(c);
      };
      imgEl.src = url;
    };
    reader.readAsDataURL(file);
  }, [ensureLayerData, getViewportCenterInCanvasCoords, refreshLayers]);

  const addImageFromUrl = useCallback((url: string) => {
    const c = canvasRef.current;
    if (!c) return;
    const imgEl = new Image();
    imgEl.crossOrigin = "anonymous";
    imgEl.onload = () => {
      const { x, y } = getViewportCenterInCanvasCoords(c);
      const fImg = new FabricImage(imgEl, { left: x, top: y });
      ensureLayerData(fImg as any);
      const maxW = Math.min(400, c.width! * 0.6);
      if (fImg.width && fImg.width > maxW) fImg.scaleToWidth(maxW);
      fImg.set({ left: x - fImg.getScaledWidth() / 2, top: y - fImg.getScaledHeight() / 2 } as any);
      fImg.setCoords();
      c.add(fImg);
      c.setActiveObject(fImg);
      c.renderAll();
      refreshLayers(c);
    };
    imgEl.onerror = () => {
      console.error("Failed to load image from URL:", url);
    };
    imgEl.src = url;
  }, [ensureLayerData, getViewportCenterInCanvasCoords, refreshLayers]);

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
    panViewportToObject(target as any);
    c.renderAll();
    updateSelection(c);
    refreshLayers(c);
  }, [panViewportToObject, refreshLayers]);

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
    ensureBackgroundRect(c, { width: canvasWidth, height: canvasHeight, color });
    setCanvasBgColor(color);
    c.renderAll();
  }, [canvasHeight, canvasWidth, ensureBackgroundRect]);

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
      const synced = syncProjectFromBackground(c);
      const bg = synced?.bgColor || canvasBgColor;
      const w = synced?.width || canvasWidth;
      const h = synced?.height || canvasHeight;
      ensureBackgroundRect(c, { width: w, height: h, color: bg });
      c.renderAll();
      isRestoringRef.current = false;
      updateSelection(c);
      refreshLayers(c);
    });
  }, [canvasBgColor, canvasHeight, canvasWidth, ensureBackgroundRect, ensureLayerData, refreshLayers, syncProjectFromBackground]);

  const redo = useCallback(() => {
    const c = canvasRef.current;
    if (!c || historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current++;
    isRestoringRef.current = true;
    c.loadFromJSON(historyRef.current[historyIndexRef.current]).then(() => {
      c.getObjects().forEach((obj) => ensureLayerData(obj));
      const synced = syncProjectFromBackground(c);
      const bg = synced?.bgColor || canvasBgColor;
      const w = synced?.width || canvasWidth;
      const h = synced?.height || canvasHeight;
      ensureBackgroundRect(c, { width: w, height: h, color: bg });
      c.renderAll();
      isRestoringRef.current = false;
      updateSelection(c);
      refreshLayers(c);
    });
  }, [canvasBgColor, canvasHeight, canvasWidth, ensureBackgroundRect, ensureLayerData, refreshLayers, syncProjectFromBackground]);

  // Export
  const getCanvasDataUrl = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return null;
    const vpt = (c.viewportTransform ? [...c.viewportTransform] : [1, 0, 0, 1, 0, 0]) as [number, number, number, number, number, number];
    const active = c.getActiveObject();
    c.discardActiveObject();
    c.setViewportTransform([1, 0, 0, 1, 0, 0]);
    c.renderAll();

    const dataUrl = (c as any).toDataURL({
      format: "png",
      quality: 1,
      multiplier: 2,
      left: 0,
      top: 0,
      width: canvasWidth,
      height: canvasHeight,
    });

    c.setViewportTransform(vpt);
    c.renderAll();
    if (active) {
      c.setActiveObject(active);
      c.renderAll();
    }

    return dataUrl;
  }, [canvasHeight, canvasWidth]);

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
    const vpt = (c.viewportTransform ? [...c.viewportTransform] : [1, 0, 0, 1, 0, 0]) as [number, number, number, number, number, number];
    const active = c.getActiveObject();
    c.discardActiveObject();
    c.setViewportTransform([1, 0, 0, 1, 0, 0]);
    c.renderAll();

    const svg = (c as any).toSVG({
      width: canvasWidth,
      height: canvasHeight,
      viewBox: { x: 0, y: 0, width: canvasWidth, height: canvasHeight },
    });

    c.setViewportTransform(vpt);
    c.renderAll();
    if (active) {
      c.setActiveObject(active);
      c.renderAll();
    }

    const blob = new Blob([svg], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${projectName}.svg`;
    a.click();
  }, [canvasHeight, canvasWidth, projectName]);

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
    c.zoomToPoint(new Point(c.getWidth() / 2, c.getHeight() / 2), z);
    setZoom(z);
    c.renderAll();
  }, []);

  const handleWheelNavigation = useCallback((e: WheelEvent) => {
    const c = canvasRef.current;
    const el = canvasElRef.current;
    if (!c || !el) return;
    const vpt = c.viewportTransform;
    if (!vpt) return;

    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (e.ctrlKey || e.metaKey) {
      const current = c.getZoom();
      const next = Math.min(Math.max(current * Math.pow(0.999, e.deltaY), 0.1), 3);
      c.zoomToPoint(new Point(x, y), next);
      setZoom(next);
      c.requestRenderAll();
      return;
    }

    const dx = e.shiftKey ? e.deltaY : e.deltaX;
    const dy = e.shiftKey ? 0 : e.deltaY;
    vpt[4] -= dx;
    vpt[5] -= dy;
    c.setViewportTransform(vpt);
    c.requestRenderAll();
  }, []);

  const newProject = useCallback((opts: { width: number; height: number; name?: string; bgColor?: string }) => {
    const c = canvasRef.current;
    if (!c) return;

    const nextW = Math.max(1, Math.floor(opts.width));
    const nextH = Math.max(1, Math.floor(opts.height));
    const nextBg = typeof opts.bgColor === "string" && opts.bgColor ? opts.bgColor : "#ffffff";
    const nextName = typeof opts.name === "string" && opts.name.trim() ? opts.name.trim() : "Projeto sem título";

    try {
      localStorage.removeItem("graphic-editor-project");
    } catch {
      void 0;
    }

    isRestoringRef.current = true;
    c.clear();
    bgRectRef.current = null;
    c.setViewportTransform([1, 0, 0, 1, 0, 0]);
    ensureBackgroundRect(c, { width: nextW, height: nextH, color: nextBg });

    setProjectName(nextName);
    setCanvasBgColor(nextBg);
    setCanvasWidth(nextW);
    setCanvasHeight(nextH);
    setShowGrid(true);

    historyRef.current = [];
    historyIndexRef.current = -1;

    c.discardActiveObject();
    c.renderAll();
    isRestoringRef.current = false;
    fitPageToViewport(c, nextW, nextH);
    saveHistory();
    updateSelection(c);
    refreshLayers(c);
  }, [ensureBackgroundRect, fitPageToViewport, refreshLayers, saveHistory]);

  const setViewportSize = useCallback((w: number, h: number, opts?: { fit?: boolean }) => {
    const c = canvasRef.current;
    if (!c) return;
    const nextW = Math.max(1, Math.floor(w));
    const nextH = Math.max(1, Math.floor(h));

    const zoomNow = c.getZoom() || 1;
    const center = getViewportCenterInCanvasCoords(c);
    c.setDimensions({ width: nextW, height: nextH });

    if (opts?.fit) {
      fitPageToViewport(c, canvasWidth, canvasHeight);
      return;
    }

    const vpt = (c.viewportTransform ? [...c.viewportTransform] : [zoomNow, 0, 0, zoomNow, 0, 0]) as [number, number, number, number, number, number];
    vpt[4] = nextW / 2 - center.x * zoomNow;
    vpt[5] = nextH / 2 - center.y * zoomNow;
    c.setViewportTransform(vpt);
    c.requestRenderAll();
  }, [canvasHeight, canvasWidth, fitPageToViewport, getViewportCenterInCanvasCoords]);

  // Keyboard
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      if (el.isContentEditable) return true;
      const tag = el.tagName?.toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select";
    };

    const keydown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isTypingTarget(e.target)) {
        const c = canvasRef.current;
        const active = c?.getActiveObject() as any;
        const isEditingText = !!(active && (active.type === "i-text" || active.type === "text") && active.isEditing);
        if (!isEditingText) {
          if (!isSpacePressedRef.current) {
            isSpacePressedRef.current = true;
            if (c) {
              prevSelectionRef.current = c.selection;
              prevDefaultCursorRef.current = c.defaultCursor;
              prevHoverCursorRef.current = c.hoverCursor;
              c.selection = false;
              c.defaultCursor = "grab";
              c.hoverCursor = "grab";
            }
          }
          e.preventDefault();
          return;
        }
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        const active = canvasRef.current?.getActiveObject();
        if (active && active.type !== "i-text") deleteSelected();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") { e.preventDefault(); redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "d") { e.preventDefault(); duplicateSelected(); }
    };

    const keyup = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (!isSpacePressedRef.current) return;
      isSpacePressedRef.current = false;
      const c = canvasRef.current;
      if (c) {
        c.selection = prevSelectionRef.current ?? true;
        prevSelectionRef.current = null;
        c.defaultCursor = prevDefaultCursorRef.current ?? "default";
        c.hoverCursor = prevHoverCursorRef.current ?? "move";
        prevDefaultCursorRef.current = null;
        prevHoverCursorRef.current = null;
        c.requestRenderAll();
      }
    };

    window.addEventListener("keydown", keydown, { passive: false });
    window.addEventListener("keyup", keyup);
    return () => {
      window.removeEventListener("keydown", keydown as any);
      window.removeEventListener("keyup", keyup);
    };
  }, [deleteSelected, undo, redo, duplicateSelected]);

  // Sanitize and validate SVG string before parsing
  const sanitizeSVG = useCallback((raw: string): string => {
    let svgStr = raw.trim();
    // Remove BOM if present
    if (svgStr.charCodeAt(0) === 0xFEFF) svgStr = svgStr.slice(1);
    // Remove XML declaration
    svgStr = svgStr.replace(/<\?xml[^?]*\?>\s*/gi, "");
    // Remove DOCTYPE
    svgStr = svgStr.replace(/<!DOCTYPE[^>]*>\s*/gi, "");
    // Strip script tags for safety
    svgStr = svgStr.replace(/<script[\s\S]*?<\/script>/gi, "");
    // Ensure it contains an <svg> tag
    if (!/<svg[\s>]/i.test(svgStr)) {
      throw new Error("O arquivo não contém uma tag <svg> válida.");
    }
    // Add xmlns if missing
    if (!svgStr.includes('xmlns=')) {
      svgStr = svgStr.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    return svgStr;
  }, []);

  const MAX_SVG_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

  const placeSVGOnCanvas = useCallback((c: Canvas, group: FabricObject, name: string) => {
    const { x, y } = getViewportCenterInCanvasCoords(c);
    const maxW = Math.min(500, c.width! * 0.6);
    if (group.width && group.width > maxW) group.scaleToWidth(maxW);
    group.set({ left: x - group.getScaledWidth() / 2, top: y - group.getScaledHeight() / 2 } as any);
    (group as any).set("data", { layerId: makeLayerId(), layerName: name });
    group.setCoords();
    c.add(group);
    c.setActiveObject(group);
    c.renderAll();
    refreshLayers(c);
    return group;
  }, [getViewportCenterInCanvasCoords, refreshLayers]);

  const addSVGFromString = useCallback(async (svgString: string, fileName?: string) => {
    const c = canvasRef.current;
    if (!c) throw new Error("Canvas não inicializado");

    // Size check
    const byteSize = new Blob([svgString]).size;
    if (byteSize > MAX_SVG_SIZE_BYTES) {
      throw new Error(`Arquivo SVG muito grande (${(byteSize / 1024 / 1024).toFixed(1)}MB). Limite: 10MB.`);
    }

    try {
      const sanitized = sanitizeSVG(svgString);
      const { objects, options } = await loadSVGFromString(sanitized);
      const validObjects = objects.filter(Boolean) as FabricObject[];
      if (validObjects.length === 0) throw new Error("SVG vazio — nenhum elemento gráfico encontrado.");
      const group = util.groupSVGElements(validObjects, options);
      return placeSVGOnCanvas(c, group, fileName || "SVG Importado");
    } catch (err: any) {
      const msg = err?.message || "Falha ao importar SVG";
      if (msg.includes("Maximum call stack")) {
        throw new Error("SVG muito complexo para importação direta. Tente simplificar o arquivo.");
      }
      throw new Error(msg);
    }
  }, [sanitizeSVG, placeSVGOnCanvas]);

  const addSVGFromURL = useCallback(async (url: string) => {
    const c = canvasRef.current;
    if (!c) throw new Error("Canvas não inicializado");

    try {
      // First try fetching to avoid CORS issues with loadSVGFromURL
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Erro ao baixar SVG: HTTP ${response.status}`);

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("svg") && !contentType.includes("xml") && !contentType.includes("text")) {
        throw new Error("A URL não retornou um arquivo SVG válido (content-type: " + contentType + ").");
      }

      const text = await response.text();
      const fileName = url.split("/").pop()?.replace(/\.svg.*$/i, "") || "SVG";
      return await addSVGFromString(text, fileName);
    } catch (err: any) {
      const msg = err?.message || "";
      // If fetch failed due to CORS, try fabric's native loader as fallback
      if (msg.includes("Failed to fetch") || msg.includes("CORS") || msg.includes("NetworkError")) {
        try {
          const { objects, options } = await loadSVGFromURL(url);
          const validObjects = objects.filter(Boolean) as FabricObject[];
          if (validObjects.length === 0) throw new Error("SVG vazio ou inacessível.");
          const group = util.groupSVGElements(validObjects, options);
          const fileName = url.split("/").pop()?.replace(/\.svg.*$/i, "") || "SVG";
          return placeSVGOnCanvas(c, group, fileName);
        } catch {
          throw new Error("Não foi possível acessar o SVG. Verifique se a URL permite acesso externo (CORS).");
        }
      }
      throw new Error(msg || "Falha ao carregar SVG da URL.");
    }
  }, [addSVGFromString, placeSVGOnCanvas]);

  function makeLayerId() {
    return typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  return {
    canvasRef, canvasElRef, initCanvas, zoomToFit,
    selectedObject, layers, projectName, setProjectName, zoom,
    showGrid, toggleGrid, canvasBgColor, changeCanvasBg,
    canvasWidth, canvasHeight, resizeCanvas, swapCanvasOrientation,
    addText, addRect, addCircle, addLine, addTriangle, addStar, addPolygon,
    addImage, addImageFromUrl,
    addSVGFromString, addSVGFromURL,
    deleteSelected, duplicateSelected, bringToFront, sendToBack,
    selectLayer, toggleLayerVisible, toggleLayerLocked, moveLayerForward, moveLayerBackward, moveLayerToListIndex, renameLayer,
    updateObjectProp,
    undo, redo, exportPNG, exportSVG, saveProject, handleZoom, handleWheelNavigation,
    getCanvasDataUrl,
    getProjectData, loadProjectData,
    alignmentSettings, updateAlignmentSettings,
    newProject,
    setViewportSize,
  };
}
