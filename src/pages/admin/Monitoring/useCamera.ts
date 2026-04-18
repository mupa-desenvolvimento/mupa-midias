import { useCallback, useEffect, useRef, useState } from "react";
import type { CameraStatus } from "./types";

export const useCamera = (videoRef: React.RefObject<HTMLVideoElement>) => {
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>();
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [videoRef]);

  const start = useCallback(
    async (id?: string) => {
      try {
        setStatus("requesting-camera");
        stop();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: id
            ? { deviceId: { exact: id }, width: 1280, height: 720 }
            : { facingMode: "user", width: 1280, height: 720 },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        // Enumerate after permission granted (labels populate)
        const list = await navigator.mediaDevices.enumerateDevices();
        setDevices(list.filter((d) => d.kind === "videoinput"));

        const activeId = stream.getVideoTracks()[0]?.getSettings().deviceId;
        if (activeId) setDeviceId(activeId);
        setStatus("active");
      } catch (err: any) {
        console.error("[Monitoring] camera error", err);
        if (err?.name === "NotAllowedError") setStatus("denied");
        else if (err?.name === "NotFoundError") setStatus("no-camera");
        else setStatus("error");
      }
    },
    [stop, videoRef]
  );

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { status, devices, deviceId, start, stop, setDeviceId };
};
