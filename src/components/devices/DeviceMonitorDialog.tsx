import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Users, Activity, Camera, Wifi, WifiOff } from "lucide-react";
import { DeviceWithRelations } from "@/hooks/useDevices";
import { supabase } from "@/integrations/supabase/client";
import { ActiveFace } from "@/hooks/useFaceDetection";

interface DeviceMonitorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device: DeviceWithRelations | null;
}

interface StreamPayload {
  image: string;
  stats: ActiveFace[];
  timestamp: string;
  meta: { width: number; height: number };
}

interface FacesPayload {
  stats: ActiveFace[];
  count: number;
  timestamp: string;
}

export function DeviceMonitorDialog({
  open,
  onOpenChange,
  device,
}: DeviceMonitorDialogProps) {
  const [channelStatus, setChannelStatus] = useState<"connecting" | "connected" | "error">("connecting");
  const [hasReceivedData, setHasReceivedData] = useState(false);
  const [lastFrame, setLastFrame] = useState<StreamPayload | null>(null);
  const [lastFaces, setLastFaces] = useState<FacesPayload | null>(null);
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Subscribe to monitor channel
  useEffect(() => {
    if (!open || !device) return;

    setChannelStatus("connecting");
    setHasReceivedData(false);
    setLastFrame(null);
    setLastFaces(null);

    const channelName = `device_monitor:${device.device_code}`;
    console.log("[Monitor] Subscribing to:", channelName);

    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false, ack: false } },
    })
      .on("broadcast", { event: "frame" }, (payload) => {
        setHasReceivedData(true);
        setLastFrame(payload.payload as StreamPayload);
        setLastEventAt(new Date());
      })
      .on("broadcast", { event: "faces" }, (payload) => {
        setHasReceivedData(true);
        setLastFaces(payload.payload as FacesPayload);
        setLastEventAt(new Date());
      })
      .subscribe((status) => {
        console.log(`[Monitor] Channel status:`, status);
        if (status === "SUBSCRIBED") {
          setChannelStatus("connected");
          // Now that we are subscribed, request frame stream + current state from device
          channel.send({
            type: "broadcast",
            event: "start_stream",
            payload: {},
          });
          channel.send({
            type: "broadcast",
            event: "request_state",
            payload: {},
          });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setChannelStatus("error");
        }
      });

    return () => {
      try {
        channel.send({
          type: "broadcast",
          event: "stop_stream",
          payload: {},
        });
      } catch (err) {
        console.warn("[Monitor] Failed to send stop_stream:", err);
      }
      supabase.removeChannel(channel);
    };
  }, [open, device?.device_code]);

  // Render frame to canvas (when frame stream is active)
  useEffect(() => {
    if (!lastFrame || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const stats = lastFrame.stats || [];
      if (stats.length > 0) {
        stats.forEach((face) => {
          const sourceWidth = lastFrame.meta?.width || img.width;
          const sourceHeight = lastFrame.meta?.height || img.height;
          const scaleX = canvas.width / sourceWidth;
          const scaleY = canvas.height / sourceHeight;
          const { x, y, width, height } = face.position;

          ctx.strokeStyle = "hsl(142, 76%, 50%)";
          ctx.lineWidth = 2;
          ctx.strokeRect(x * scaleX, y * scaleY, width * scaleX, height * scaleY);

          ctx.fillStyle = "hsl(142, 76%, 50%)";
          ctx.font = "14px sans-serif";
          const label = `${face.gender}, ${face.ageGroup}`;
          ctx.fillText(label, x * scaleX, y * scaleY - 5);

          const emotion = `${face.emotion.emotion} (${Math.round(face.emotion.confidence * 100)}%)`;
          ctx.fillText(emotion, x * scaleX, y * scaleY + height * scaleY + 15);
        });
      }
    };
    img.src = lastFrame.image;
  }, [lastFrame]);

  // Stats source: prefer the heavier frame payload, fallback to lightweight faces broadcast
  const stats: ActiveFace[] = lastFrame?.stats ?? lastFaces?.stats ?? [];
  const lastTimestamp = lastFrame?.timestamp ?? lastFaces?.timestamp;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Monitoramento em Tempo Real: {device?.name}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <span>Visualização da câmera e análise de IA do dispositivo.</span>
            {channelStatus === "connected" ? (
              <Badge variant="outline" className="gap-1">
                <Wifi className="w-3 h-3" /> Canal conectado
              </Badge>
            ) : channelStatus === "error" ? (
              <Badge variant="destructive" className="gap-1">
                <WifiOff className="w-3 h-3" /> Erro de canal
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Conectando...
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Video Feed Area */}
          <div className="md:col-span-2 bg-black rounded-lg overflow-hidden aspect-video relative flex items-center justify-center">
            {!lastFrame ? (
              <div className="text-white text-center px-4">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                {channelStatus === "connected" && hasReceivedData ? (
                  <>
                    <p>Recebendo telemetria, aguardando vídeo...</p>
                    <p className="text-xs text-white/70 mt-1">
                      O dispositivo está respondendo. O stream de vídeo iniciará em instantes.
                    </p>
                  </>
                ) : channelStatus === "connected" ? (
                  <>
                    <p>Aguardando dados do dispositivo...</p>
                    <p className="text-xs text-white/70 mt-1">
                      Verifique se o player está aberto em /play ou /device.
                    </p>
                  </>
                ) : (
                  <>
                    <p>Conectando ao canal de monitoramento...</p>
                    <p className="text-xs text-white/70 mt-1">Device: {device?.device_code}</p>
                  </>
                )}
              </div>
            ) : (
              <canvas
                ref={canvasRef}
                width={640}
                height={480}
                className="w-full h-full object-contain"
              />
            )}

            {hasReceivedData && (
              <div className="absolute top-2 right-2">
                <Badge variant="default" className="bg-green-500 animate-pulse">
                  AO VIVO
                </Badge>
              </div>
            )}
          </div>

          {/* Stats Area */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Pessoas Detectadas</span>
                  </div>
                  <span className="text-2xl font-bold">{stats.length}</span>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Emoções Atuais
                  </p>
                  {stats.map((face, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-sm border-b pb-2 last:border-0"
                    >
                      <span className="capitalize">{face.emotion.emotion}</span>
                      <Badge variant="outline">
                        {Math.round(face.emotion.confidence * 100)}%
                      </Badge>
                    </div>
                  ))}
                  {stats.length === 0 && (
                    <p className="text-sm text-muted-foreground italic">
                      Nenhuma face detectada
                    </p>
                  )}
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Demografia
                  </p>
                  {stats.map((face, idx) => (
                    <div key={idx} className="text-sm">
                      <span className="font-medium">Pessoa {idx + 1}:</span> {face.gender},{" "}
                      {face.ageGroup}
                    </div>
                  ))}
                  {stats.length === 0 && (
                    <p className="text-sm text-muted-foreground italic">—</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Activity className="w-3 h-3" />
              <span>
                Atualizado:{" "}
                {lastTimestamp
                  ? new Date(lastTimestamp).toLocaleTimeString()
                  : lastEventAt
                  ? lastEventAt.toLocaleTimeString()
                  : "-"}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
