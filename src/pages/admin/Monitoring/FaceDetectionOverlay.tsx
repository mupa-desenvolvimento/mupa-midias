import { useEffect } from "react";
import type { DetectedFace } from "./types";

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
  faces: DetectedFace[];
}

export const FaceDetectionOverlay = ({ videoRef, canvasRef, faces }: Props) => {
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

    faces.forEach((f) => {
      const { x, y, width, height } = f.box;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "hsl(160 84% 50%)";
      ctx.strokeRect(x, y, width, height);

      const label = `${f.gender === "male" ? "M" : "F"} · ${f.age}a · ${
        EMOTION_LABEL[f.emotion] ?? f.emotion
      }`;
      ctx.font = "600 18px system-ui, sans-serif";
      const padding = 6;
      const textW = ctx.measureText(label).width + padding * 2;
      const textH = 26;
      ctx.fillStyle = "hsl(160 84% 35% / 0.9)";
      ctx.fillRect(x, Math.max(0, y - textH), textW, textH);
      ctx.fillStyle = "white";
      ctx.fillText(label, x + padding, Math.max(textH - 8, y - 8));
    });
  }, [faces, videoRef, canvasRef]);

  return null;
};
