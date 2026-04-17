import { useRef, useEffect, useState, type RefObject } from 'react';
import type { ActiveFace } from './useFaceDetection';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type SourceElement = HTMLVideoElement | HTMLImageElement;

export const useDeviceMonitor = (
  deviceCode: string,
  sourceRef?: RefObject<SourceElement | null>,
  faces?: ActiveFace[],
) => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const monitoringIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const facesIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const facesRef = useRef<ActiveFace[]>([]);

  // Always keep latest faces snapshot for background broadcasting
  useEffect(() => {
    facesRef.current = faces || [];
  }, [faces]);

  // Listen for remote start/stop stream commands (frame video feed)
  useEffect(() => {
    if (!deviceCode) return;

    const channel = supabase.channel(`device_monitor:${deviceCode}`)
      .on('broadcast', { event: 'start_stream' }, () => {
        setIsMonitoring(true);
        toast.info("Monitoramento remoto iniciado");
      })
      .on('broadcast', { event: 'stop_stream' }, () => {
        setIsMonitoring(false);
        toast.info("Monitoramento remoto finalizado");
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [deviceCode]);

  // Background face stats broadcast — always on, regardless of frame stream.
  // This feeds the DemoFace (/admin/monitoring) page in real time.
  useEffect(() => {
    if (!deviceCode) return;

    const channel = supabase.channel(`device_monitor:${deviceCode}`);
    facesIntervalRef.current = setInterval(() => {
      const stats = facesRef.current;
      channel.send({
        type: 'broadcast',
        event: 'faces',
        payload: {
          stats,
          count: stats.length,
          timestamp: new Date().toISOString(),
        },
      });
    }, 1000);

    return () => {
      if (facesIntervalRef.current) {
        clearInterval(facesIntervalRef.current);
        facesIntervalRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [deviceCode]);

  // Frame streaming (heavy) — only when explicitly requested by remote viewer
  useEffect(() => {
    if (!deviceCode) return;

    if (isMonitoring && sourceRef?.current) {
      monitoringIntervalRef.current = setInterval(() => {
        const element = sourceRef.current;
        if (!element) return;

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return;

        let sourceWidth = 0;
        let sourceHeight = 0;

        if (element instanceof HTMLVideoElement) {
          if (element.readyState < 2) return;
          sourceWidth = element.videoWidth || element.clientWidth;
          sourceHeight = element.videoHeight || element.clientHeight;
        } else if (element instanceof HTMLImageElement) {
          if (!element.complete) return;
          sourceWidth = element.naturalWidth || element.width;
          sourceHeight = element.naturalHeight || element.height;
        }

        if (!sourceWidth || !sourceHeight) return;

        const targetWidth = 320;
        const aspectRatio = sourceWidth / sourceHeight;
        const targetHeight = Math.round(targetWidth / aspectRatio);

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        try {
          context.drawImage(element, 0, 0, canvas.width, canvas.height);
          const imageData = canvas.toDataURL('image/jpeg', 0.6);

          supabase.channel(`device_monitor:${deviceCode}`).send({
            type: 'broadcast',
            event: 'frame',
            payload: {
              image: imageData,
              stats: facesRef.current,
              timestamp: new Date().toISOString(),
              meta: { width: sourceWidth, height: sourceHeight },
            },
          });
        } catch (error) {
          console.error('Erro ao capturar frame de tela:', error);
        }
      }, 500);
    } else {
      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current);
        monitoringIntervalRef.current = null;
      }
    }

    return () => {
      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current);
        monitoringIntervalRef.current = null;
      }
    };
  }, [isMonitoring, deviceCode, sourceRef]);

  return { isMonitoring };
};
