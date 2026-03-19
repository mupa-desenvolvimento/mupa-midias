import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const HEARTBEAT_INTERVAL_MS = 20_000; // 20 seconds
const SESSION_STORAGE_KEY = "device_session_";

interface DeviceSessionState {
  status: "loading" | "claimed" | "blocked" | "error";
  sessionId: string | null;
  deviceName: string | null;
  errorMessage: string | null;
}

export function useDeviceSession(deviceCode: string | null | undefined) {
  const [state, setState] = useState<DeviceSessionState>({
    status: "loading",
    sessionId: null,
    deviceName: null,
    errorMessage: null,
  });

  const heartbeatRef = useRef<ReturnType<typeof setInterval>>();
  const sessionIdRef = useRef<string | null>(null);
  const claimedRef = useRef(false);

  const callSessionApi = useCallback(
    async (action: string, sessionId?: string | null) => {
      const { data, error } = await supabase.functions.invoke("device-session", {
        body: { action, device_code: deviceCode, session_id: sessionId },
      });
      if (error) throw error;
      return data;
    },
    [deviceCode]
  );

  // Claim session on mount
  useEffect(() => {
    if (!deviceCode) return;

    let cancelled = false;

    const claim = async () => {
      try {
        // Try to reuse existing session from sessionStorage
        const storedSession = sessionStorage.getItem(SESSION_STORAGE_KEY + deviceCode);
        const result = await callSessionApi("claim", storedSession);

        if (cancelled) return;

        if (result.blocked) {
          setState({
            status: "blocked",
            sessionId: null,
            deviceName: result.device_name,
            errorMessage: result.message,
          });
          return;
        }

        if (result.success) {
          sessionIdRef.current = result.session_id;
          claimedRef.current = true;
          sessionStorage.setItem(SESSION_STORAGE_KEY + deviceCode, result.session_id);

          setState({
            status: "claimed",
            sessionId: result.session_id,
            deviceName: result.device_name,
            errorMessage: null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            sessionId: null,
            deviceName: null,
            errorMessage: (err as Error).message,
          });
        }
      }
    };

    claim();

    return () => {
      cancelled = true;
    };
  }, [deviceCode, callSessionApi]);

  // Heartbeat
  useEffect(() => {
    if (state.status !== "claimed" || !sessionIdRef.current) return;

    heartbeatRef.current = setInterval(async () => {
      try {
        const result = await callSessionApi("heartbeat", sessionIdRef.current);
        if (result.blocked) {
          setState((prev) => ({
            ...prev,
            status: "blocked",
            errorMessage: result.message || "Sessão expirada",
          }));
        }
      } catch {
        // Silently ignore heartbeat errors
      }
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [state.status, callSessionApi]);

  // Release on page close only (NOT on React re-render/reload)
  useEffect(() => {
    if (!deviceCode) return;

    const releaseOnClose = () => {
      if (claimedRef.current && sessionIdRef.current) {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/device-session`;
        const payload = JSON.stringify({
          action: "release",
          device_code: deviceCode,
          session_id: sessionIdRef.current,
        });
        // Use Blob to set correct Content-Type for edge function
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon(url, blob);
        // Keep sessionStorage so a quick re-open can reclaim
        claimedRef.current = false;
      }
    };

    window.addEventListener("beforeunload", releaseOnClose);

    return () => {
      window.removeEventListener("beforeunload", releaseOnClose);
      // Do NOT release on React unmount/re-render — only on actual page close
      // This prevents the "device in use" error on reload
    };
  }, [deviceCode]);

  return state;
}
