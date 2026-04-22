import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DetectedFace } from "./usePlayerFaceDetection";

/**
 * Aggregates real-time face detection metrics from the player and broadcasts
 * compact audience snapshots over Supabase Realtime broadcast channels.
 *
 * Adaptive cadence:
 *  - 5s when faces are present (responsive "live" feel)
 *  - 30s when no audience (low-bandwidth idle)
 *
 * Designed for low overhead: broadcast does NOT touch the database.
 * The persistence path (device_detection_logs) is already handled by
 * `usePlayerFaceDetection`. This hook is the realtime push layer.
 */

export interface AudienceSnapshot {
  deviceCode: string;
  timestamp: string; // ISO
  metrics: {
    people: number;
    avgAge: number;
    genderDistribution: { male: number; female: number; unknown: number };
    dominantEmotion: string;
    emotionDistribution: Record<string, number>;
    avgAttentionMs: number;
    maxAttentionMs: number;
  };
  media: {
    contentId: string | null;
    contentName: string | null;
    playlistId: string | null;
  };
  // Buffered/offline replay support
  replayed?: boolean;
}

interface CurrentContent {
  contentId: string;
  contentName: string;
  playlistId: string;
}

const TICK_MS = 1_000;
const ACTIVE_INTERVAL_MS = 5_000;
const IDLE_INTERVAL_MS = 30_000;
const BUFFER_KEY_PREFIX = "audience_buffer_";
const MAX_BUFFER = 200;

const AUDIENCE_TOPIC = "audience:live";

const buildSnapshot = (
  deviceCode: string,
  faces: DetectedFace[],
  content: CurrentContent | null,
): AudienceSnapshot => {
  const people = faces.length;

  let male = 0;
  let female = 0;
  let unknown = 0;
  const emotions: Record<string, number> = {};
  let ageSum = 0;
  let attentionSum = 0;
  let attentionMax = 0;

  for (const f of faces) {
    if (f.gender === "masculino") male++;
    else if (f.gender === "feminino") female++;
    else unknown++;

    emotions[f.emotion] = (emotions[f.emotion] || 0) + 1;
    ageSum += f.age || 0;
    const ms = (f.attentionDuration || 0) * 1000;
    attentionSum += ms;
    if (ms > attentionMax) attentionMax = ms;
  }

  let dominant = "neutral";
  let dominantCount = -1;
  for (const [emo, c] of Object.entries(emotions)) {
    if (c > dominantCount) {
      dominant = emo;
      dominantCount = c;
    }
  }

  return {
    deviceCode,
    timestamp: new Date().toISOString(),
    metrics: {
      people,
      avgAge: people > 0 ? Math.round(ageSum / people) : 0,
      genderDistribution: { male, female, unknown },
      dominantEmotion: people > 0 ? dominant : "—",
      emotionDistribution: emotions,
      avgAttentionMs: people > 0 ? Math.round(attentionSum / people) : 0,
      maxAttentionMs: Math.round(attentionMax),
    },
    media: {
      contentId: content?.contentId ?? null,
      contentName: content?.contentName ?? null,
      playlistId: content?.playlistId ?? null,
    },
  };
};

const snapshotsAreSimilar = (a: AudienceSnapshot, b: AudienceSnapshot): boolean => {
  if (a.metrics.people !== b.metrics.people) return false;
  if (a.metrics.dominantEmotion !== b.metrics.dominantEmotion) return false;
  if (a.media.contentId !== b.media.contentId) return false;
  if (Math.abs(a.metrics.avgAge - b.metrics.avgAge) > 3) return false;
  return true;
};

export const useAudienceAggregator = (
  deviceCode: string,
  enabled: boolean,
  facesRef: React.RefObject<DetectedFace[]>,
  currentContent: CurrentContent | null,
) => {
  const lastSentRef = useRef<number>(0);
  const lastSnapshotRef = useRef<AudienceSnapshot | null>(null);
  const contentRef = useRef(currentContent);
  const onlineRef = useRef<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    contentRef.current = currentContent;
  }, [currentContent]);

  // Online/offline tracking for buffer flushing
  useEffect(() => {
    const onOnline = () => {
      onlineRef.current = true;
      flushBuffer();
    };
    const onOffline = () => {
      onlineRef.current = false;
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const bufferKey = `${BUFFER_KEY_PREFIX}${deviceCode}`;

  const persistToBuffer = (snap: AudienceSnapshot) => {
    try {
      const raw = localStorage.getItem(bufferKey);
      const list: AudienceSnapshot[] = raw ? JSON.parse(raw) : [];
      list.push(snap);
      // Cap buffer to avoid unbounded growth
      const capped = list.slice(-MAX_BUFFER);
      localStorage.setItem(bufferKey, JSON.stringify(capped));
    } catch (e) {
      console.warn("[Audience] Buffer persist failed", e);
    }
  };

  const flushBuffer = async () => {
    try {
      const raw = localStorage.getItem(bufferKey);
      if (!raw) return;
      const list: AudienceSnapshot[] = JSON.parse(raw);
      if (!list.length) return;

      const channel = supabase.channel(AUDIENCE_TOPIC);
      await channel.subscribe();

      for (const snap of list) {
        await channel.send({
          type: "broadcast",
          event: "snapshot",
          payload: { ...snap, replayed: true },
        });
      }
      localStorage.removeItem(bufferKey);
      // best-effort cleanup
      supabase.removeChannel(channel);
      console.log(`[Audience] Replayed ${list.length} buffered snapshots`);
    } catch (e) {
      console.warn("[Audience] Flush buffer failed", e);
    }
  };

  useEffect(() => {
    if (!enabled || !deviceCode) return;

    let channel: ReturnType<typeof supabase.channel> | null = supabase.channel(
      AUDIENCE_TOPIC,
    );
    let subscribed = false;
    channel.subscribe((status) => {
      subscribed = status === "SUBSCRIBED";
      if (subscribed) {
        // Try to flush any offline-buffered snapshots
        flushBuffer();
      }
    });

    const sendSnapshot = async (snap: AudienceSnapshot) => {
      lastSentRef.current = Date.now();
      lastSnapshotRef.current = snap;

      if (!onlineRef.current) {
        persistToBuffer(snap);
        return;
      }

      try {
        if (!subscribed || !channel) {
          persistToBuffer(snap);
          return;
        }
        await channel.send({
          type: "broadcast",
          event: "snapshot",
          payload: snap,
        });
      } catch (e) {
        console.warn("[Audience] Broadcast failed, buffering", e);
        persistToBuffer(snap);
      }
    };

    const tick = () => {
      const faces = facesRef.current ?? [];
      const now = Date.now();
      const isActive = faces.length > 0;
      const interval = isActive ? ACTIVE_INTERVAL_MS : IDLE_INTERVAL_MS;
      const elapsed = now - lastSentRef.current;

      const snap = buildSnapshot(deviceCode, faces, contentRef.current);

      // Send when:
      //  1) interval window passed, OR
      //  2) significant change vs last snapshot (people count, content, emotion)
      const shouldSendOnChange =
        lastSnapshotRef.current && !snapshotsAreSimilar(lastSnapshotRef.current, snap);

      if (elapsed >= interval || shouldSendOnChange) {
        sendSnapshot(snap);
      }
    };

    const intervalId = setInterval(tick, TICK_MS);
    // Send an immediate empty snapshot so the dashboard knows the device is alive
    sendSnapshot(buildSnapshot(deviceCode, [], contentRef.current));

    return () => {
      clearInterval(intervalId);
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceCode, enabled]);
};
