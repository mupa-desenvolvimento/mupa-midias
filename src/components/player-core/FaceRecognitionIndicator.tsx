import { cn } from "@/lib/utils";
import type { FaceRecognitionStatus } from "@/hooks/useFaceRecognitionStatus";

interface Props {
  status: FaceRecognitionStatus;
  facesCount?: number;
  className?: string;
}

const COLOR_MAP: Record<FaceRecognitionStatus, string> = {
  executando: "bg-emerald-500 shadow-emerald-500/60",
  online: "bg-emerald-400/70 shadow-emerald-400/40",
  pendente: "bg-amber-400 shadow-amber-400/50",
  offline: "bg-red-500 shadow-red-500/60",
};

const LABEL_MAP: Record<FaceRecognitionStatus, string> = {
  executando: "Reconhecimento ativo",
  online: "Câmera online",
  pendente: "Inicializando…",
  offline: "Reconhecimento offline",
};

/**
 * Indicador discreto no canto inferior direito.
 * Usa opacity/visibility (nunca display:none) e position absolute para não
 * interferir no fluxo do player.
 */
export function FaceRecognitionIndicator({ status, facesCount = 0, className }: Props) {
  const isActive = status === "executando";
  return (
    <div
      className={cn(
        "absolute bottom-3 right-3 z-50 pointer-events-none select-none",
        "flex items-center gap-2 rounded-full bg-black/55 backdrop-blur-sm",
        "px-2.5 py-1.5 text-[11px] font-medium text-white/90",
        "transition-opacity duration-300",
        className,
      )}
      style={{ willChange: "opacity" }}
      aria-label={LABEL_MAP[status]}
      title={LABEL_MAP[status]}
    >
      <span className="relative flex h-2.5 w-2.5">
        {isActive && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
              COLOR_MAP[status],
            )}
          />
        )}
        <span
          className={cn(
            "relative inline-flex h-2.5 w-2.5 rounded-full shadow-md",
            COLOR_MAP[status],
          )}
        />
      </span>
      {isActive && facesCount > 0 && (
        <span className="tabular-nums opacity-90">
          {facesCount}
        </span>
      )}
    </div>
  );
}
