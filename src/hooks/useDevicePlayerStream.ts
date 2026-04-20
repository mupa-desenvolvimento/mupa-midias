import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserTenant } from "./useUserTenant";

export type PlayerEventType = "detection" | "play" | "status" | "impression";

export interface PlayerEvent {
  id: string;
  type: PlayerEventType;
  device_id?: string | null;
  device_code?: string | null;
  device_name?: string | null;
  timestamp: string;
  // detection
  emotion?: string | null;
  gender?: string | null;
  age?: number | null;
  age_group?: string | null;
  attention_duration?: number | null;
  // play
  media_id?: string | null;
  duration?: number | null;
  // status
  old_status?: string | null;
  new_status?: string | null;
  // content
  content_id?: string | null;
  content_name?: string | null;
}

interface StreamCounters {
  detectionsLast5m: number;
  playsLast5m: number;
  statusChangesLast5m: number;
  impressionsLast5m: number;
}

const MAX_EVENTS = 50;

/**
 * Subscribes to live events from /play devices via Supabase Realtime
 * scoped to the current tenant. Returns recent events plus rolling counters.
 */
export const useDevicePlayerStream = () => {
  const { tenantId, isSuperAdmin } = useUserTenant();
  const [events, setEvents] = useState<PlayerEvent[]>([]);
  const [counters, setCounters] = useState<StreamCounters>({
    detectionsLast5m: 0,
    playsLast5m: 0,
    statusChangesLast5m: 0,
    impressionsLast5m: 0,
  });
  const [isConnected, setIsConnected] = useState(false);
  const deviceMapRef = useRef<Map<string, { code: string; name: string }>>(new Map());

  // Preload device id -> name/code map for the tenant
  const loadDeviceMap = useCallback(async () => {
    let q = supabase.from("devices").select("id, device_code, name");
    const { data } = await q;
    if (data) {
      const map = new Map<string, { code: string; name: string }>();
      data.forEach((d) => map.set(d.id, { code: d.device_code, name: d.name }));
      deviceMapRef.current = map;
    }
  }, []);

  const enrichDevice = useCallback((deviceId?: string | null) => {
    if (!deviceId) return { device_code: null, device_name: null };
    const info = deviceMapRef.current.get(deviceId);
    return {
      device_code: info?.code ?? null,
      device_name: info?.name ?? deviceId.slice(0, 8),
    };
  }, []);

  const pushEvent = useCallback((evt: PlayerEvent) => {
    setEvents((prev) => [evt, ...prev].slice(0, MAX_EVENTS));
  }, []);

  // Refresh counters every 30s based on the last 5 minutes from DB
  const refreshCounters = useCallback(async () => {
    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const [detections, plays, statuses, impressions] = await Promise.all([
      supabase
        .from("device_detection_logs")
        .select("id", { count: "exact", head: true })
        .gte("detected_at", since),
      supabase
        .from("media_play_logs")
        .select("id", { count: "exact", head: true })
        .gte("played_at", since),
      supabase
        .from("device_status_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since),
      supabase
        .from("impression_logs")
        .select("id", { count: "exact", head: true })
        .gte("played_at", since),
    ]);
    setCounters({
      detectionsLast5m: detections.count ?? 0,
      playsLast5m: plays.count ?? 0,
      statusChangesLast5m: statuses.count ?? 0,
      impressionsLast5m: impressions.count ?? 0,
    });
  }, []);

  useEffect(() => {
    loadDeviceMap();
    refreshCounters();
    const interval = setInterval(refreshCounters, 30000);
    return () => clearInterval(interval);
  }, [loadDeviceMap, refreshCounters]);

  useEffect(() => {
    const channel = supabase
      .channel("dashboard:player-events")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "device_detection_logs" },
        (payload) => {
          const row: any = payload.new;
          const dev = enrichDevice(row.device_id);
          pushEvent({
            id: `det-${row.id}`,
            type: "detection",
            device_id: row.device_id,
            device_code: row.device_serial ?? dev.device_code,
            device_name: row.device_nickname ?? dev.device_name,
            timestamp: row.detected_at ?? row.created_at,
            emotion: row.emotion,
            gender: row.gender,
            age: row.age,
            age_group: row.age_group,
            attention_duration: row.attention_duration,
            content_id: row.content_id,
            content_name: row.content_name,
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "media_play_logs" },
        (payload) => {
          const row: any = payload.new;
          const dev = enrichDevice(row.device_id);
          pushEvent({
            id: `play-${row.id}`,
            type: "play",
            device_id: row.device_id,
            device_code: dev.device_code,
            device_name: dev.device_name,
            timestamp: row.played_at ?? row.created_at,
            media_id: row.media_id,
            duration: row.duration,
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "device_status_logs" },
        (payload) => {
          const row: any = payload.new;
          pushEvent({
            id: `st-${row.id}`,
            type: "status",
            device_id: row.device_id,
            device_code: row.device_code,
            device_name: row.device_name,
            timestamp: row.created_at,
            old_status: row.old_status,
            new_status: row.new_status,
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "impression_logs" },
        (payload) => {
          const row: any = payload.new;
          const dev = enrichDevice(row.device_id);
          pushEvent({
            id: `imp-${row.id}`,
            type: "impression",
            device_id: row.device_id,
            device_code: dev.device_code,
            device_name: dev.device_name,
            timestamp: row.played_at ?? row.created_at,
            content_id: row.content_id,
            duration: row.duration,
          });
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enrichDevice, pushEvent, tenantId, isSuperAdmin]);

  return { events, counters, isConnected };
};
