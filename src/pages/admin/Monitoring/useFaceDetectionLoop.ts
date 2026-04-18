import { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import { ensureBackendReady, isBackendReady, isFaceApiBackendError } from "@/lib/faceApiBackend";
import type { DetectedFace, Emotion, Gender } from "./types";

interface Options {
  videoRef: React.RefObject<HTMLVideoElement>;
  enabled: boolean;
  intervalMs?: number;
}

export const useFaceDetectionLoop = ({
  videoRef,
  enabled,
  intervalMs = 200,
}: Options) => {
  const [faces, setFaces] = useState<DetectedFace[]>([]);
  const runningRef = useRef(false);
  const visibleRef = useRef(!document.hidden);

  useEffect(() => {
    const onVis = () => {
      visibleRef.current = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setFaces([]);
      return;
    }
    runningRef.current = true;
    let timer: number | null = null;

    const tick = async () => {
      if (!runningRef.current) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !visibleRef.current) {
        timer = window.setTimeout(tick, intervalMs);
        return;
      }

      try {
        if (!isBackendReady()) {
          const ok = await ensureBackendReady();
          if (!ok) {
            timer = window.setTimeout(tick, intervalMs);
            return;
          }
        }

        const results = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
          .withFaceLandmarks()
          .withFaceExpressions()
          .withAgeAndGender();

        const mapped: DetectedFace[] = results.map((r, idx) => {
          const expr = r.expressions as unknown as Record<Emotion, number>;
          const top = (Object.entries(expr) as [Emotion, number][]).reduce(
            (a, b) => (b[1] > a[1] ? b : a),
            ["neutral", 0] as [Emotion, number]
          );
          return {
            id: idx,
            box: r.detection.box,
            age: Math.round(r.age),
            gender: r.gender as Gender,
            genderProbability: r.genderProbability,
            emotion: top[0],
            emotionConfidence: top[1],
          };
        });

        if (runningRef.current) setFaces(mapped);
      } catch (err) {
        console.warn("[Monitoring] detection error", err);
        if (isFaceApiBackendError(err)) {
          await ensureBackendReady();
        }
      } finally {
        if (runningRef.current) timer = window.setTimeout(tick, intervalMs);
      }
    };

    tick();

    return () => {
      runningRef.current = false;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, videoRef, intervalMs]);

  return faces;
};
