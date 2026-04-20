import { useEffect } from "react";
import type { AudienceSession } from "./types";
import * as faceapi from "face-api.js";

const EMOTION_LABEL: Record<string, string> = {
  neutral: "Neutro",
  happy: "Feliz",
  sad: "Triste",
  angry: "Bravo",
  fearful: "Medo",
  disgusted: "Nojo",
  surprised: "Surpreso",
};

interface Props {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  sessions: AudienceSession[];
}

export const FaceDetectionOverlay = ({ videoRef, canvasRef, sessions }: Props) => {
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    sessions.forEach((s) => {
      if (!s.box) return;
      const { x, y, width, height } = s.box;
      
      const isLooking = s.isLooking;
      const color = isLooking ? "hsl(142 76% 45%)" : "hsl(0 0% 63%)";
      const id = s.personId.split('_').pop();

      ctx.lineWidth = 2;
      ctx.setLineDash(isLooking ? [] : [5, 5]);
      ctx.strokeStyle = color;
      ctx.strokeRect(x, y, width, height);
      ctx.setLineDash([]); // Reset dash

      const label = `${id} · ${s.gender === "male" ? "M" : "F"} · ${s.age}a · ${
        isLooking ? "Olhando" : "Desatento"
      }`;
      
      ctx.font = "600 14px Inter, system-ui, sans-serif";
      const padding = 6;
      const textW = ctx.measureText(label).width + padding * 2;
      const textH = 22;
      
      ctx.fillStyle = color;
      ctx.fillRect(x, Math.max(0, y - textH), textW, textH);
      
      ctx.fillStyle = "white";
      ctx.fillText(label, x + padding, Math.max(textH - 6, y - 6));
      
      if (s.durationMs > 0) {
        const timeLabel = `${(s.durationMs/1000).toFixed(1)}s`;
        ctx.fillStyle = "black";
        ctx.fillText(timeLabel, x + width - ctx.measureText(timeLabel).width - 4, y + height - 4);
      }
    });
  }, [sessions, videoRef, canvasRef]);

  return null;
};

