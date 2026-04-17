import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ActiveFace } from "./useFaceDetection";

export type FaceRecognitionStatus =
  | "executando" // câmera ativa + faces sendo detectadas
  | "online"     // câmera ativa, sem detecção no momento
  | "offline"    // sem câmera / sem comunicação
  | "pendente";  // inicializando / aguardando permissão

interface Options {
  deviceCode: string;
  cameraStream: MediaStream | null;
  cameraError?: boolean;
  modelsReady: boolean;
  activeFaces: ActiveFace[];
  /** Janela em ms para considerar "executando" após última detecção */
  detectionWindowMs?: number;
  /** Intervalo de heartbeat para o backend */
  heartbeatMs?: number;
}

/**
 * Hook isolado de monitoramento do reconhecimento facial.
 * - NÃO interfere no player nem na detecção em si.
 * - Apenas observa o estado e envia heartbeat leve para a tabela `devices`
 *   (campo metadata.face_recognition) + canal realtime.
 */
export function useFaceRecognitionStatus({
  deviceCode,
  cameraStream,
  cameraError = false,
  modelsReady,
  activeFaces,
  detectionWindowMs = 4000,
  heartbeatMs = 8000,
}: Options): { status: FaceRecognitionStatus; lastDetectionAt: number | null } {
  const [status, setStatus] = useState<FaceRecognitionStatus>("pendente");
  const lastDetectionAtRef = useRef<number | null>(null);
  const lastSentStatusRef = useRef<FaceRecognitionStatus | null>(null);

  // Marca a última vez que vimos faces
  useEffect(() => {
    if (activeFaces.length > 0) {
      lastDetectionAtRef.current = Date.now();
    }
  }, [activeFaces.length]);

  // Recalcula status periodicamente (leve — apenas timer + setState)
  useEffect(() => {
    const compute = (): FaceRecognitionStatus => {
      if (cameraError) return "offline";
      if (!cameraStream || !modelsReady) return "pendente";

      const tracks = cameraStream.getVideoTracks();
      const hasLiveTrack = tracks.some((t) => t.readyState === "live" && t.enabled);
      if (!hasLiveTrack) return "offline";

      const last = lastDetectionAtRef.current;
      if (last && Date.now() - last <= detectionWindowMs) return "executando";
      return "online";
    };

    const tick = () => setStatus(compute());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [cameraStream, cameraError, modelsReady, detectionWindowMs]);

  // Heartbeat para o backend — só envia quando muda OU a cada heartbeatMs
  useEffect(() => {
    if (!deviceCode) return;

    let cancelled = false;

    const send = async (force = false) => {
      if (cancelled) return;
      if (!force && lastSentStatusRef.current === status) return;
      lastSentStatusRef.current = status;

      try {
        // Atualiza metadata.face_recognition no device (merge JSON)
        const { data: current } = await supabase
          .from("devices")
          .select("metadata")
          .eq("device_code", deviceCode)
          .maybeSingle();

        const prevMeta = (current?.metadata as Record<string, unknown> | null) || {};
        const newMeta = {
          ...prevMeta,
          face_recognition: {
            status,
            updated_at: new Date().toISOString(),
            faces_count: activeFaces.length,
          },
        };

        await supabase
          .from("devices")
          .update({ metadata: newMeta })
          .eq("device_code", deviceCode);

        // Broadcast em tempo real (canal leve, separado do device_monitor)
        await supabase.channel(`face_status:${deviceCode}`).send({
          type: "broadcast",
          event: "status",
          payload: {
            status,
            faces_count: activeFaces.length,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (err) {
        console.warn("[FaceRecognitionStatus] heartbeat failed:", err);
      }
    };

    // Envia imediatamente quando status muda
    send(false);

    // Heartbeat periódico (forçado) para manter "vivo" mesmo sem mudanças
    const id = setInterval(() => send(true), heartbeatMs);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [deviceCode, status, heartbeatMs, activeFaces.length]);

  return { status, lastDetectionAt: lastDetectionAtRef.current };
}
