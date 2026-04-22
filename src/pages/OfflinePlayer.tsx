import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";

import { useOfflinePlayer } from "@/hooks/useOfflinePlayer";
import { useProductLookup } from "@/hooks/useProductLookup";
import { useProductTTS } from "@/hooks/useProductTTS";
import { useProductDisplaySettingsBySlug } from "@/hooks/useProductDisplaySettings";
import { ProductLookupContainer } from "@/components/player/ProductLookupContainer";
import { EanInput } from "@/components/player/EanInput";
import { useDeviceMonitor } from "@/hooks/useDeviceMonitor";
import { useFaceDetection } from "@/hooks/useFaceDetection";
import { useTerminalMetrics } from "@/hooks/useTerminalMetrics";
import { useTerminalAI } from "@/hooks/useTerminalAI";
import { usePeopleCounter } from "@/hooks/usePeopleCounter";
import { useAudienceAggregator, type AggregatedFace } from "@/hooks/useAudienceAggregator";
import { useAutoHideControls, useFullscreen, useKeyboardShortcuts, useClock, useSeamlessMediaPlayer, type SeamlessMediaItem } from "@/hooks/player";
import {
  MediaRenderer,
  PlayerProgressBar,
  MediaIndicators,
  PlayerControls,
  LoadingScreen,
  BlockedScreen,
  EmptyContentScreen,
  VignetteOverlay,
  FaceRecognitionIndicator,
} from "@/components/player-core";
import { useFaceRecognitionStatus } from "@/hooks/useFaceRecognitionStatus";
import {
  AIAssistantOverlay,
  MetricsOverlay,
  FacialRecognitionOverlay,
  LoyaltyOverlay,
  PeopleCounterOverlay,
  TerminalSettingsOverlay,
  DeviceSimulator,
} from "@/components/smart-terminal";
import type { TerminalMode } from "@/components/smart-terminal";
import type { TerminalTheme } from "@/components/smart-terminal/TerminalSettingsOverlay";
import type { SimulationMode } from "@/components/smart-terminal/DeviceSimulator";
import { AlertCircle, RefreshCw, Video, Image as ImageIcon, Clock, WifiOff, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { storageService } from "@/modules/offline-storage/StorageService";
import { Capacitor } from "@capacitor/core";

const OfflinePlayer = () => {
  const { deviceCode: deviceCodeParam } = useParams<{ deviceCode: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Support both /play/:deviceCode (legacy) and /play?cod_user=X&id_device=Y (new)
  const codUser = searchParams.get("cod_user");
  const idDevice = searchParams.get("id_device");
  const [resolvedDeviceCode, setResolvedDeviceCode] = useState<string>(deviceCodeParam || "");
  const [resolveError, setResolveError] = useState<string | null>(null);

  // Resolve device_code from android_id when using query params
  useEffect(() => {
    if (deviceCodeParam) {
      setResolvedDeviceCode(deviceCodeParam);
      return;
    }
    if (!idDevice) return;

    const resolve = async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data, error } = await supabase
          .from("devices")
          .select("device_code")
          .filter("metadata->>android_id", "eq", idDevice)
          .maybeSingle();

        if (error || !data) {
          console.error("[OfflinePlayer] Erro ao resolver device por android_id:", error);
          setResolveError(`Dispositivo com android_id "${idDevice}" não encontrado.`);
          return;
        }
        setResolvedDeviceCode(data.device_code);
      } catch (e) {
        console.error("[OfflinePlayer] Erro ao resolver device:", e);
        setResolveError("Erro ao buscar dispositivo.");
      }
    };
    resolve();
  }, [deviceCodeParam, idDevice]);

  const deviceCode = resolvedDeviceCode;

  // Core hooks
  const {
    deviceState,
    isLoading: isPlayerLoading,
    isSyncing,
    syncError,
    downloadProgress,
    getActivePlaylist,
    getActiveItems,
    getActiveChannel,
    syncWithServer,
    isPlaylistActiveNow,
    clearAllData,
  } = useOfflinePlayer(deviceCode);

  const isLoading = isPlayerLoading || (!deviceCodeParam && idDevice && !resolvedDeviceCode && !resolveError);

  // Terminal state
  const [terminalMode, setTerminalMode] = useState<TerminalMode>("player");
  const [theme, setTheme] = useState<TerminalTheme>(() => {
    const saved = localStorage.getItem(`terminal_theme_${deviceCode}`);
    return (saved as TerminalTheme) || "supermarket";
  });

  const mediaElementRef = useRef<HTMLVideoElement | HTMLImageElement | null>(null);
  const videoARef = useRef<HTMLVideoElement | null>(null);
  const videoBRef = useRef<HTMLVideoElement | null>(null);
  const imgARef = useRef<HTMLImageElement | null>(null);
  const imgBRef = useRef<HTMLImageElement | null>(null);
  const faceVideoRef = useRef<HTMLVideoElement>(null);
  const faceCanvasRef = useRef<HTMLCanvasElement>(null);

  // Face detection — keep always active in background to broadcast audience data
  // to /admin/monitoring (DemoFace), regardless of terminal mode.
  const { activeFaces, isModelsLoaded: faceModelsReady } = useFaceDetection(
    faceVideoRef,
    faceCanvasRef,
    true,
  );

  // Estado isolado da câmera para o monitor de status (não interfere no player)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState(false);

  const { status: faceStatus } = useFaceRecognitionStatus({
    deviceCode: deviceCode || "",
    cameraStream,
    cameraError,
    modelsReady: faceModelsReady,
    activeFaces,
  });

  useDeviceMonitor(deviceCode || "", mediaElementRef, activeFaces);

  // Metrics
  const { metrics, trackEvent } = useTerminalMetrics(deviceCode || "");

  // AI Assistant
  const {
    messages: aiMessages,
    isLoading: aiLoading,
    sendMessage: aiSend,
    clearHistory: aiClear,
  } = useTerminalAI(deviceCode || "");

  // People counter
  const { count: peopleCount, todayCount, processFaces } = usePeopleCounter();

  // Live audience aggregator → broadcasts compact snapshots to dashboard.
  // Wiring happens after activeMedia/activeItem are declared (see below).
  const audienceFacesRef = useRef<AggregatedFace[]>([]);
  useEffect(() => {
    audienceFacesRef.current = (activeFaces || []).map((f: any) => ({
      gender: f.gender,
      age: f.age,
      emotion: f.emotion?.emotion ?? f.emotion ?? "neutral",
      attentionDurationMs:
        typeof f.lookingDuration === "number"
          ? f.lookingDuration
          : (f.attentionDuration || 0) * 1000,
    }));
  }, [activeFaces]);

  // Player UI hooks
  const { showControls } = useAutoHideControls();
  const { isFullscreen, toggleFullscreen } = useFullscreen();
  const { formattedTime, formattedDate } = useClock();

  // Android: hide status bar, navigation bar, and prevent keyboard from appearing
  useEffect(() => {
    const enterImmersiveMode = async () => {
      // Capacitor native: hide status bar
      if (Capacitor.isNativePlatform()) {
        try {
          const { StatusBar } = await import("@capacitor/status-bar");
          await StatusBar.hide();
        } catch (e) {
          console.warn("[Player] StatusBar hide failed:", e);
        }
      }

      // WebView/Browser: request fullscreen for immersive experience
      try {
        const el = document.documentElement as any;
        if (el.requestFullscreen) {
          await el.requestFullscreen().catch(() => {});
        } else if (el.webkitRequestFullscreen) {
          el.webkitRequestFullscreen();
        }
      } catch (e) {
        console.warn("[Player] Fullscreen request failed:", e);
      }

      // Prevent virtual keyboard: blur any focused input and set inputs to readonly temporarily
      document.querySelectorAll("input, textarea").forEach((el) => {
        (el as HTMLElement).blur();
      });
    };

    enterImmersiveMode();

    // Re-enter immersive mode when app regains focus (Android pulls down status bar)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        enterImmersiveMode();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const [isPortrait, setIsPortrait] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerHeight > window.innerWidth;
  });

  // Playlists
  const activePlaylist = getActivePlaylist();
  const activeChannel = activePlaylist?.has_channels ? getActiveChannel(activePlaylist) : null;
  const items = getActiveItems();
  const contentGroups = useMemo(() => {
    const playlists = deviceState?.playlists ?? [];
    if (playlists.length === 0) return [];

    const sorted = [...playlists].sort((a, b) => (b.priority || 0) - (a.priority || 0));
    const groups: Array<{ title: string; items: string[] }> = [];

    for (const playlist of sorted) {
      if (playlist.has_channels) {
        for (const channel of playlist.channels || []) {
          const channelItems = (channel.items || []).slice().sort((a, b) => a.position - b.position);
          if (channelItems.length === 0) continue;
          const title = `Playlist: ${playlist.name} • Canal: ${channel.name}${channel.is_fallback ? " (fallback)" : ""}`;
          groups.push({
            title,
            items: channelItems.map(
              (item, idx) => `${(item.position ?? idx) + 1}. ${item.media.name} (${item.media.type})`,
            ),
          });
        }
      } else {
        const playlistItems = (playlist.items || []).slice().sort((a, b) => a.position - b.position);
        if (playlistItems.length === 0) continue;
        const title = `Playlist: ${playlist.name}`;
        groups.push({
          title,
          items: playlistItems.map(
            (item, idx) => `${(item.position ?? idx) + 1}. ${item.media.name} (${item.media.type})`,
          ),
        });
      }
    }

    return groups;
  }, [deviceState?.playlists]);

  // Prefetch das mídias (imagens) em idle p/ Cache API + warm-up
  useEffect(() => {
    if (!items || items.length === 0) return;
    const urls = items
      .map((it) => it?.media?.file_url)
      .filter((u): u is string => typeof u === "string" && !!u);
    if (urls.length === 0) return;
    import("@/lib/mupaCache").then(({ prefetchAssets }) => {
      prefetchAssets(urls);
    });
  }, [items]);

  // Override media check
  const hasActiveOverrideMedia = (() => {
    if (!deviceState?.override_media) return false;
    const expiresAt = new Date(deviceState.override_media.expires_at);
    return expiresAt > new Date();
  })();
  const overrideMedia = hasActiveOverrideMedia ? deviceState?.override_media : null;
  const displayOverrideMedia = hasActiveOverrideMedia && overrideMedia;

  // Lista normalizada para o seamless player (apenas video/image, demais tipos
  // são renderizados via MediaRenderer fora do double-buffer).
  const seamlessItems: SeamlessMediaItem[] = useMemo(() => {
    return items
      .map((it) => {
        const m = it?.media;
        if (!m) return null;
        if (m.type !== "video" && m.type !== "image") return null;
        const url = m.blob_url || m.file_url;
        if (!url) return null;
        return {
          id: m.id,
          type: m.type,
          url,
          duration:
            m.type === "video"
              ? (it?.duration_override ?? 0)
              : (it?.duration_override || m.duration || 10),
        } as SeamlessMediaItem;
      })
      .filter((x): x is SeamlessMediaItem => !!x);
  }, [items]);

  const {
    activeSlot: activePlayer,
    currentIndex,
    progressPercent,
    timeRemainingMs: timeRemaining,
    goToNext,
    goToPrev,
  } = useSeamlessMediaPlayer({
    items: seamlessItems,
    videoARef,
    videoBRef,
    imgARef,
    imgBRef,
    crossfadeMs: 400,
    preloadLeadSeconds: 2,
    crossfadeLeadSeconds: 0.4,
    paused: !!displayOverrideMedia,
  });

  const activeItem = items[currentIndex] || null;
  const activeMedia = displayOverrideMedia ? overrideMedia : activeItem?.media;

  // Live audience broadcast (Supabase Realtime). Adaptive cadence: 5s with
  // people detected, 30s when empty. Buffers offline and replays on reconnect.
  const audienceContent = useMemo(() => {
    const media = (activeMedia as any) || null;
    if (!media) return null;
    return {
      contentId: media.id ?? "",
      contentName: media.name ?? "",
      playlistId: (activeItem as any)?.playlist_id ?? "",
    };
  }, [activeMedia, activeItem]);
  useAudienceAggregator(
    deviceCode || "",
    !!faceModelsReady,
    audienceFacesRef,
    audienceContent,
  );

  // Sincroniza mediaElementRef com o slot ativo (para useDeviceMonitor)
  useEffect(() => {
    if (displayOverrideMedia) return;
    if (activeMedia?.type === "video") {
      mediaElementRef.current = activePlayer === "A" ? videoARef.current : videoBRef.current;
    } else if (activeMedia?.type === "image") {
      mediaElementRef.current = activePlayer === "A" ? imgARef.current : imgBRef.current;
    }
  }, [activePlayer, activeMedia?.id, activeMedia?.type, displayOverrideMedia]);

  const [resolvedMediaUrl, setResolvedMediaUrl] = useState<string>("");

  useEffect(() => {
    const updateOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    updateOrientation();
    window.addEventListener("resize", updateOrientation);
    return () => {
      window.removeEventListener("resize", updateOrientation);
    };
  }, []);

  // Resolve URL apenas para override media e tipos especiais (news/weather).
  // Vídeos/imagens "normais" usam blob_url/file_url direto via seamlessItems.
  useEffect(() => {
    let cancelled = false;
    const resolveUrl = async () => {
      const media = activeMedia;
      if (!media || !media.file_url) {
        setResolvedMediaUrl("");
        return;
      }
      if (media.blob_url) {
        setResolvedMediaUrl(media.blob_url);
        return;
      }
      try {
        const localUrl = await storageService.cacheMedia(media.file_url, media.id);
        if (!cancelled) setResolvedMediaUrl(localUrl);
      } catch (e) {
        console.error("Failed to cache media locally (offline player):", e);
        if (!cancelled) setResolvedMediaUrl(media.file_url);
      }
    };
    resolveUrl();
    return () => {
      cancelled = true;
    };
  }, [activeMedia?.id, activeMedia?.file_url, activeMedia?.blob_url]);

  const getObjectFit = (): "cover" | "contain" | "fill" => "fill";

  // Track media views
  useEffect(() => {
    if (activeMedia && terminalMode === "player") {
      const it = items[currentIndex];
      const media = it?.media;
      const duration =
        media?.type === "video"
          ? media.duration || it?.duration_override || 10
          : it?.duration_override || media?.duration || 10;
      trackEvent({ type: "media_view", media_id: activeMedia.id, duration });
    }
  }, [currentIndex, activeMedia?.id]);

  // Quando estamos em override / news / weather, pausamos os vídeos A/B
  // (mas NUNCA limpamos src — evita reload de decoder no Android WebView).
  useEffect(() => {
    const isSpecial =
      !!displayOverrideMedia ||
      activeMedia?.type === "news" ||
      activeMedia?.type === "weather";
    if (!isSpecial) return;
    [videoARef.current, videoBRef.current].forEach((v) => {
      if (v) {
        try {
          v.pause();
        } catch {
          /* ignore */
        }
      }
    });
  }, [displayOverrideMedia, activeMedia?.type]);

  // Process faces for counter
  useEffect(() => {
    if (activeFaces.length > 0) {
      processFaces(activeFaces);
      activeFaces.forEach((face) => {
        trackEvent({ type: "face_detected" });
        if (face.isRegistered) trackEvent({ type: "face_recognized" });
      });
    }
  }, [activeFaces.length]);

  // Initialize face camera always — runs in background to feed DemoFace monitoring.
  // Stream is kept in a ref so it survives ref-target swaps when the
  // FacialRecognitionOverlay mounts/unmounts its own <video>.
  const cameraStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        cameraStreamRef.current = stream;
        setCameraStream(stream);
        setCameraError(false);
        if (faceVideoRef.current && faceVideoRef.current.srcObject !== stream) {
          faceVideoRef.current.srcObject = stream;
          faceVideoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.warn("[OfflinePlayer] Camera not available:", err);
        if (!cancelled) setCameraError(true);
      }
    };
    startCamera();

    return () => {
      cancelled = true;
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
      setCameraStream(null);
    };
  }, []);

  // Re-attach the stream whenever the video element remounts (overlay open/close).
  useEffect(() => {
    const interval = setInterval(() => {
      const video = faceVideoRef.current;
      const stream = cameraStreamRef.current;
      if (video && stream && video.srcObject !== stream) {
        video.srcObject = stream;
        video.play().catch(() => {});
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Save theme
  useEffect(() => {
    localStorage.setItem(`terminal_theme_${deviceCode}`, theme);
  }, [theme, deviceCode]);

  // Product lookup
  const mediaTimerRef = useRef<NodeJS.Timeout | null>(null);
  const {
    product,
    isLoading: isProductLoading,
    error: productError,
    lookupProduct,
    clearProduct,
  } = useProductLookup({
    deviceCode: deviceCode || "",
    deviceId: deviceState?.device_id || undefined,
    onLookupStart: () => {
      setTerminalMode("product");
      trackEvent({ type: "product_lookup" });
      if (mediaTimerRef.current) clearTimeout(mediaTimerRef.current);
    },
  });

  const { data: displaySettings } = useProductDisplaySettingsBySlug(deviceState?.company_slug);
  const { speak: speakPrice, stop: stopTTS } = useProductTTS();

  const handleDismissProduct = useCallback(() => {
    setTerminalMode("player");
    clearProduct();
    stopTTS();
  }, [clearProduct, stopTTS]);

  // Speak product price when found or "not found" on error, then auto-dismiss after 3s
  useEffect(() => {
    if (product && product.current_price) {
      const formatPrice = (value: number) => {
        const reais = Math.floor(value);
        const centavos = Math.round((value - reais) * 100);
        let text = reais === 1 ? "1 real" : `${reais} reais`;
        if (centavos > 0) {
          text += ` e ${centavos} centavos`;
        }
        return text;
      };

      let priceText: string;
      if (product.is_offer && product.original_price) {
        priceText = `Produto em oferta, aproveite! De ${formatPrice(product.original_price)} por apenas ${formatPrice(product.current_price)}.`;
      } else {
        priceText = `${formatPrice(product.current_price)}.`;
      }

      let cancelled = false;
      speakPrice(priceText).then(() => {
        if (cancelled) return;
        setTimeout(() => {
          if (!cancelled) {
            handleDismissProduct();
          }
        }, 3000);
      });

      return () => {
        cancelled = true;
      };
    }
  }, [product, speakPrice, handleDismissProduct]);

  // Speak "Produto não encontrado" on error
  useEffect(() => {
    if (productError) {
      let cancelled = false;
      speakPrice("Produto não encontrado.").then(() => {
        if (cancelled) return;
        setTimeout(() => {
          if (!cancelled) {
            handleDismissProduct();
          }
        }, 3000);
      });
      return () => {
        cancelled = true;
      };
    }
  }, [productError, speakPrice, handleDismissProduct]);

  const handleEanSubmit = useCallback(
    (ean: string) => {
      lookupProduct(ean);
    },
    [lookupProduct],
  );

  const handleReset = useCallback(async () => {
    toast.loading("Limpando dados...", { id: "reset" });
    try {
      await clearAllData();
      toast.success("Dados limpos!", { id: "reset" });
      setTimeout(() => navigate(`/setup/${deviceCode}`), 1000);
    } catch {
      toast.error("Erro ao limpar dados", { id: "reset" });
    }
  }, [clearAllData, navigate, deviceCode]);

  const handleModeChange = useCallback((mode: TerminalMode) => {
    if (mode === "product") {
      // Product mode is triggered by EAN scan, not menu
      return;
    }
    setTerminalMode(mode);
  }, []);

  // Simulation mode derivation
  const simulationMode: SimulationMode = (() => {
    if (!deviceState?.is_online) return "offline";
    if (terminalMode === "facial" && activeFaces.length > 0) return "recognizing";
    if (terminalMode === "product") return "product_lookup";
    if (terminalMode === "loyalty" && activeFaces.some((f) => f.isRegistered)) return "personalized_offer";
    if (items.length === 0 && terminalMode === "player") return "idle";
    return "connected";
  })();

  const isDeviceBlocked = deviceState?.is_blocked === true;
  const hasActiveDownload = downloadProgress.total > 0 && downloadProgress.downloaded < downloadProgress.total;

  // State screens
  if (resolveError) {
    return <LoadingScreen subMessage={resolveError} />;
  }

  if (isLoading && !deviceState) {
    return <LoadingScreen subMessage={`Dispositivo: ${deviceCode || idDevice || "..."}`} />;
  }

  if (isDeviceBlocked) {
    return (
      <BlockedScreen
        message={deviceState?.blocked_message || undefined}
        deviceName={deviceState?.device_name || deviceCode}
        onCheckStatus={syncWithServer}
        isChecking={isSyncing}
      />
    );
  }

  if (!displayOverrideMedia && (!activePlaylist || items.length === 0) && terminalMode === "player") {
    const debugInfo = activePlaylist
      ? `Playlist "${activePlaylist.name}" ativa, mas ${activePlaylist.has_channels ? "nenhum canal ativo" : "sem itens"}`
      : `${deviceState?.playlists?.length || 0} playlists em cache`;

    return (
      <div className="relative">
        <EmptyContentScreen
          deviceName={deviceState?.device_name || deviceCode}
          syncError={syncError}
          onSync={syncWithServer}
          isSyncing={isSyncing}
          debugInfo={debugInfo}
          contentGroups={contentGroups}
          cacheKey={deviceCode || undefined}
        />
      </div>
    );
  }

  const displayMediaUrl = displayOverrideMedia
    ? resolvedMediaUrl || overrideMedia?.blob_url || overrideMedia?.file_url || ""
    : resolvedMediaUrl || activeItem?.media?.blob_url || activeItem?.media?.file_url || "";

  const isOverlayActive = terminalMode !== "player" && terminalMode !== "product";

  return (
    <div className="fixed inset-0 bg-black overflow-hidden select-none">
      {/* Barcode scanner - always active in player mode */}
      <EanInput
        isVisible={terminalMode === "player"}
        onSubmit={handleEanSubmit}
        disabled={false}
        onReset={handleReset}
        alwaysListenForScanner={true}
      />
      {Capacitor.isNativePlatform() && (
        <div className="absolute top-2 left-2 z-50 px-2 py-1 rounded bg-black/70 text-[10px] text-white/70">
          <span>
            OfflinePlayer • build: {__BUILD_ID__} • rota: {deviceCode ? `/play/${deviceCode}` : "/play/:deviceCode"}
          </span>
        </div>
      )}

      {/* Product lookup overlay */}
      {terminalMode === "product" && (
        <div className="absolute inset-0 z-40" style={{ backgroundColor: "#FFFFFF" }}>
          <ProductLookupContainer
            product={product}
            isLoading={isProductLoading}
            error={productError}
            onDismiss={handleDismissProduct}
            timeout={9999}
            displaySettings={displaySettings || undefined}
            isPortrait={isPortrait}
          />
        </div>
      )}

      {/* Override media badge */}
      {displayOverrideMedia && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-orange-500/90 backdrop-blur-sm rounded-full px-4 py-2">
          <AlertCircle className="w-4 h-4 text-white" />
          <span className="text-white text-sm font-medium">Mídia Avulsa</span>
        </div>
      )}

      {/* Device simulation indicator */}
      <DeviceSimulator mode={simulationMode} visible={terminalMode === "player" && showControls} />

      {/* Vignette effect */}
      {terminalMode === "player" && <VignetteOverlay />}

      {/* Indicador discreto do reconhecimento facial (sempre visível) */}
      <FaceRecognitionIndicator
        status={faceStatus}
        facesCount={activeFaces.length}
      />

      {/* Media player background */}
      <div
        className={cn(
          "relative w-screen h-screen",
          terminalMode === "product" || isOverlayActive ? "opacity-20 pointer-events-none" : "opacity-100",
        )}
      >
        {displayOverrideMedia && activeMedia ? (
          <MediaRenderer
            onElementRef={(el) => {
              mediaElementRef.current = el;
            }}
            media={activeMedia}
            mediaUrl={displayMediaUrl}
            objectFit={getObjectFit()}
            loop
            isPortrait={isPortrait}
            onImageError={(e) => {
              const fallbackUrl = overrideMedia?.file_url || activeItem?.media?.file_url;
              if (fallbackUrl && (e.target as HTMLImageElement).src !== fallbackUrl) {
                (e.target as HTMLImageElement).src = fallbackUrl;
              }
            }}
          />
        ) : (
          <div className="relative w-full h-full">
            {(activeMedia?.type === "news" || activeMedia?.type === "weather") && activeMedia ? (
              <div className="absolute inset-0">
                <MediaRenderer
                  onElementRef={(el) => {
                    mediaElementRef.current = el;
                  }}
                  media={activeMedia as any}
                  mediaUrl={resolvedMediaUrl || activeMedia.file_url || ""}
                  objectFit={getObjectFit()}
                  isPortrait={isPortrait}
                  onEnded={goToNext}
                />
              </div>
            ) : null}
            {/* Slot A — sempre montado, nunca display:none */}
            <div className="absolute inset-0">
              <video
                ref={videoARef}
                className={cn(
                  "w-full h-full",
                  getObjectFit() === "cover" && "object-cover",
                  getObjectFit() === "contain" && "object-contain",
                  getObjectFit() === "fill" && "object-fill",
                )}
                style={{
                  opacity: activePlayer === "A" ? 1 : 0,
                  transition: "opacity 400ms ease-in-out",
                  willChange: "opacity",
                  transform: "translateZ(0)",
                  backfaceVisibility: "hidden",
                  zIndex: activePlayer === "A" ? 2 : 1,
                }}
                playsInline
                muted={false}
              />
              <img
                ref={imgARef}
                className={cn(
                  "absolute inset-0 w-full h-full",
                  getObjectFit() === "cover" && "object-cover",
                  getObjectFit() === "contain" && "object-contain",
                  getObjectFit() === "fill" && "object-fill",
                )}
                style={{
                  opacity:
                    activePlayer === "A" && activeMedia?.type === "image" ? 1 : 0,
                  transition: "opacity 400ms ease-in-out",
                  willChange: "opacity",
                  transform: "translateZ(0)",
                  backfaceVisibility: "hidden",
                  zIndex: activePlayer === "A" && activeMedia?.type === "image" ? 3 : 1,
                }}
                alt=""
              />
            </div>
            {/* Slot B — sempre montado, nunca display:none */}
            <div className="absolute inset-0">
              <video
                ref={videoBRef}
                className={cn(
                  "w-full h-full",
                  getObjectFit() === "cover" && "object-cover",
                  getObjectFit() === "contain" && "object-contain",
                  getObjectFit() === "fill" && "object-fill",
                )}
                style={{
                  opacity: activePlayer === "B" ? 1 : 0,
                  transition: "opacity 400ms ease-in-out",
                  willChange: "opacity",
                  transform: "translateZ(0)",
                  backfaceVisibility: "hidden",
                  zIndex: activePlayer === "B" ? 2 : 1,
                }}
                playsInline
                muted={false}
              />
              <img
                ref={imgBRef}
                className={cn(
                  "absolute inset-0 w-full h-full",
                  getObjectFit() === "cover" && "object-cover",
                  getObjectFit() === "contain" && "object-contain",
                  getObjectFit() === "fill" && "object-fill",
                )}
                style={{
                  opacity:
                    activePlayer === "B" && activeMedia?.type === "image" ? 1 : 0,
                  transition: "opacity 400ms ease-in-out",
                  willChange: "opacity",
                  transform: "translateZ(0)",
                  backfaceVisibility: "hidden",
                  zIndex: activePlayer === "B" && activeMedia?.type === "image" ? 3 : 1,
                }}
                alt=""
              />
            </div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {terminalMode === "player" && !displayOverrideMedia && <PlayerProgressBar progressPercent={progressPercent} />}

      {/* Player controls */}
      {terminalMode === "player" && (
        <PlayerControls
          visible={showControls}
          deviceName={deviceState?.device_name || deviceCode}
          playlistName={activePlaylist?.name}
          channelName={activeChannel?.name}
          isOnline={deviceState?.is_online}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          onSync={syncWithServer}
          showSyncButton
        ></PlayerControls>
      )}

      {/* Media info */}
      {terminalMode === "player" && activeMedia && (
        <div
          className={cn(
            "bg-black/60 backdrop-blur-sm rounded-lg p-3 transition-opacity duration-300",
            showControls ? "opacity-100" : "opacity-0",
            isPortrait ? "absolute inset-x-4 bottom-4" : "absolute bottom-6 left-6",
          )}
        >
          <div className="flex items-center gap-3">
            {activeMedia?.type === "video" ? (
              <Video className="w-5 h-5 text-primary" />
            ) : (
              <ImageIcon className="w-5 h-5 text-primary" />
            )}
            <div>
              <p className="text-white font-medium text-sm">{activeMedia?.name}</p>
              {displayOverrideMedia ? (
                <p className="text-orange-400 text-xs">
                  Mídia avulsa • Expira: {new Date(overrideMedia!.expires_at).toLocaleTimeString("pt-BR")}
                </p>
              ) : (
                <p className="text-white/60 text-xs">
                  {currentIndex + 1} de {items.length} • {Math.ceil(timeRemaining / 1000)}s restantes
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Media indicators */}
      {terminalMode === "player" && !displayOverrideMedia && (
        <MediaIndicators
          total={items.length}
          currentIndex={currentIndex}
          visible={showControls}
          activeColor="bg-primary"
        />
      )}

      {/* Large clock overlay - always visible */}
      {terminalMode === "player" && (
        <div className="absolute bottom-0 left-0 right-0 pointer-events-none z-[5]">
          <div className="bg-gradient-to-t from-black/70 via-black/30 to-transparent pt-20 pb-6 px-8 flex items-end justify-between">
            <div>
              <p className="text-white font-bold text-5xl md:text-6xl lg:text-7xl tracking-tight leading-none drop-shadow-lg font-mono">
                {formattedTime}
              </p>
              <p className="text-white/70 text-lg md:text-xl lg:text-2xl mt-1 tracking-wide drop-shadow-md">
                {formattedDate}
              </p>
            </div>
          </div>
        </div>
      )}

      {isSyncing && terminalMode === "player" && (
        <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 opacity-50">
          <RefreshCw className="w-4 h-4 text-primary animate-spin" />
          <span className="text-white/80 text-xs">
            {hasActiveDownload
              ? `Atualizando mídias ${downloadProgress.downloaded}/${downloadProgress.total}`
              : "Sincronizando atualizações"}
          </span>
        </div>
      )}

      {/* Offline indicator */}
      {!deviceState?.is_online && terminalMode === "player" && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-yellow-500/20 backdrop-blur-sm rounded-full px-4 py-1.5">
          <WifiOff className="w-4 h-4 text-yellow-400" />
          <span className="text-yellow-200 text-sm">Modo Offline</span>
        </div>
      )}

      {/* Last sync */}
      {deviceState?.last_sync && terminalMode === "player" && (
        <div
          className={cn(
            "absolute bottom-10 left-1/2 -translate-x-1/2 text-white/40 text-xs transition-opacity duration-300",
            showControls ? "opacity-100" : "opacity-0",
          )}
        >
          <Clock className="w-3 h-3 inline mr-1" />
          Última sinc.: {new Date(deviceState.last_sync).toLocaleTimeString("pt-BR")}
        </div>
      )}

      {/* === MODULE OVERLAYS === */}

      <AIAssistantOverlay
        visible={terminalMode === "assistant"}
        messages={aiMessages}
        isLoading={aiLoading}
        onSend={(text) => {
          trackEvent({ type: "assistant_interaction" });
          aiSend(text);
        }}
        onClear={aiClear}
        onClose={() => setTerminalMode("player")}
      />

      <MetricsOverlay
        visible={terminalMode === "metrics"}
        metrics={metrics}
        onClose={() => setTerminalMode("player")}
      />

      <FacialRecognitionOverlay
        visible={terminalMode === "facial"}
        activeFaces={activeFaces}
        videoRef={faceVideoRef}
        canvasRef={faceCanvasRef}
        isPortrait={isPortrait}
        onClose={() => setTerminalMode("player")}
      />

      <LoyaltyOverlay
        visible={terminalMode === "loyalty"}
        activeFaces={activeFaces}
        isPortrait={isPortrait}
        onClose={() => setTerminalMode("player")}
      />

      <PeopleCounterOverlay
        visible={terminalMode === "counter"}
        count={peopleCount}
        todayCount={todayCount}
        activeFaces={activeFaces}
        isPortrait={isPortrait}
        onClose={() => setTerminalMode("player")}
      />

      <TerminalSettingsOverlay
        visible={terminalMode === "settings"}
        theme={theme}
        onThemeChange={setTheme}
        deviceCode={deviceCode}
        isOnline={deviceState?.is_online}
        onSync={syncWithServer}
        onReset={handleReset}
        onClose={() => setTerminalMode("player")}
      />

      {/* Hidden face camera refs — visible offscreen with real dimensions so the
          browser actually decodes frames (1px hidden videos are paused on some
          engines). Re-mounted only when the FacialRecognitionOverlay isn't showing
          its own preview; the polling effect re-attaches the stream when swapped. */}
      {terminalMode !== "facial" && (
        <div
          className="fixed bottom-0 right-0 pointer-events-none opacity-0"
          style={{ width: 64, height: 48 }}
          aria-hidden="true"
        >
          <video ref={faceVideoRef} autoPlay muted playsInline width={640} height={480} className="w-full h-full" />
          <canvas ref={faceCanvasRef} width={640} height={480} className="hidden" />
        </div>
      )}
    </div>
  );
};

export default OfflinePlayer;
