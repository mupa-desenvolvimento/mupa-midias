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
import { useAudienceIntelligence } from "@/hooks/useAudienceIntelligence";
import { AudienceStats } from "./AudienceStats";
import { DetectionLogger } from "./DetectionLogger";
import type { DetectionLogEntry } from "./types";

const MAX_LOG = 200;

const MonitoringPage = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { ready: modelsReady, error: modelsError } = useFaceApiModels();
  const { status, devices, deviceId, start, setDeviceId } = useCamera(videoRef);

  const detecting = modelsReady && status === "active";
  
  const { activeSessions: sessions, metrics } = useAudienceIntelligence({
    videoRef,
    enabled: detecting,
    intervalMs: 500,
  });

  const [log, setLog] = useState<DetectionLogEntry[]>([]);
  const lastLogTimeRef = useRef(0);

  // Throttle log entries (1 entry per unique session per second max)
  useEffect(() => {
    if (sessions.length === 0) return;
    const now = Date.now();
    if (now - lastLogTimeRef.current < 1000) return;
    lastLogTimeRef.current = now;

    const entries: DetectionLogEntry[] = sessions.map((s) => ({
      timestamp: new Date().toISOString(),
      age: s.age,
      gender: s.gender,
      emotion: s.dominantEmotion,
    }));
    setLog((prev) => [...prev, ...entries].slice(-MAX_LOG));
  }, [sessions]);

  const handleStart = () => start(deviceId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-6 pb-2 border-b">
        <div>
          <h1 className="text-3xl font-extrabold flex items-center gap-3 tracking-tight">
            <Activity className="w-8 h-8 text-primary animate-pulse" />
            Audience Intelligence Hub
          </h1>
          <p className="text-muted-foreground mt-2 max-w-lg">
            Monitoramento inteligente em tempo real com rastreamento leve de sessões e análise de tempo de atenção.
          </p>
        </div>
        <StatusBadge status={status} modelsReady={modelsReady} />
      </header>

      {modelsError && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-2 text-sm text-destructive font-medium">
            <AlertCircle className="w-5 h-5" /> Erro ao carregar modelos: {modelsError}
          </CardContent>
        </Card>
      )}

      {/* Advanced Metrics Dashboard */}
      {detecting && <AudienceStats metrics={metrics} />}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          <div className="relative rounded-3xl overflow-hidden glassmorphism shadow-2xl bg-black aspect-video border border-white/10">
            <CameraFeed ref={videoRef} canvasRef={canvasRef} />
            <FaceDetectionOverlay videoRef={videoRef} canvasRef={canvasRef} sessions={sessions} />
            
            {!detecting && (
               <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60 backdrop-blur-sm">
                  <Camera className="w-16 h-16 text-muted-foreground/40" />
                  <p className="text-white/60 font-medium">Transmissão Inativa</p>
               </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between p-4 bg-muted/30 rounded-2xl gap-4">
            <div className="flex items-center gap-4">
              {devices.length > 0 && (
                <Select
                  value={deviceId}
                  onValueChange={(v) => {
                    setDeviceId(v);
                    start(v);
                  }}
                >
                  <SelectTrigger className="w-64 bg-background/50 border-none shadow-sm h-11">
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
            </div>

            {status !== "active" && (
              <Button 
                onClick={handleStart} 
                disabled={!modelsReady}
                size="lg"
                className="rounded-xl px-8 h-11 shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
              >
                {!modelsReady ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Preparando IA...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 mr-2" /> Ativar Monitoramento
                  </>
                )}
              </Button>
            )}
          </div>

          <StateMessage status={status} faces={sessions.length} modelsReady={modelsReady} />
        </div>

        <aside className="lg:col-span-4 space-y-6">
          <Card className="rounded-3xl border-none bg-muted/20 pb-4">
            <CardContent className="p-0">
               <DetectionLogger log={log} onClear={() => setLog([])} />
            </CardContent>
          </Card>
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
