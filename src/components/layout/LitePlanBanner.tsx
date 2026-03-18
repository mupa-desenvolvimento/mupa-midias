import { useTenantLicense } from "@/hooks/useTenantLicense";
import { Info } from "lucide-react";

export function LitePlanBanner() {
  const { license, isLite, isLoading } = useTenantLicense();

  if (isLoading || !isLite || !license?.has_license) return null;

  const limits = [
    license.max_playlists !== undefined && `${license.max_playlists} playlist${license.max_playlists !== 1 ? "s" : ""}`,
    license.max_devices !== undefined && `${license.max_devices} dispositivo${license.max_devices !== 1 ? "s" : ""}`,
    license.max_media_uploads !== undefined && `${license.max_media_uploads} mídia${license.max_media_uploads !== 1 ? "s" : ""}`,
    license.max_stores !== undefined && `${license.max_stores} loja${license.max_stores !== 1 ? "s" : ""}`,
    license.max_device_groups !== undefined && `${license.max_device_groups} grupo${license.max_device_groups !== 1 ? "s" : ""}`,
    !license.allow_video_upload && "sem vídeo",
  ].filter(Boolean);

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-700 dark:text-amber-400">
      <Info className="h-3.5 w-3.5 shrink-0" />
      <span>
        <strong>Plano Lite</strong> — Limites: {limits.join(" · ")}
      </span>
    </div>
  );
}
