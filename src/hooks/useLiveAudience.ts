import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AudienceSnapshot } from "./useAudienceAggregator";

const AUDIENCE_TOPIC = "audience:live";
const STALE_MS = 60_000; // device is considered offline after 60s without snapshot

export interface LiveAudienceAggregate {
  totalPeople: number;
  avgAge: number;
  dominantEmotion: string;
  topGender: "male" | "female" | "unknown";
  emotionDistribution: Record<string, number>;
  genderDistribution: { male: number; female: number; unknown: number };
  activeDevices: number;
}

/**
 * Subscribes to the live audience broadcast channel and exposes a per-device
 * map of the latest snapshot, plus aggregated KPIs across all devices.
 */
export const useLiveAudience = () => {
  const [snapshots, setSnapshots] = useState<Map<string, AudienceSnapshot>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const lastEventAtRef = useRef<number>(Date.now());

  useEffect(() => {
    const channel = supabase
      .channel(AUDIENCE_TOPIC)
      .on("broadcast", { event: "snapshot" }, (payload) => {
        const snap = payload.payload as AudienceSnapshot;
        if (!snap?.deviceCode) return;
        lastEventAtRef.current = Date.now();
        setSnapshots((prev) => {
          const next = new Map(prev);
          next.set(snap.deviceCode, snap);
          return next;
        });
      })
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    // Periodically prune stale device entries so KPIs reflect "right now"
    const pruneInterval = setInterval(() => {
      const cutoff = Date.now() - STALE_MS;
      setSnapshots((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [code, snap] of next) {
          if (new Date(snap.timestamp).getTime() < cutoff) {
            next.delete(code);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 5_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pruneInterval);
    };
  }, []);

  const aggregate = useMemo<LiveAudienceAggregate>(() => {
    let totalPeople = 0;
    let ageSum = 0;
    let ageCount = 0;
    const emotions: Record<string, number> = {};
    const genders = { male: 0, female: 0, unknown: 0 };
    let activeDevices = 0;

    for (const snap of snapshots.values()) {
      const m = snap.metrics;
      totalPeople += m.people;
      if (m.people > 0) {
        activeDevices++;
        ageSum += m.avgAge * m.people;
        ageCount += m.people;
      }
      genders.male += m.genderDistribution.male;
      genders.female += m.genderDistribution.female;
      genders.unknown += m.genderDistribution.unknown;
      for (const [emo, c] of Object.entries(m.emotionDistribution)) {
        emotions[emo] = (emotions[emo] || 0) + c;
      }
    }

    let dominant = "—";
    let dominantCount = 0;
    for (const [emo, c] of Object.entries(emotions)) {
      if (c > dominantCount) {
        dominant = emo;
        dominantCount = c;
      }
    }

    let topGender: "male" | "female" | "unknown" = "unknown";
    if (genders.male >= genders.female && genders.male >= genders.unknown) topGender = "male";
    else if (genders.female >= genders.male && genders.female >= genders.unknown) topGender = "female";

    return {
      totalPeople,
      avgAge: ageCount > 0 ? Math.round(ageSum / ageCount) : 0,
      dominantEmotion: dominant,
      topGender,
      emotionDistribution: emotions,
      genderDistribution: genders,
      activeDevices,
    };
  }, [snapshots]);

  const devices = useMemo(
    () =>
      Array.from(snapshots.values()).sort(
        (a, b) => b.metrics.people - a.metrics.people,
      ),
    [snapshots],
  );

  return { aggregate, devices, isConnected };
};
