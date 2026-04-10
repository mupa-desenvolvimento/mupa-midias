import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";

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
import { useAutoHideControls, useFullscreen, useKeyboardShortcuts, useClock } from "@/hooks/player";
import {
  MediaRenderer,
  PlayerProgressBar,
  MediaIndicators,
  PlayerControls,
  LoadingScreen,
  BlockedScreen,
  EmptyContentScreen,
  ActiveSessionScreen,
  VignetteOverlay,
} from "@/components/player-core";
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
import {
  AlertCircle,
  RefreshCw,
  Video,
  Image as ImageIcon,
  Clock,
  WifiOff,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { storageService } from "@/modules/offline-storage/StorageService";
import { Capacitor } from "@capacitor/core";

const OfflinePlayer = () => {
  const { deviceCode } = useParams<{ deviceCode: string }>();
  const navigate = useNavigate();
  

  // Core hooks
  const {
    deviceState,
    isLoading,
    isSyncing,
    syncError,
    downloadProgress,
    getActivePlaylist,
    getActiveItems,
    getActiveChannel,
    syncWithServer,
    isPlaylistActiveNow,
    clearAllData,
  } = useOfflinePlayer(deviceCode || "");

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

  // Face detection for overlays
  const { activeFaces } = useFaceDetection(faceVideoRef, faceCanvasRef, terminalMode === "facial" || terminalMode === "counter" || terminalMode === "loyalty");

  useDeviceMonitor(deviceCode || "", mediaElementRef, activeFaces);

  // Metrics
  const { metrics, trackEvent } = useTerminalMetrics(deviceCode || "");

  // AI Assistant
  const { messages: aiMessages, isLoading: aiLoading, sendMessage: aiSend, clearHistory: aiClear } = useTerminalAI(deviceCode || "");

  // People counter
  const { count: peopleCount, todayCount, processFaces } = usePeopleCounter();

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
          const { StatusBar } = await import('@capacitor/status-bar');
          await StatusBar.hide();
        } catch (e) {
          console.warn('[Player] StatusBar hide failed:', e);
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
        console.warn('[Player] Fullscreen request failed:', e);
      }

      // Prevent virtual keyboard: blur any focused input and set inputs to readonly temporarily
      document.querySelectorAll('input, textarea').forEach((el) => {
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
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const [activePlayer, setActivePlayer] = useState<"A" | "B">("A");
  const [nextReadySlot, setNextReadySlot] = useState<"A" | "B" | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
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
            items: channelItems.map((item, idx) => `${(item.position ?? idx) + 1}. ${item.media.name} (${item.media.type})`),
          });
        }
      } else {
        const playlistItems = (playlist.items || []).slice().sort((a, b) => a.position - b.position);
        if (playlistItems.length === 0) continue;
        const title = `Playlist: ${playlist.name}`;
        groups.push({
          title,
          items: playlistItems.map((item, idx) => `${(item.position ?? idx) + 1}. ${item.media.name} (${item.media.type})`),
        });
      }
    }

    return groups;
  }, [deviceState?.playlists]);

  // Override media check
  const hasActiveOverrideMedia = (() => {
    if (!deviceState?.override_media) return false;
    const expiresAt = new Date(deviceState.override_media.expires_at);
    return expiresAt > new Date();
  })();
  const overrideMedia = hasActiveOverrideMedia ? deviceState?.override_media : null;
  const displayOverrideMedia = hasActiveOverrideMedia && overrideMedia;

  const activeItem = items[currentIndex] || null;
  const activeMedia = displayOverrideMedia ? overrideMedia : activeItem?.media;

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
        if (!cancelled) {
          setResolvedMediaUrl(localUrl);
        }
      } catch (e) {
        console.error("Failed to cache media locally (offline player):", e);
        if (!cancelled) {
          setResolvedMediaUrl(media.file_url);
        }
      }
    };

    resolveUrl();

    return () => {
      cancelled = true;
    };
  }, [activeMedia?.id, activeMedia?.file_url, activeMedia?.blob_url]);

  const getDurationForIndex = useCallback((idx: number) => {
    const it = items[idx];
    const media = it?.media;
    if (!media) return 10;
    if (media.type === "video") {
      return it?.duration_override ? it.duration_override : 0;
    }
    return it?.duration_override || media.duration || 10;
  }, [items]);

  const goToNext = useCallback(() => {
    if (items.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % items.length);
  }, [items.length]);

  const goToPrev = useCallback(() => {
    if (items.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  }, [items.length]);

  const getObjectFit = (): "cover" | "contain" | "fill" => "fill";

  // Track media views
  useEffect(() => {
    if (activeMedia && terminalMode === "player") {
      const it = items[currentIndex];
      const media = it?.media;
      const duration =
        media?.type === "video"
          ? (media.duration || it?.duration_override || 10)
          : (it?.duration_override || media?.duration || 10);
      trackEvent({ type: "media_view", media_id: activeMedia.id, duration });
    }
  }, [currentIndex, activeMedia?.id]);

  const preloadIntoSlot = useCallback((slot: "A" | "B", index: number) => {
    if (items.length === 0) return;
    const item = items[index];
    const media = item?.media;
    if (!media) return;
    if (media.type === "news" || media.type === "weather") {
      const video = slot === "A" ? videoARef.current : videoBRef.current;
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
        video.style.display = "none";
      }
      const img = slot === "A" ? imgARef.current : imgBRef.current;
      if (img) {
        img.style.display = "none";
        img.removeAttribute("src");
      }
      setNextReadySlot(slot);
      return;
    }
    const url = media.blob_url || media.file_url;
    if (!url) return;

    if (media.type === "image") {
      const img = slot === "A" ? imgARef.current : imgBRef.current;
      if (!img) return;
      const loader = new Image();
      loader.onload = () => {
        if (!img) return;
        img.src = url;
        img.style.display = "block";
        const video = slot === "A" ? videoARef.current : videoBRef.current;
        if (video) {
          video.pause();
          video.removeAttribute("src");
          video.load();
          video.style.display = "none";
        }
        setNextReadySlot(slot);
      };
      loader.src = url;
    } else {
      if (Capacitor.isNativePlatform()) {
        return;
      }
      const video = slot === "A" ? videoARef.current : videoBRef.current;
      if (!video) return;
      video.preload = "auto";
      video.muted = true;
      video.src = url;
      video.load();
      const checkReady = () => {
        if (video.readyState === 4) {
          setNextReadySlot(slot);
          video.play().then(() => {
            video.pause();
            video.currentTime = 0;
          }).catch(() => {
            video.pause();
            video.currentTime = 0;
          });
        } else {
          window.setTimeout(checkReady, 50);
        }
      };
      checkReady();
      video.style.display = "block";
      const img = slot === "A" ? imgARef.current : imgBRef.current;
      if (img) {
        img.style.display = "none";
        img.removeAttribute("src");
      }
    }
  }, [items]);

  useEffect(() => {
    if (displayOverrideMedia) return;
    if (items.length === 0 || !activeMedia) return;
    if (activeMedia.type === "news" || activeMedia.type === "weather") {
      const videoA = videoARef.current;
      const videoB = videoBRef.current;
      if (videoA) {
        videoA.pause();
        videoA.removeAttribute("src");
        videoA.load();
        videoA.style.display = "none";
      }
      if (videoB) {
        videoB.pause();
        videoB.removeAttribute("src");
        videoB.load();
        videoB.style.display = "none";
      }
      const imgA = imgARef.current;
      const imgB = imgBRef.current;
      if (imgA) {
        imgA.style.display = "none";
        imgA.removeAttribute("src");
      }
      if (imgB) {
        imgB.style.display = "none";
        imgB.removeAttribute("src");
      }
      mediaElementRef.current = null;
      return;
    }
    const url = resolvedMediaUrl || activeMedia.blob_url || activeMedia.file_url;
    if (!url) return;
    const slot = activePlayer;
    if (activeMedia.type === "video") {
      const video = slot === "A" ? videoARef.current : videoBRef.current;
      if (video) {
        video.preload = "auto";
        video.muted = false;
        video.src = url;
        video.load();
        video.play().catch(() => {});
        const img = slot === "A" ? imgARef.current : imgBRef.current;
        if (img) {
          img.style.display = "none";
          img.removeAttribute("src");
        }
        mediaElementRef.current = video;
      }
    } else {
      const img = slot === "A" ? imgARef.current : imgBRef.current;
      if (img) {
        img.src = url;
        img.style.display = "block";
        const video = slot === "A" ? videoARef.current : videoBRef.current;
        if (video) {
          video.pause();
          video.removeAttribute("src");
          video.load();
          video.style.display = "none";
        }
        mediaElementRef.current = img;
      }
    }
  }, [items, activeMedia, activePlayer, displayOverrideMedia, resolvedMediaUrl]);

  useEffect(() => {
    if (displayOverrideMedia) return;
    if (items.length === 0) return;
    const duration = getDurationForIndex(currentIndex);
    const isVideo = items[currentIndex]?.media?.type === "video";

    if (isVideo) {
      const activeVideo = activePlayer === "A" ? videoARef.current : videoBRef.current;
      if (!activeVideo) return;
      const onTimeUpdate = () => {
        if (!activeVideo.duration || isNaN(activeVideo.duration)) return;
        const remaining = Math.max(activeVideo.duration - activeVideo.currentTime, 0);
        setTimeRemaining(remaining * 1000);
        const pct = (activeVideo.currentTime / activeVideo.duration) * 100;
        setProgressPercent(isFinite(pct) ? pct : 0);
        if (remaining <= 3) {
          const nextIndex = (currentIndex + 1) % items.length;
          const preloadSlot = activePlayer === "A" ? "B" : "A";
          preloadIntoSlot(preloadSlot, nextIndex);
        }
        if (remaining <= 0.05) {
          const nextIndex = (currentIndex + 1) % items.length;
          const nextSlot = activePlayer === "A" ? "B" : "A";
          if (nextReadySlot && nextReadySlot !== nextSlot) {
            return;
          }
          const nextVideo = nextSlot === "A" ? videoARef.current : videoBRef.current;
          const nextImg = nextSlot === "A" ? imgARef.current : imgBRef.current;
          if (nextVideo && nextVideo.src) {
            nextVideo.currentTime = 0;
            nextVideo.play().catch(() => {});
            const prevVideo = activePlayer === "A" ? videoARef.current : videoBRef.current;
            if (prevVideo) prevVideo.pause();
          } else if (nextImg && nextImg.src) {
            const currentVideo = activePlayer === "A" ? videoARef.current : videoBRef.current;
            if (currentVideo) currentVideo.pause();
          }
          setActivePlayer(nextSlot);
          setCurrentIndex(nextIndex);
          setNextReadySlot(null);
        }
      };
      activeVideo.addEventListener("timeupdate", onTimeUpdate);
      return () => {
        activeVideo.removeEventListener("timeupdate", onTimeUpdate);
      };
    } else {
      const effectiveDuration = duration > 0 ? duration : 10;
      setTimeRemaining(effectiveDuration * 1000);
      setProgressPercent(0);
      const preloadTimeout = window.setTimeout(() => {
        const nextIndex = (currentIndex + 1) % items.length;
        const preloadSlot = activePlayer === "A" ? "B" : "A";
        preloadIntoSlot(preloadSlot, nextIndex);
      }, Math.max(effectiveDuration * 1000 - 3000, 0));
      const switchTimeout = window.setTimeout(() => {
        const nextIndex = (currentIndex + 1) % items.length;
        const nextSlot = activePlayer === "A" ? "B" : "A";
        setActivePlayer(nextSlot);
        setCurrentIndex(nextIndex);
      }, Math.max(effectiveDuration * 1000 - 50, 0));
      const progressInterval = window.setInterval(() => {
        setTimeRemaining((prev) => {
          const next = Math.max(prev - 100, 0);
          const pct = ((effectiveDuration * 1000 - next) / (effectiveDuration * 1000)) * 100;
          setProgressPercent(isFinite(pct) ? pct : 0);
          return next;
        });
      }, 100);
      return () => {
        window.clearTimeout(preloadTimeout);
        window.clearTimeout(switchTimeout);
        window.clearInterval(progressInterval);
      };
    }
  }, [items, currentIndex, activePlayer, getDurationForIndex, nextReadySlot, displayOverrideMedia, preloadIntoSlot]);

  // Process faces for counter
  useEffect(() => {
    if (activeFaces.length > 0) {
      processFaces(activeFaces);
      activeFaces.forEach(face => {
        trackEvent({ type: "face_detected" });
        if (face.isRegistered) trackEvent({ type: "face_recognized" });
      });
    }
  }, [activeFaces.length]);

  // Initialize face camera when entering facial/counter/loyalty mode
  useEffect(() => {
    if (terminalMode === "facial" || terminalMode === "counter" || terminalMode === "loyalty") {
      const startCamera = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: "user" },
          });
          if (faceVideoRef.current) {
            faceVideoRef.current.srcObject = stream;
            faceVideoRef.current.play().catch(() => {});
          }
        } catch (err) {
          console.warn("Camera not available:", err);
        }
      };
      startCamera();

      return () => {
        const stream = faceVideoRef.current?.srcObject as MediaStream;
        stream?.getTracks().forEach(track => track.stop());
      };
    }
  }, [terminalMode]);

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

      return () => { cancelled = true; };
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
      return () => { cancelled = true; };
    }
  }, [productError, speakPrice, handleDismissProduct]);

  const handleEanSubmit = useCallback((ean: string) => {
    lookupProduct(ean);
  }, [lookupProduct]);

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
    if (terminalMode === "loyalty" && activeFaces.some(f => f.isRegistered)) return "personalized_offer";
    if (items.length === 0 && terminalMode === "player") return "idle";
    return "connected";
  })();

  const isDeviceBlocked = deviceState?.is_blocked === true;
  const hasActiveDownload =
    downloadProgress.total > 0 && downloadProgress.downloaded < downloadProgress.total;

  // State screens
  if (isLoading && !deviceState) {
    return <LoadingScreen subMessage={`Dispositivo: ${deviceCode}`} />;
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
        />
      </div>
    );
  }

  const displayMediaUrl = displayOverrideMedia
    ? (resolvedMediaUrl || overrideMedia?.blob_url || overrideMedia?.file_url || "")
    : (resolvedMediaUrl || activeItem?.media?.blob_url || activeItem?.media?.file_url || "");

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
          <span>OfflinePlayer • build: {__BUILD_ID__} • rota: {deviceCode ? `/play/${deviceCode}` : "/play/:deviceCode"}</span>
        </div>
      )}

      {/* Product lookup overlay */}
      {terminalMode === "product" && (
        <div className="absolute inset-0 z-40" style={{ backgroundColor: '#FFFFFF' }}>
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

      {/* Media player background */}
      <div
        className={cn(
          "relative w-screen h-screen",
          (terminalMode === "product" || isOverlayActive) ? "opacity-20 pointer-events-none" : "opacity-100"
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
            <div className="absolute inset-0">
              <video
                ref={videoARef}
                className={cn(
                  "w-full h-full object-cover transition-opacity duration-[0ms]",
                  getObjectFit() === "contain" && "object-contain",
                  getObjectFit() === "fill" && "object-fill",
                  activePlayer === "A" ? "opacity-100" : "opacity-0"
                )}
                style={{ willChange: "opacity", transform: "translateZ(0)" }}
                playsInline
              />
              <img
                ref={imgARef}
                className={cn(
                  "w-full h-full object-cover transition-opacity duration-[0ms]",
                  getObjectFit() === "contain" && "object-contain",
                  getObjectFit() === "fill" && "object-fill",
                  activePlayer === "A" ? "opacity-100" : "opacity-0"
                )}
                style={{ willChange: "opacity", transform: "translateZ(0)", backfaceVisibility: "hidden" }}
                alt=""
              />
            </div>
            <div className="absolute inset-0">
              <video
                ref={videoBRef}
                className={cn(
                  "w-full h-full object-cover transition-opacity duration-[0ms]",
                  getObjectFit() === "contain" && "object-contain",
                  getObjectFit() === "fill" && "object-fill",
                  activePlayer === "B" ? "opacity-100" : "opacity-0"
                )}
                style={{ willChange: "opacity", transform: "translateZ(0)" }}
                playsInline
              />
              <img
                ref={imgBRef}
                className={cn(
                  "w-full h-full object-cover transition-opacity duration-[0ms]",
                  getObjectFit() === "contain" && "object-contain",
                  getObjectFit() === "fill" && "object-fill",
                  activePlayer === "B" ? "opacity-100" : "opacity-0"
                )}
                style={{ willChange: "opacity", transform: "translateZ(0)", backfaceVisibility: "hidden" }}
                alt=""
              />
            </div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {terminalMode === "player" && !displayOverrideMedia && (
        <PlayerProgressBar progressPercent={progressPercent} />
      )}

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
        >
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-xs text-red-300 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            <span>Apagar dados</span>
          </button>
        </PlayerControls>
      )}

      {/* Media info */}
      {terminalMode === "player" && activeMedia && (
        <div
          className={cn(
            "bg-black/60 backdrop-blur-sm rounded-lg p-3 transition-opacity duration-300",
            showControls ? "opacity-100" : "opacity-0",
            isPortrait
              ? "absolute inset-x-4 bottom-4"
              : "absolute bottom-6 left-6"
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
        <div className={cn(
          "absolute bottom-10 left-1/2 -translate-x-1/2 text-white/40 text-xs transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0"
        )}>
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


      {/* Hidden face camera refs (shown in overlay) */}
      {terminalMode !== "facial" && (
        <div className="hidden">
          <video ref={faceVideoRef} autoPlay muted playsInline />
          <canvas ref={faceCanvasRef} />
        </div>
      )}
    </div>
  );
};

export default OfflinePlayer;
