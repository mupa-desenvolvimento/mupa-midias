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
import { Loader2, Users, Smile, Clock, Activity, Camera } from "lucide-react";
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

export function DeviceMonitorDialog({
  open,
  onOpenChange,
  device,
}: DeviceMonitorDialogProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastFrame, setLastFrame] = useState<StreamPayload | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();

  // Subscribe to stream
  useEffect(() => {
    if (!open || !device) return;

    console.log("Connecting to monitor channel:", `device_monitor:${device.device_code}`);

    const channel = supabase.channel(`device_monitor:${device.device_code}`)
      .on('broadcast', { event: 'start_stream' }, () => {
        setIsConnected(true);
        console.log("Stream started by device");
      })
      .on('broadcast', { event: 'stop_stream' }, () => {
        setIsConnected(false);
        setLastFrame(null);
        console.log("Stream stopped by device");
      })
      .on('broadcast', { event: 'frame' }, (payload) => {
        if (!isConnected) setIsConnected(true);
        setLastFrame(payload.payload as StreamPayload);
      })
      .subscribe();

    // Trigger device to start streaming if it's listening
    // We might need a way to tell the device "Start sending data"
    // Currently the device starts streaming when it initializes useDeviceMonitor
    // But maybe we should send a 'request_stream' event?
    // For now, let's assume the device is already streaming or will start when we connect if we add that logic later.
    // Ideally, the device should only stream when someone is watching to save bandwidth.
    // Let's send a 'start_stream' signal.
    channel.send({
      type: 'broadcast',
      event: 'start_stream',
      payload: {}
    });

    return () => {
      channel.send({
        type: 'broadcast',
        event: 'stop_stream',
        payload: {}
      });
      supabase.removeChannel(channel);
      setIsConnected(false);
      setLastFrame(null);
    };
  }, [open, device?.device_code]);

  // Render frame to canvas
  useEffect(() => {
    if (!lastFrame || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Draw overlays (faces)
      if (lastFrame.stats && lastFrame.stats.length > 0) {
        lastFrame.stats.forEach(face => {
            // The position from face-api is relative to the source video (640x480 typically)
            // We need to scale it to our canvas size
            // Use meta dimensions if available, otherwise fallback to img size
            const sourceWidth = lastFrame.meta?.width || img.width;
            const sourceHeight = lastFrame.meta?.height || img.height;
            
            const scaleX = canvas.width / sourceWidth;
            const scaleY = canvas.height / sourceHeight;

            const { x, y, width, height } = face.position;

            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 2;
            ctx.strokeRect(x * scaleX, y * scaleY, width * scaleX, height * scaleY);

            // Draw labels
            ctx.fillStyle = '#00ff00';
            ctx.font = '14px sans-serif';
            const label = `${face.gender}, ${face.ageGroup}`;
            ctx.fillText(label, x * scaleX, (y * scaleY) - 5);
            
            const emotion = `${face.emotion.emotion} (${Math.round(face.emotion.confidence * 100)}%)`;
            ctx.fillText(emotion, x * scaleX, (y * scaleY) + (height * scaleY) + 15);
        });
      }
    };
    img.src = lastFrame.image;

  }, [lastFrame]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Monitoramento em Tempo Real: {device?.name}
          </DialogTitle>
          <DialogDescription>
            Visualização da câmera e análise de IA do dispositivo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Video Feed Area */}
          <div className="md:col-span-2 bg-black rounded-lg overflow-hidden aspect-video relative flex items-center justify-center">
            {!isConnected && !lastFrame ? (
              <div className="text-white text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                <p>Aguardando conexão com o dispositivo...</p>
                <p className="text-xs text-white/70 mt-1">Certifique-se que o player está rodando.</p>
              </div>
            ) : (
              <canvas 
                ref={canvasRef} 
                width={640} 
                height={480} 
                className="w-full h-full object-contain"
              />
            )}
            
            {isConnected && (
                <div className="absolute top-2 right-2">
                    <Badge variant="default" className="bg-green-500 animate-pulse">AO VIVO</Badge>
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
                    <span className="text-2xl font-bold">{lastFrame?.stats.length || 0}</span>
                </div>
                
                <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Emoções Atuais</p>
                    {lastFrame?.stats.map((face, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                            <span className="capitalize">{face.emotion.emotion}</span>
                            <Badge variant="outline">{Math.round(face.emotion.confidence * 100)}%</Badge>
                        </div>
                    ))}
                    {(!lastFrame?.stats || lastFrame.stats.length === 0) && (
                        <p className="text-sm text-muted-foreground italic">Nenhuma face detectada</p>
                    )}
                </div>

                <div className="space-y-2 pt-2 border-t">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Demografia</p>
                     {lastFrame?.stats.map((face, idx) => (
                        <div key={idx} className="text-sm">
                            <span className="font-medium">Pessoa {idx + 1}:</span> {face.gender}, {face.ageGroup}
                        </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Activity className="w-3 h-3" />
                <span>Atualizado: {lastFrame?.timestamp ? new Date(lastFrame.timestamp).toLocaleTimeString() : '-'}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
