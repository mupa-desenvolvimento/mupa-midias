import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useDeviceSession } from "@/hooks/useDeviceSession";
import { useParams, useSearchParams } from "react-router-dom";
import { db } from "@/services/firebase";
import { ref, onValue } from "firebase/database";
import { usePlayerFaceDetection } from "@/hooks/usePlayerFaceDetection";
import { setupKioskMode } from "@/utils/nativeBridge";
import { Capacitor } from "@capacitor/core";
import { useOfflinePlayer } from "@/hooks/useOfflinePlayer";
import { useProductLookup } from "@/hooks/useProductLookup";
import { useProductTTS } from "@/hooks/useProductTTS";
import { useProductDisplaySettingsBySlug } from "@/hooks/useProductDisplaySettings";
import { ProductLookupContainer } from "@/components/player/ProductLookupContainer";
import { EanInput } from "@/components/player/EanInput";
import { useAutoHideControls, useFullscreen, useKeyboardShortcuts, useMediaRotation, useClock } from "@/hooks/player";
import { MediaRenderer, PlayerProgressBar, PlayerControls, LoadingScreen, EmptyContentScreen, DownloadScreen, ActiveSessionScreen } from "@/components/player-core";
import {
  Bell,
  Camera,
  Users,
  WifiOff,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { storageService } from "@/modules/offline-storage/StorageService";
import { useDeviceMonitor } from "@/hooks/useDeviceMonitor";

const WebViewPlayer = () => {
  const { deviceCode: paramDeviceCode } = useParams<{ deviceCode: string }>();
  const [searchParams] = useSearchParams();
  const deviceCode = paramDeviceCode || searchParams.get("device_id") || searchParams.get("id");
  const deviceSession = useDeviceSession(deviceCode);

  const {
    deviceState,
    isLoading,
    isSyncing,
    syncError,
    downloadProgress,
    getActiveItems,
    getActivePlaylist,
    syncWithServer,
  } = useOfflinePlayer(deviceCode || "");

  const { showControls } = useAutoHideControls();
  const { isFullscreen, toggleFullscreen } = useFullscreen();
  const { formattedTime } = useClock();

  // Android: hide status bar, navigation bar, and prevent keyboard
  useEffect(() => {
    const enterImmersiveMode = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          const { StatusBar } = await import('@capacitor/status-bar');
          await StatusBar.hide();
        } catch (e) {
          console.warn('[WebViewPlayer] StatusBar hide failed:', e);
        }
      }
      try {
        const el = document.documentElement as any;
        if (el.requestFullscreen) {
          await el.requestFullscreen().catch(() => {});
        } else if (el.webkitRequestFullscreen) {
          el.webkitRequestFullscreen();
        }
      } catch (e) {
        console.warn('[WebViewPlayer] Fullscreen request failed:', e);
      }
      document.querySelectorAll('input, textarea').forEach((el) => {
        (el as HTMLElement).blur();
      });
    };
    enterImmersiveMode();
    const handleVisibilityChange = () => {
      if (!document.hidden) enterImmersiveMode();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const [showUpdateNotification, setShowUpdateNotification] = useState(false);
  const [updateMessage, setUpdateMessage] = useState("");
  const [showProductOverlay, setShowProductOverlay] = useState(false);

  // Price lookup
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
      setShowProductOverlay(true);
    },
  });

  const { data: displaySettings } = useProductDisplaySettingsBySlug(deviceState?.company_slug);
  const { speak: speakPrice, stop: stopTTS } = useProductTTS();

  const handleDismissProduct = useCallback(() => {
    setShowProductOverlay(false);
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

  const cameraPreviewRef = useRef<HTMLVideoElement>(null);
  const [showCameraPreview, setShowCameraPreview] = useState(false);

  const mediaElementRef = useRef<HTMLVideoElement | HTMLImageElement | null>(null);

  const videoARef = useRef<HTMLVideoElement | null>(null);
  const videoBRef = useRef<HTMLVideoElement | null>(null);
  const imgARef = useRef<HTMLImageElement | null>(null);
  const imgBRef = useRef<HTMLImageElement | null>(null);
  const [activePlayer, setActivePlayer] = useState<"A" | "B">("A");

  const items = getActiveItems();
  const activePlaylist = getActivePlaylist();
  const isOnline = deviceState?.is_online ?? navigator.onLine;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const [nextReadySlot, setNextReadySlot] = useState<"A" | "B" | null>(null);

  const activeItem = items[currentIndex] || null;
  const activeMedia = activeItem?.media;

  // Face detection
  const currentContentInfo = useMemo(() => {
    if (!activeMedia || !activePlaylist) return null;
    return {
      contentId: activeMedia.id,
      contentName: activeMedia.name,
      playlistId: activePlaylist.id,
    };
  }, [activeMedia, activePlaylist]);

  const { activeFaces, isModelsLoaded: faceModelsLoaded } = usePlayerFaceDetection(
    deviceCode || "",
    !!deviceState?.camera_enabled,
    currentContentInfo,
    cameraPreviewRef
  );

  useDeviceMonitor(deviceCode || "", mediaElementRef);

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

  useKeyboardShortcuts({
    onFullscreen: toggleFullscreen,
    onSync: syncWithServer,
    onNext: goToNext,
    onPrev: goToPrev,
    itemsLength: items.length,
  });

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
      img.src = url;
      img.style.display = "block";
      const video = slot === "A" ? videoARef.current : videoBRef.current;
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
        video.style.display = "none";
      }
    } else {
      const video = slot === "A" ? videoARef.current : videoBRef.current;
      if (!video) return;
      video.preload = "auto";
      video.muted = true;
      video.src = url;
      video.load();
      video.oncanplay = () => {
        setNextReadySlot(slot);
      };
      video.play().then(() => {
        video.pause();
        video.currentTime = 0;
      }).catch(() => {
        video.pause();
        video.currentTime = 0;
      });
      video.style.display = "block";
      const img = slot === "A" ? imgARef.current : imgBRef.current;
      if (img) {
        img.style.display = "none";
        img.removeAttribute("src");
      }
    }
  }, [items]);

  // Firebase listener
  useEffect(() => {
    if (!deviceCode) return;
    const deviceRef = ref(db, `${deviceCode}`);
    const unsubscribe = onValue(deviceRef, (snapshot) => {
      const data = snapshot.val();
      if (data && (data["last-update"] || data["atualizacao_plataforma"] === "true")) {
        setUpdateMessage("Nova atualização recebida!");
        setShowUpdateNotification(true);
        syncWithServer();
        setTimeout(() => setShowUpdateNotification(false), 3000);
      }
    });
    return () => unsubscribe();
  }, [deviceCode, syncWithServer]);

  // Kiosk mode
  useEffect(() => {
    if (Capacitor.isNativePlatform()) setupKioskMode();
  }, []);

  useEffect(() => {
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
        const pct = ((activeVideo.currentTime) / activeVideo.duration) * 100;
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
  }, [items, currentIndex, activePlayer, preloadIntoSlot, getDurationForIndex, nextReadySlot]);

  useEffect(() => {
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
    const url = activeMedia.blob_url || activeMedia.file_url;
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
  }, [items, activeMedia, activePlayer]);

  // Session availability check
  if (deviceSession.status === "loading") {
    return <LoadingScreen message="Verificando disponibilidade..." subMessage={`Dispositivo: ${deviceCode}`} />;
  }
  if (deviceSession.status === "blocked") {
    return <ActiveSessionScreen deviceName={deviceSession.deviceName} message={deviceSession.errorMessage} />;
  }

  // State screens
  if (isLoading && !deviceState) {
    return <LoadingScreen subMessage={`Dispositivo: ${deviceCode}`} />;
  }

  if (isSyncing && !deviceState && downloadProgress.total > 0) {
    return (
      <DownloadScreen
        downloaded={downloadProgress.downloaded}
        total={downloadProgress.total}
        current={downloadProgress.current}
      />
    );
  }

  if (!activePlaylist || items.length === 0 || !activeMedia) {
    return (
      <EmptyContentScreen
        deviceName={deviceState?.device_name || deviceCode || undefined}
        syncError={syncError || (!activePlaylist || items.length === 0 ? undefined : "Nenhuma mídia ativa para exibir no momento")}
        onSync={syncWithServer}
        isSyncing={isSyncing}
      />
    );
  }

  const getObjectFit = (): "cover" | "contain" | "fill" => "fill";

  return (
    <div className="fixed inset-0 bg-black overflow-hidden select-none" style={{ width: '100vw', height: '100vh', margin: 0, padding: 0 }}>
      {Capacitor.isNativePlatform() && (
        <div className="absolute top-2 left-2 z-50 px-2 py-1 rounded bg-black/70 text-[10px] text-white/70">
          <span>WebViewPlayer • build: {__BUILD_ID__} • rota: {deviceCode ? `/webview/${deviceCode}` : "/android-player"}</span>
        </div>
      )}
      {/* Update notification */}
      <div className={cn(
        "absolute top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-500",
        showUpdateNotification ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
      )}>
        <div className="flex items-center gap-3 bg-primary/90 backdrop-blur-md text-primary-foreground px-6 py-3 rounded-full shadow-2xl">
          <Bell className="w-5 h-5 animate-pulse" />
          <span className="font-medium">{updateMessage}</span>
        </div>
      </div>

      {/* EAN Scanner Input (always listening) */}
      <EanInput
        isVisible={!showProductOverlay}
        onSubmit={handleEanSubmit}
        disabled={false}
        alwaysListenForScanner={true}
      />

      {/* Product lookup overlay */}
      {showProductOverlay && (
        <ProductLookupContainer
          product={product}
          isLoading={isProductLoading}
          error={productError}
          onDismiss={handleDismissProduct}
          timeout={9999}
          displaySettings={displaySettings || undefined}
        />
      )}

      {/* Media */}
      <div className={cn(
        "absolute inset-0",
        showProductOverlay ? "opacity-20 pointer-events-none" : "opacity-100"
      )}>
        {(activeMedia.type === "news" || activeMedia.type === "weather") && (
          <div className="absolute inset-0 z-10">
            <MediaRenderer media={activeMedia as any} mediaUrl={activeMedia.file_url || ""} objectFit={getObjectFit()} />
          </div>
        )}
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

      <PlayerProgressBar progressPercent={progressPercent} />

      <PlayerControls
        visible={showControls}
        deviceName={deviceState?.device_name || deviceCode || undefined}
        playlistName={activePlaylist.name}
        isOnline={isOnline}
        isFullscreen={isFullscreen}
        isSyncing={isSyncing}
        formattedTime={formattedTime}
        onToggleFullscreen={toggleFullscreen}
        onSync={syncWithServer}
        showClock
        showSyncButton
      />

      {/* Media info */}
      <div className={cn(
        "absolute bottom-6 left-6 bg-black/60 backdrop-blur-sm rounded-lg p-3 transition-opacity duration-300",
        showControls ? "opacity-100" : "opacity-0"
      )}>
        <div className="flex items-center gap-2">
          {activeMedia.blob_url && <CheckCircle2 className="w-4 h-4 text-green-400" />}
          <div>
            <p className="text-white font-medium text-sm">{activeMedia.name}</p>
            <p className="text-white/60 text-xs">
              {currentIndex + 1} de {items.length} • {Math.ceil(timeRemaining / 1000)}s
            </p>
          </div>
        </div>
      </div>

      {/* Offline badge */}
      {!isOnline && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-yellow-500/20 rounded-full px-3 py-1">
          <WifiOff className="w-3 h-3 text-yellow-400" />
          <span className="text-yellow-200 text-xs">Offline</span>
        </div>
      )}

      {/* Camera Preview */}
      <video
        ref={cameraPreviewRef}
        className={cn(
          "absolute bottom-24 right-6 w-48 h-36 bg-black border-2 border-white/20 rounded-lg object-cover z-50 transition-all duration-300 origin-bottom-right shadow-2xl",
          showCameraPreview && showControls ? "scale-100 opacity-100" : "scale-0 opacity-0 pointer-events-none"
        )}
        muted
        playsInline
      />

      {/* Face detection indicator */}
      <div 
        onClick={() => setShowCameraPreview(!showCameraPreview)}
        className={cn(
        "absolute bottom-6 right-6 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-lg p-3 transition-opacity duration-300 cursor-pointer hover:bg-black/80 active:scale-95",
        showControls ? "opacity-100" : "opacity-0"
      )}>
        <Camera className={cn(
          "w-4 h-4",
          faceModelsLoaded ? "text-green-400" : "text-yellow-400 animate-pulse"
        )} />
        {activeFaces.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-white text-sm font-medium">{activeFaces.length}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default WebViewPlayer;
