import { useRef, useState, useCallback, useEffect } from "react";
import { Canvas, IText, Rect, Circle, Line, Triangle, Polygon, FabricImage, FabricObject, ActiveSelection, Shadow } from "fabric";

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

const MAX_HISTORY = 50;

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
  const [projectName, setProjectName] = useState("Projeto sem título");
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(false);
  const [canvasBgColor, setCanvasBgColor] = useState("#ffffff");
  const [canvasWidth, setCanvasWidth] = useState(900);
  const [canvasHeight, setCanvasHeight] = useState(600);

  // History
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const isRestoringRef = useRef(false);

  const saveHistory = useCallback(() => {
    if (isRestoringRef.current || !canvasRef.current) return;
    const json = JSON.stringify(canvasRef.current.toJSON());
    const idx = historyIndexRef.current;
    historyRef.current = historyRef.current.slice(0, idx + 1);
    historyRef.current.push(json);
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
    historyIndexRef.current = historyRef.current.length - 1;
  }, []);

  const initCanvas = useCallback((el: HTMLCanvasElement) => {
    if (canvasRef.current) canvasRef.current.dispose();
    canvasElRef.current = el;

    const canvas = new Canvas(el, {
      width: 900,
      height: 600,
      backgroundColor: "#ffffff",
      selection: true,
      preserveObjectStacking: true,
    });

    canvas.on("selection:created", () => updateSelection(canvas));
    canvas.on("selection:updated", () => updateSelection(canvas));
    canvas.on("selection:cleared", () => setSelectedObject(null));
    canvas.on("object:modified", () => { saveHistory(); updateSelection(canvas); });
    canvas.on("object:added", () => saveHistory());
    canvas.on("object:removed", () => saveHistory());

    canvasRef.current = canvas;
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
            canvas.renderAll();
            saveHistory();
          });
        }
      } catch {}
    }

    return canvas;
  }, [saveHistory]);

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
    c.add(text);
    c.setActiveObject(text);
    c.renderAll();
  }, []);

  const addRect = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const rect = new Rect({
      left: 150, top: 150, width: 150, height: 100,
      fill: "#3b82f6", stroke: "#1d4ed8", strokeWidth: 2,
      rx: 8, ry: 8,
    });
    c.add(rect);
    c.setActiveObject(rect);
    c.renderAll();
  }, []);

  const addCircle = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const circle = new Circle({
      left: 200, top: 200, radius: 60,
      fill: "#10b981", stroke: "#047857", strokeWidth: 2,
    });
    c.add(circle);
    c.setActiveObject(circle);
    c.renderAll();
  }, []);

  const addLine = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const line = new Line([50, 300, 300, 300], {
      stroke: "#1a1a1a", strokeWidth: 3,
    });
    c.add(line);
    c.setActiveObject(line);
    c.renderAll();
  }, []);

  const addTriangle = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const tri = new Triangle({
      left: 250, top: 150, width: 100, height: 100,
      fill: "#f59e0b", stroke: "#d97706", strokeWidth: 2,
    });
    c.add(tri);
    c.setActiveObject(tri);
    c.renderAll();
  }, []);

  const addStar = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const pts = createStarPoints(5, 50, 20);
    const star = new Polygon(pts, {
      left: 200, top: 150,
      fill: "#eab308", stroke: "#ca8a04", strokeWidth: 2,
    });
    c.add(star);
    c.setActiveObject(star);
    c.renderAll();
  }, []);

  const addPolygon = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const pts = createPolygonPoints(6, 50);
    const poly = new Polygon(pts, {
      left: 200, top: 200,
      fill: "#8b5cf6", stroke: "#7c3aed", strokeWidth: 2,
    });
    c.add(poly);
    c.setActiveObject(poly);
    c.renderAll();
  }, []);

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
        const maxW = Math.min(400, c.width! * 0.6);
        if (fImg.width && fImg.width > maxW) fImg.scaleToWidth(maxW);
        c.add(fImg);
        c.setActiveObject(fImg);
        c.renderAll();
      };
      imgEl.src = url;
    };
    reader.readAsDataURL(file);
  }, []);

  const addImageFromUrl = useCallback((url: string) => {
    const c = canvasRef.current;
    if (!c) return;
    const imgEl = new Image();
    imgEl.crossOrigin = "anonymous";
    imgEl.onload = () => {
      const fImg = new FabricImage(imgEl, { left: 50, top: 50 });
      const maxW = Math.min(400, c.width! * 0.6);
      if (fImg.width && fImg.width > maxW) fImg.scaleToWidth(maxW);
      c.add(fImg);
      c.setActiveObject(fImg);
      c.renderAll();
    };
    imgEl.onerror = () => {
      console.error("Failed to load image from URL:", url);
    };
    imgEl.src = url;
  }, []);

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
  }, []);

  const duplicateSelected = useCallback(async () => {
    const c = canvasRef.current;
    if (!c) return;
    const active = c.getActiveObject();
    if (!active) return;
    const cloned = await active.clone();
    cloned.set({ left: (cloned.left || 0) + 20, top: (cloned.top || 0) + 20 });
    c.add(cloned);
    c.setActiveObject(cloned);
    c.renderAll();
  }, []);

  const bringToFront = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const active = c.getActiveObject();
    if (active) { c.bringObjectToFront(active); c.renderAll(); }
  }, []);

  const sendToBack = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const active = c.getActiveObject();
    if (active) { c.sendObjectToBack(active); c.renderAll(); }
  }, []);

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
    c.renderAll();
    updateSelection(c);
    saveHistory();
  }, [saveHistory]);

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
      c.renderAll();
      isRestoringRef.current = false;
    });
  }, []);

  const redo = useCallback(() => {
    const c = canvasRef.current;
    if (!c || historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current++;
    isRestoringRef.current = true;
    c.loadFromJSON(historyRef.current[historyIndexRef.current]).then(() => {
      c.renderAll();
      isRestoringRef.current = false;
    });
  }, []);

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
      canvas: c.toJSON(),
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
    selectedObject, projectName, setProjectName, zoom,
    showGrid, toggleGrid, canvasBgColor, changeCanvasBg,
    canvasWidth, canvasHeight, resizeCanvas,
    addText, addRect, addCircle, addLine, addTriangle, addStar, addPolygon,
    addImage, addImageFromUrl,
    deleteSelected, duplicateSelected, bringToFront, sendToBack,
    updateObjectProp,
    undo, redo, exportPNG, exportSVG, saveProject, handleZoom,
    getCanvasDataUrl,
  };
}
