export type Bounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  cx: number;
  cy: number;
  width: number;
  height: number;
};

export type GuideLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type AlignmentSettings = {
  enabled: boolean;
  snapEnabled: boolean;
  snapCenter: boolean;
  snapObjects: boolean;
  snapGrid: boolean;
  snapDistancePx: number;
  gridSize: number;
};

type Candidate = {
  axis: "x" | "y";
  delta: number;
  guide: GuideLine;
  abs: number;
  source: "canvas-edge" | "canvas-center" | "object" | "grid";
};

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

export const computeAlignment = ({
  moving,
  others,
  canvasWidth,
  canvasHeight,
  zoom,
  settings,
}: {
  moving: Bounds;
  others: Bounds[];
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  settings: AlignmentSettings;
}) => {
  const threshold = (settings.snapDistancePx || 5) / Math.max(zoom || 1, 0.0001);
  const candidates: Candidate[] = [];

  const addX = (source: Candidate["source"], targetX: number, delta: number, y1: number, y2: number) => {
    const abs = Math.abs(delta);
    if (abs > threshold) return;
    candidates.push({
      axis: "x",
      delta,
      abs,
      guide: { x1: targetX, y1, x2: targetX, y2 },
      source,
    });
  };

  const addY = (source: Candidate["source"], targetY: number, delta: number, x1: number, x2: number) => {
    const abs = Math.abs(delta);
    if (abs > threshold) return;
    candidates.push({
      axis: "y",
      delta,
      abs,
      guide: { x1, y1: targetY, x2, y2: targetY },
      source,
    });
  };

  const spanYFromObjects = (yA1: number, yA2: number, yB1: number, yB2: number) => {
    const y1 = clamp(Math.min(yA1, yB1) - 20 / Math.max(zoom || 1, 0.0001), 0, canvasHeight);
    const y2 = clamp(Math.max(yA2, yB2) + 20 / Math.max(zoom || 1, 0.0001), 0, canvasHeight);
    return { y1, y2 };
  };

  const spanXFromObjects = (xA1: number, xA2: number, xB1: number, xB2: number) => {
    const x1 = clamp(Math.min(xA1, xB1) - 20 / Math.max(zoom || 1, 0.0001), 0, canvasWidth);
    const x2 = clamp(Math.max(xA2, xB2) + 20 / Math.max(zoom || 1, 0.0001), 0, canvasWidth);
    return { x1, x2 };
  };

  const addCanvasGuides = () => {
    const cx = canvasWidth / 2;
    const cy = canvasHeight / 2;
    addX("canvas-edge", 0, 0 - moving.left, 0, canvasHeight);
    addX("canvas-edge", canvasWidth, canvasWidth - moving.right, 0, canvasHeight);
    addY("canvas-edge", 0, 0 - moving.top, 0, canvasWidth);
    addY("canvas-edge", canvasHeight, canvasHeight - moving.bottom, 0, canvasWidth);
    if (settings.snapCenter) {
      addX("canvas-center", cx, cx - moving.cx, 0, canvasHeight);
      addY("canvas-center", cy, cy - moving.cy, 0, canvasWidth);
    }
  };

  addCanvasGuides();

  if (settings.snapObjects) {
    for (const o of others) {
      const { y1, y2 } = spanYFromObjects(moving.top, moving.bottom, o.top, o.bottom);
      addX("object", o.left, o.left - moving.left, y1, y2);
      addX("object", o.cx, o.cx - moving.cx, y1, y2);
      addX("object", o.right, o.right - moving.right, y1, y2);

      const { x1, x2 } = spanXFromObjects(moving.left, moving.right, o.left, o.right);
      addY("object", o.top, o.top - moving.top, x1, x2);
      addY("object", o.cy, o.cy - moving.cy, x1, x2);
      addY("object", o.bottom, o.bottom - moving.bottom, x1, x2);
    }
  }

  if (settings.snapGrid && settings.gridSize > 0) {
    const grid = settings.gridSize;
    const gx = Math.round(moving.left / grid) * grid;
    const gy = Math.round(moving.top / grid) * grid;
    addX("grid", gx, gx - moving.left, 0, canvasHeight);
    addY("grid", gy, gy - moving.top, 0, canvasWidth);
  }

  const equalSpacingGuides: GuideLine[] = [];
  const equalSpacingDelta: { dx?: number; dy?: number } = {};

  if (settings.snapObjects) {
    const sameRow = others
      .filter((o) => Math.abs(o.cy - moving.cy) <= Math.max(30 / Math.max(zoom || 1, 0.0001), Math.min(moving.height, o.height) * 0.35))
      .sort((a, b) => a.cx - b.cx);

    const leftNeighbor = sameRow.filter((o) => o.right <= moving.left + threshold).sort((a, b) => b.right - a.right)[0];
    const rightNeighbor = sameRow.filter((o) => o.left >= moving.right - threshold).sort((a, b) => a.left - b.left)[0];

    if (leftNeighbor && rightNeighbor) {
      const gapLeft = moving.left - leftNeighbor.right;
      const gapRight = rightNeighbor.left - moving.right;
      if (gapLeft >= 0 && gapRight >= 0 && Math.abs(gapLeft - gapRight) <= threshold) {
        const requiredLeft = (leftNeighbor.right + rightNeighbor.left - moving.width) / 2;
        const dx = requiredLeft - moving.left;
        if (Math.abs(dx) <= threshold) {
          equalSpacingDelta.dx = dx;
          const y = clamp(moving.cy, 0, canvasHeight);
          equalSpacingGuides.push({ x1: leftNeighbor.right, y1: y, x2: moving.left, y2: y });
          equalSpacingGuides.push({ x1: moving.right, y1: y, x2: rightNeighbor.left, y2: y });
        }
      }
    }

    const sameCol = others
      .filter((o) => Math.abs(o.cx - moving.cx) <= Math.max(30 / Math.max(zoom || 1, 0.0001), Math.min(moving.width, o.width) * 0.35))
      .sort((a, b) => a.cy - b.cy);

    const topNeighbor = sameCol.filter((o) => o.bottom <= moving.top + threshold).sort((a, b) => b.bottom - a.bottom)[0];
    const bottomNeighbor = sameCol.filter((o) => o.top >= moving.bottom - threshold).sort((a, b) => a.top - b.top)[0];

    if (topNeighbor && bottomNeighbor) {
      const gapTop = moving.top - topNeighbor.bottom;
      const gapBottom = bottomNeighbor.top - moving.bottom;
      if (gapTop >= 0 && gapBottom >= 0 && Math.abs(gapTop - gapBottom) <= threshold) {
        const requiredTop = (topNeighbor.bottom + bottomNeighbor.top - moving.height) / 2;
        const dy = requiredTop - moving.top;
        if (Math.abs(dy) <= threshold) {
          equalSpacingDelta.dy = dy;
          const x = clamp(moving.cx, 0, canvasWidth);
          equalSpacingGuides.push({ x1: x, y1: topNeighbor.bottom, x2: x, y2: moving.top });
          equalSpacingGuides.push({ x1: x, y1: moving.bottom, x2: x, y2: bottomNeighbor.top });
        }
      }
    }
  }

  const bestX = candidates.filter((c) => c.axis === "x").sort((a, b) => a.abs - b.abs)[0];
  const bestY = candidates.filter((c) => c.axis === "y").sort((a, b) => a.abs - b.abs)[0];

  const snapAllowed = (c: Candidate) => {
    if (c.source === "canvas-edge") return true;
    if (c.source === "canvas-center") return settings.snapCenter;
    if (c.source === "object") return settings.snapObjects;
    if (c.source === "grid") return settings.snapGrid;
    return false;
  };

  const bestSnapX = candidates.filter((c) => c.axis === "x" && snapAllowed(c)).sort((a, b) => a.abs - b.abs)[0];
  const bestSnapY = candidates.filter((c) => c.axis === "y" && snapAllowed(c)).sort((a, b) => a.abs - b.abs)[0];

  const guides: GuideLine[] = [];
  if (bestX) guides.push(bestX.guide);
  if (bestY) guides.push(bestY.guide);
  guides.push(...equalSpacingGuides);

  const dx = bestSnapX?.delta ?? 0;
  const dy = bestSnapY?.delta ?? 0;

  const finalDx = settings.snapObjects && equalSpacingDelta.dx !== undefined ? equalSpacingDelta.dx : dx;
  const finalDy = settings.snapObjects && equalSpacingDelta.dy !== undefined ? equalSpacingDelta.dy : dy;

  return {
    guides,
    snap: {
      dx: settings.snapEnabled ? finalDx : 0,
      dy: settings.snapEnabled ? finalDy : 0,
    },
    near: {
      hasX: !!bestX || equalSpacingDelta.dx !== undefined,
      hasY: !!bestY || equalSpacingDelta.dy !== undefined,
    },
  };
};
