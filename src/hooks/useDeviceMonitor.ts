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
              stats: faces || [],
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
  }, [isMonitoring, deviceCode, sourceRef, faces]);

  return { isMonitoring };
};
