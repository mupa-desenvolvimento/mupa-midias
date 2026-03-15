export const applySnapToObject = (obj: any, dx: number, dy: number) => {
  if (!obj) return;
  const hasDx = typeof dx === "number" && Math.abs(dx) > 0;
  const hasDy = typeof dy === "number" && Math.abs(dy) > 0;
  if (!hasDx && !hasDy) return;

  const left = typeof obj.left === "number" ? obj.left : 0;
  const top = typeof obj.top === "number" ? obj.top : 0;
  obj.set({
    left: left + (hasDx ? dx : 0),
    top: top + (hasDy ? dy : 0),
  });
  if (typeof obj.setCoords === "function") obj.setCoords();
};
