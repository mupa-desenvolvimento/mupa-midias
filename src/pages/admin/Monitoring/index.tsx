import { useEffect, useRef, useState } from "react";
import { Activity, AlertCircle, Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { CameraFeed } from "./CameraFeed";
import { FaceDetectionOverlay } from "./FaceDetectionOverlay";
import { DetectionStats } from "./DetectionStats";
import { DetectionLogger } from "./DetectionLogger";
import { useFaceApiModels } from "./useFaceApiModels";
import { useCamera } from "./useCamera";
import { useFaceDetectionLoop } from "./useFaceDetectionLoop";
import type { DetectionLogEntry } from "./types";

const MAX_LOG = 200;

const MonitoringPage = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { ready: modelsReady, error: modelsError } = useFaceApiModels();
  const { status, devices, deviceId, start, setDeviceId } = useCamera(videoRef);

  const detecting = modelsReady && status === "active";
  const faces = useFaceDetectionLoop({
    videoRef,
    enabled: detecting,
    intervalMs: 200,
  });

  const [log, setLog] = useState<DetectionLogEntry[]>([]);
  const lastLogTimeRef = useRef(0);

  // Throttle log entries (1 entry per face per second max)
  useEffect(() => {
    if (faces.length === 0) return;
    const now = Date.now();
    if (now - lastLogTimeRef.current < 1000) return;
    lastLogTimeRef.current = now;

    const entries: DetectionLogEntry[] = faces.map((f) => ({
      timestamp: new Date().toISOString(),
      age: f.age,
      gender: f.gender,
      emotion: f.emotion,
    }));
    setLog((prev) => [...prev, ...entries].slice(-MAX_LOG));
  }, [faces]);

  const handleStart = () => start(deviceId);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Monitoramento Inteligente
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Detecção facial em tempo real · idade · gênero · emoção
          </p>
        </div>
        <StatusBadge status={status} modelsReady={modelsReady} />
      </header>

      {modelsError && (
        <Card className="border-destructive">
          <CardContent className="p-4 flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4" /> Erro ao carregar modelos: {modelsError}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-4">
          <CameraFeed ref={videoRef} canvasRef={canvasRef} />
          <FaceDetectionOverlay videoRef={videoRef} canvasRef={canvasRef} faces={faces} />

          <div className="flex flex-wrap items-center gap-2">
            {devices.length > 1 && (
              <Select
                value={deviceId}
                onValueChange={(v) => {
                  setDeviceId(v);
                  start(v);
                }}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Selecione câmera" />
                </SelectTrigger>
                <SelectContent>
                  {devices.map((d) => (
                    <SelectItem key={d.deviceId} value={d.deviceId}>
                      {d.label || `Câmera ${d.deviceId.slice(0, 6)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {status !== "active" && (
              <Button onClick={handleStart} disabled={!modelsReady}>
                {!modelsReady ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Carregando modelos...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 mr-2" /> Iniciar câmera
                  </>
                )}
              </Button>
            )}
          </div>

          <StateMessage status={status} faces={faces.length} modelsReady={modelsReady} />
        </div>

        <aside className="space-y-4">
          <DetectionStats faces={faces} />
          <DetectionLogger log={log} onClear={() => setLog([])} />
        </aside>
      </div>
    </div>
  );
};

const StatusBadge = ({
  status,
  modelsReady,
}: {
  status: string;
  modelsReady: boolean;
}) => {
  const active = status === "active";
  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
        active
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-muted text-muted-foreground"
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          active ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"
        }`}
      />
      {!modelsReady
        ? "Carregando modelos"
        : active
        ? "Câmera ativa"
        : "Câmera inativa"}
    </div>
  );
};

const StateMessage = ({
  status,
  faces,
  modelsReady,
}: {
  status: string;
  faces: number;
  modelsReady: boolean;
}) => {
  if (!modelsReady)
    return <Hint>Inicializando modelos de reconhecimento facial...</Hint>;
  if (status === "denied")
    return <Hint variant="error">Permissão da câmera negada. Habilite nas configurações do navegador.</Hint>;
  if (status === "no-camera")
    return <Hint variant="error">Nenhuma câmera encontrada neste dispositivo.</Hint>;
  if (status === "error")
    return <Hint variant="error">Erro ao acessar câmera. Tente novamente.</Hint>;
  if (status === "active" && faces === 0)
    return <Hint>Aguardando detecção de rostos...</Hint>;
  return null;
};

const Hint = ({
  children,
  variant = "info",
}: {
  children: React.ReactNode;
  variant?: "info" | "error";
}) => (
  <p
    className={`text-sm ${
      variant === "error" ? "text-destructive" : "text-muted-foreground"
    }`}
  >
    {children}
  </p>
);

export default MonitoringPage;
