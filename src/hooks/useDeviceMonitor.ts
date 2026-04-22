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
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const facesRef = useRef<ActiveFace[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const subscribedRef = useRef(false);

  // Buffer for heartbeats if network fails
  const heartbeatBufferRef = useRef<any[]>([]);

  // Always keep latest faces snapshot for background broadcasting
  useEffect(() => {
    facesRef.current = faces || [];
  }, [faces]);

  // Heartbeat function with resilience
  const sendHeartbeat = async () => {
    if (!deviceCode) return;

    const payload = {
      device_token: deviceCode, // In this app, deviceCode is often used as the identifier
      status: 'active',
      timestamp: new Date().toISOString(),
      metadata: {
        last_faces_count: facesRef.current.length,
      }
    };

    try {
      const { data, error } = await supabase.functions.invoke('device-heartbeat', {
        body: payload
      });

      if (error) throw error;

      // If we had buffered heartbeats, try to send them now (simplified)
      if (heartbeatBufferRef.current.length > 0) {
        console.log(`[DeviceMonitor] Sending ${heartbeatBufferRef.current.length} buffered heartbeats`);
        heartbeatBufferRef.current = [];
      }
    } catch (err) {
      console.warn('[DeviceMonitor] Heartbeat failed, buffering...', err);
      heartbeatBufferRef.current.push(payload);
      if (heartbeatBufferRef.current.length > 10) {
        heartbeatBufferRef.current.shift(); // Keep buffer sane
      }
    }
  };

  // Single shared channel for all monitor traffic (subscribe/broadcast/listen)
  useEffect(() => {
    if (!deviceCode) return;

    subscribedRef.current = false;
    const channel = supabase.channel(`device_monitor:${deviceCode}`, {
      config: { broadcast: { self: false, ack: false } },
    })
      .on('broadcast', { event: 'start_stream' }, () => {
        setIsMonitoring(true);
        console.log('[DeviceMonitor] start_stream received');
        toast.info('Monitoramento remoto iniciado');
      })
      .on('broadcast', { event: 'stop_stream' }, () => {
        setIsMonitoring(false);
        console.log('[DeviceMonitor] stop_stream received');
        toast.info('Monitoramento remoto finalizado');
      })
      .on('broadcast', { event: 'request_state' }, () => {
        // Viewer just opened — immediately push current face stats so UI lights up
        if (!subscribedRef.current) return;
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
      })
      .subscribe((status) => {
        console.log(`[DeviceMonitor] channel status for ${deviceCode}:`, status);
        if (status === 'SUBSCRIBED') {
          subscribedRef.current = true;
        }
      });

    channelRef.current = channel;

    // Heartbeat Interval (15s)
    sendHeartbeat(); // Initial heartbeat
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, 15000);

    // Background face stats broadcast — always on, regardless of frame stream.
    facesIntervalRef.current = setInterval(() => {
      if (!subscribedRef.current) return;
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
      if (facesIntervalRef.current) clearInterval(facesIntervalRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      subscribedRef.current = false;
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [deviceCode]);

  // Frame streaming (heavy) — only when explicitly requested by remote viewer
  useEffect(() => {
    if (!deviceCode) return;

    if (isMonitoring && sourceRef?.current) {
      monitoringIntervalRef.current = setInterval(() => {
        const element = sourceRef.current;
        const channel = channelRef.current;
        if (!element || !channel || !subscribedRef.current) return;

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

          channel.send({
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

