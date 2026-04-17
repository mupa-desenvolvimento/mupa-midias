import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScanFace, Users, Smile, Activity, Wifi, WifiOff, Clock } from "lucide-react";
import { useDevices, type DeviceWithRelations } from "@/hooks/useDevices";
import { supabase } from "@/integrations/supabase/client";
import type { ActiveFace } from "@/hooks/useFaceDetection";
import { cn } from "@/lib/utils";

interface DeviceFaceState {
  faces: ActiveFace[];
  lastUpdate: number;
  online: boolean;
}

const STALE_AFTER_MS = 5000;

const emotionEmoji: Record<string, string> = {
  neutral: "😐",
  happy: "😊",
  sad: "😢",
  angry: "😠",
  fearful: "😨",
  disgusted: "🤢",
  surprised: "😮",
};

const LiveMonitoring = () => {
  const { devices } = useDevices();
  const [deviceStates, setDeviceStates] = useState<Record<string, DeviceFaceState>>({});
  const [now, setNow] = useState(Date.now());

  // Only camera-enabled devices feed DemoFace
  const monitoredDevices = useMemo(
    () => (devices || []).filter((d) => d.camera_enabled),
    [devices],
  );

  // Subscribe to broadcast channel for each device
  useEffect(() => {
    if (!monitoredDevices.length) return;

    const channels = monitoredDevices.map((device) => {
      const channel = supabase
        .channel(`device_monitor:${device.device_code}`)
        .on("broadcast", { event: "faces" }, (msg) => {
          const payload = msg.payload as { stats: ActiveFace[]; timestamp: string };
          setDeviceStates((prev) => ({
            ...prev,
            [device.device_code]: {
              faces: payload.stats || [],
              lastUpdate: Date.now(),
              online: true,
            },
          }));
        })
        .subscribe();
      return channel;
    });

    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [monitoredDevices]);

  // Tick every second to update online/stale state
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Aggregate stats
  const aggregate = useMemo(() => {
    let onlineDevices = 0;
    let totalFaces = 0;
    const emotions: Record<string, number> = {};
    const genders: Record<string, number> = { masculino: 0, feminino: 0, indefinido: 0 };

    Object.entries(deviceStates).forEach(([_, state]) => {
      const isOnline = now - state.lastUpdate < STALE_AFTER_MS;
      if (!isOnline) return;
      onlineDevices += 1;
      totalFaces += state.faces.length;
      state.faces.forEach((f) => {
        emotions[f.emotion.emotion] = (emotions[f.emotion.emotion] || 0) + 1;
        if (genders[f.gender] !== undefined) genders[f.gender] += 1;
      });
    });

    return { onlineDevices, totalFaces, emotions, genders };
  }, [deviceStates, now]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ScanFace className="w-6 h-6 text-primary" />
          DemoFace
        </h1>
        <p className="text-muted-foreground">
          Visualização em tempo real do reconhecimento facial enviado pelos terminais conectados
          (rota <code className="bg-muted px-1 rounded">/play</code>).
        </p>
      </div>

      {/* Aggregated stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Terminais Online</CardTitle>
            <Wifi className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {aggregate.onlineDevices}
              <span className="text-sm text-muted-foreground font-normal"> / {monitoredDevices.length}</span>
            </div>
            <p className="text-xs text-muted-foreground">com câmera habilitada</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pessoas Detectadas</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregate.totalFaces}</div>
            <p className="text-xs text-muted-foreground">agora mesmo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Emoção Predominante</CardTitle>
            <Smile className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {Object.entries(aggregate.emotions).sort((a, b) => b[1] - a[1])[0]?.[0] || "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              {Object.entries(aggregate.emotions).sort((a, b) => b[1] - a[1])[0]?.[1] || 0} ocorrência(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Distribuição</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-0.5">
              <div>👨 Masculino: <span className="font-bold">{aggregate.genders.masculino}</span></div>
              <div>👩 Feminino: <span className="font-bold">{aggregate.genders.feminino}</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Device grid */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Terminais</h2>
        {monitoredDevices.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <ScanFace className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>Nenhum dispositivo com câmera habilitada.</p>
              <p className="text-xs mt-1">Habilite a câmera nas configurações do dispositivo.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {monitoredDevices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                state={deviceStates[device.device_code]}
                now={now}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface DeviceCardProps {
  device: DeviceWithRelations;
  state?: DeviceFaceState;
  now: number;
}

const DeviceCard = ({ device, state, now }: DeviceCardProps) => {
  const isOnline = state ? now - state.lastUpdate < STALE_AFTER_MS : false;
  const faces = state?.faces || [];
  const lastUpdateSec = state ? Math.round((now - state.lastUpdate) / 1000) : null;

  return (
    <Card className={cn(!isOnline && "opacity-70")}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="truncate">{device.name}</span>
          <Badge
            variant={isOnline ? "default" : "secondary"}
            className={cn("ml-2", isOnline && "bg-green-500 hover:bg-green-500")}
          >
            {isOnline ? (
              <>
                <Wifi className="w-3 h-3 mr-1" /> Ao vivo
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 mr-1" /> Offline
              </>
            )}
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground font-mono">{device.device_code}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Users className="w-4 h-4" /> Pessoas
          </span>
          <span className="text-2xl font-bold">{faces.length}</span>
        </div>

        {faces.length > 0 ? (
          <div className="space-y-2">
            {faces.slice(0, 3).map((face) => (
              <div
                key={face.trackId}
                className="flex items-center justify-between text-sm border-t pt-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{emotionEmoji[face.emotion.emotion] || "😐"}</span>
                  <div>
                    <p className="font-medium capitalize">
                      {face.gender}, {face.age}a
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {face.emotion.emotion}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {(face.emotion.confidence * 100).toFixed(0)}%
                </Badge>
              </div>
            ))}
            {faces.length > 3 && (
              <p className="text-xs text-muted-foreground text-center pt-1">
                +{faces.length - 3} pessoa(s)
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic text-center py-2">
            {isOnline ? "Nenhum rosto no momento" : "Aguardando conexão do terminal..."}
          </p>
        )}

        {lastUpdateSec !== null && (
          <div className="text-xs text-muted-foreground flex items-center gap-1 pt-1 border-t">
            <Clock className="w-3 h-3" />
            <span>Atualizado há {lastUpdateSec}s</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LiveMonitoring;
