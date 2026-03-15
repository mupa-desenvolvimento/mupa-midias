import type { Canvas } from "fabric";
import { computeAlignment, type AlignmentSettings, type Bounds, type GuideLine } from "@/editor/alignment-engine";
import { applySnapToObject } from "@/editor/snap-engine";

const getCanvasSize = (c: any) => {
  const w = typeof c.getWidth === "function" ? c.getWidth() : c.width;
  const h = typeof c.getHeight === "function" ? c.getHeight() : c.height;
  return { w: w || 0, h: h || 0 };
};

const getTopCanvasElementSize = (c: any) => {
  const el = c?.upperCanvasEl || c?.canvas?.upperCanvasEl;
  return { w: el?.width || 0, h: el?.height || 0 };
};

const getObjectBounds = (obj: any): Bounds | null => {
  if (!obj) return null;
  const rect = typeof obj.getBoundingRect === "function" ? obj.getBoundingRect(true, true) : null;
  const left = rect?.left ?? obj.left ?? 0;
  const top = rect?.top ?? obj.top ?? 0;
  const width = rect?.width ?? obj.width ?? 0;
  const height = rect?.height ?? obj.height ?? 0;
  const right = left + width;
  const bottom = top + height;
  const cx = left + width / 2;
  const cy = top + height / 2;
  return { left, top, right, bottom, cx, cy, width, height };
};

const drawGuides = (canvas: any, guides: GuideLine[], color: string) => {
  const ctx: CanvasRenderingContext2D | undefined = canvas?.contextTop;
  if (!ctx) return;

  const { w, h } = getTopCanvasElementSize(canvas);
  if (w <= 0 || h <= 0) return;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.restore();

  if (!guides.length) return;

  const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
  const zoom = typeof canvas.getZoom === "function" ? canvas.getZoom() : 1;

  ctx.save();
  ctx.setTransform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5]);
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 1 / Math.max(zoom || 1, 0.0001);

  for (const g of guides) {
    ctx.beginPath();
    ctx.moveTo(g.x1, g.y1);
    ctx.lineTo(g.x2, g.y2);
    ctx.stroke();
  }
  ctx.restore();
};

const clearGuides = (canvas: any) => {
  const ctx: CanvasRenderingContext2D | undefined = canvas?.contextTop;
  if (!ctx) return;
  const { w, h } = getTopCanvasElementSize(canvas);
  if (w <= 0 || h <= 0) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.restore();
};

export const attachSmartGuides = ({
  canvas,
  getSettings,
  guideColor = "#00AEEF",
}: {
  canvas: Canvas;
  getSettings: () => AlignmentSettings;
  guideColor?: string;
}) => {
  const c: any = canvas;
  let raf = 0;
  let lastTarget: any = null;
  let lastMode: "moving" | "scaling" | "rotating" | null = null;

  const computeAndApply = () => {
    raf = 0;
    const settings = getSettings();
    if (!settings.enabled) {
      clearGuides(c);
      return;
    }

    const active = lastTarget || c.getActiveObject?.();
    if (!active) {
      clearGuides(c);
      return;
    }

    const moving = getObjectBounds(active);
    if (!moving) {
      clearGuides(c);
      return;
    }

    const { w: canvasWidth, h: canvasHeight } = getCanvasSize(c);
    const zoom = typeof c.getZoom === "function" ? c.getZoom() : 1;

    const others = (c.getObjects?.() || [])
      .filter((o: any) => o && o !== active && o.visible !== false && o.evented !== false)
      .map(getObjectBounds)
      .filter(Boolean) as Bounds[];

    const result = computeAlignment({
      moving,
      others,
      canvasWidth,
      canvasHeight,
      zoom,
      settings,
    });

    if (lastMode === "moving" && settings.snapEnabled && (result.snap.dx || result.snap.dy)) {
      applySnapToObject(active, result.snap.dx, result.snap.dy);
      c.requestRenderAll?.();
    }

    drawGuides(c, result.guides, guideColor);
  };

  const schedule = (target: any, mode: "moving" | "scaling" | "rotating") => {
    lastTarget = target;
    lastMode = mode;
    if (raf) return;
    raf = requestAnimationFrame(computeAndApply);
  };

  const onMoving = (opt: any) => schedule(opt?.target, "moving");
  const onScaling = (opt: any) => schedule(opt?.target, "scaling");
  const onRotating = (opt: any) => schedule(opt?.target, "rotating");
  const onMouseUp = () => {
    lastTarget = null;
    lastMode = null;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    clearGuides(c);
  };

  c.on("object:moving", onMoving);
  c.on("object:scaling", onScaling);
  c.on("object:rotating", onRotating);
  c.on("mouse:up", onMouseUp);
  c.on("selection:cleared", onMouseUp);

  return () => {
    c.off("object:moving", onMoving);
    c.off("object:scaling", onScaling);
    c.off("object:rotating", onRotating);
    c.off("mouse:up", onMouseUp);
    c.off("selection:cleared", onMouseUp);
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    clearGuides(c);
  };
};
