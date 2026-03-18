
import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useOfflinePlayer } from "@/hooks/useOfflinePlayer";
import { useDeviceSession } from "@/hooks/useDeviceSession";
import { Loader2, Monitor, AlertTriangle } from "lucide-react";
import { pushHandlerService } from "@/modules/push-handler";
import { kioskService } from "@/modules/kiosk-controller";
import { ActiveSessionScreen } from "@/components/player-core";

const PlayerDevice = () => {
  const [searchParams] = useSearchParams();
  const deviceId = searchParams.get("id");
  const deviceSession = useDeviceSession(deviceId);

  // Initialize Services (Push & Kiosk)
  useEffect(() => {
    if (deviceId) {
      pushHandlerService.init(deviceId);
      kioskService.enableKioskMode();

      return () => {
        pushHandlerService.cleanup();
        kioskService.disableKioskMode();
      };
    }
  }, [deviceId]);

  const {
    deviceState,
    isLoading,
    syncError,
    getActiveItems,
    syncWithServer,
  } = useOfflinePlayer(deviceId || "");

  const items = getActiveItems();

  const hasActiveOverrideMedia = (() => {
    if (!deviceState?.override_media) return false;
    const expiresAt = new Date(deviceState.override_media.expires_at);
    return expiresAt > new Date();
  })();

  const overrideMedia = hasActiveOverrideMedia ? deviceState.override_media : null;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // --- CONTENT ROTATION LOGIC ---
  const currentItem = items[currentIndex];
  // Priority: Override Media > Current Playlist Item
  const currentMedia = overrideMedia || currentItem?.media;
  const duration =
    overrideMedia?.duration ??
    currentItem?.duration_override ??
    currentItem?.media.duration ??
    10;

  useEffect(() => {
    if (!currentMedia) return;

    // Reset progress
    setProgress(0);

    const startTime = Date.now();
    const durationMs = duration * 1000;

    // Progress Interval
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min((elapsed / durationMs) * 100, 100);
      setProgress(pct);
    }, 100);

    // Next Item Timeout
    const nextTimeout = setTimeout(() => {
      if (items.length > 1 && !overrideMedia) {
        setCurrentIndex((prev) => (prev + 1) % items.length);
      }
    }, durationMs);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(nextTimeout);
    };
  }, [currentMedia, items.length, duration, overrideMedia, currentIndex]);

  // Video Autoplay
  useEffect(() => {
    if (currentMedia?.type === 'video' && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(e => console.error("Video play failed:", e));
    }
  }, [currentMedia]);

  // --- RENDER STATES ---

  // 1. Missing ID
  if (!deviceId) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
        <AlertTriangle className="w-16 h-16 text-yellow-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">ID do Dispositivo Não Fornecido</h1>
        <p className="text-white/60">Adicione ?id=SEU_CODIGO na URL.</p>
      </div>
    );
  }

  // 1.5 Session availability check
  if (deviceSession.status === "loading") {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
        <Loader2 className="w-12 h-12 animate-spin text-purple-500 mb-4" />
        <p className="text-white/60">Verificando disponibilidade...</p>
      </div>
    );
  }
  if (deviceSession.status === "blocked") {
    return <ActiveSessionScreen deviceName={deviceSession.deviceName} message={deviceSession.errorMessage} />;
  }

  // 2. Loading
  if (isLoading && !deviceState) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
        <Loader2 className="w-12 h-12 animate-spin text-purple-500 mb-4" />
        <p className="text-white/60">Carregando Player...</p>
        <p className="text-xs text-white/30 font-mono mt-2">{deviceId}</p>
      </div>
    );
  }

  // 3. No Content / Waiting
  if (!currentMedia) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8 text-center">
        <Monitor className="w-20 h-20 text-white/20 mb-6" />
        <h1 className="text-3xl font-bold mb-2">Aguardando Conteúdo</h1>
        <p className="text-xl text-white/60 mb-8">{deviceState?.device_name || "Dispositivo"}</p>
        
        <div className="flex flex-col gap-2 items-center">
            <p className="text-sm text-white/40 font-mono">ID: {deviceId}</p>
            <p className="text-sm text-white/40">Status: {deviceState ? "Conectado" : "Desconectado"}</p>
            {syncError && (
                <div className="mt-4 p-3 bg-red-900/20 border border-red-900/50 rounded text-red-300 text-xs max-w-md">
                    {syncError}
                </div>
            )}
            <button 
                onClick={syncWithServer}
                className="mt-6 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full text-sm font-medium transition-colors"
            >
                Forçar Sincronização
            </button>
        </div>
      </div>
    );
  }

  // 4. Player
  const mediaUrl = currentMedia.blob_url || currentMedia.file_url;

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* Media Layer */}
      {currentMedia.type === 'video' ? (
        <video
          ref={videoRef}
          src={mediaUrl}
          className="w-full h-full object-cover"
          muted
          playsInline
          autoPlay
        />
      ) : (
        <img
          src={mediaUrl}
          alt={currentMedia.name}
          className="w-full h-full object-cover"
        />
      )}

      {/* Progress Bar (Debug/Visual Feedback) */}
      <div className="absolute bottom-0 left-0 w-full h-1 bg-white/10 z-50">
        <div 
            className="h-full bg-purple-500 transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export default PlayerDevice;
