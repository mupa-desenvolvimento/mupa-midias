/**
 * Generates a styled thumbnail image (as data URL) for webview content.
 * Shows a browser-style frame with the domain name.
 */
export function generateWebviewThumbnail(url: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext("2d")!;

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 640, 360);
  bg.addColorStop(0, "#1e293b");
  bg.addColorStop(1, "#0f172a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 640, 360);

  // Browser chrome bar
  ctx.fillStyle = "#334155";
  ctx.beginPath();
  ctx.roundRect(40, 40, 560, 280, 12);
  ctx.fill();

  // Title bar
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.roundRect(40, 40, 560, 36, [12, 12, 0, 0]);
  ctx.fill();

  // Traffic light dots
  const dots = ["#ef4444", "#f59e0b", "#22c55e"];
  dots.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(62 + i * 20, 58, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  // URL bar
  ctx.fillStyle = "#475569";
  ctx.beginPath();
  ctx.roundRect(140, 47, 400, 22, 6);
  ctx.fill();

  // Domain text in URL bar
  let domain = url;
  try {
    domain = new URL(url).hostname;
  } catch {}
  ctx.fillStyle = "#94a3b8";
  ctx.font = "12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(domain.length > 45 ? domain.slice(0, 42) + "…" : domain, 340, 58);

  // Content area
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(40, 76, 560, 244);

  // Globe icon (simplified)
  const cx = 320, cy = 160;
  ctx.strokeStyle = "#3b82f6";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 32, 0, Math.PI * 2);
  ctx.stroke();
  // Horizontal lines
  ctx.beginPath();
  ctx.moveTo(cx - 32, cy);
  ctx.lineTo(cx + 32, cy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 28, cy - 14);
  ctx.lineTo(cx + 28, cy - 14);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 28, cy + 14);
  ctx.lineTo(cx + 28, cy + 14);
  ctx.stroke();
  // Vertical ellipse
  ctx.beginPath();
  ctx.ellipse(cx, cy, 14, 32, 0, 0, Math.PI * 2);
  ctx.stroke();

  // "WebView" label
  ctx.fillStyle = "#60a5fa";
  ctx.font = "bold 18px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("WebView", cx, cy + 56);

  // Domain below
  ctx.fillStyle = "#64748b";
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillText(domain.length > 50 ? domain.slice(0, 47) + "…" : domain, cx, cy + 78);

  return canvas.toDataURL("image/png");
}

/**
 * Converts a data URL to a Blob for upload.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/png";
  const bytes = atob(data);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
