import { useRef, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { NewsPlayerSlide } from "./NewsPlayerSlide";
import { useDeviceWeather } from "@/hooks/useDeviceWeather";
import { WeatherContainer } from "@/components/weather-layouts/WeatherContainer";
import { isIframeType, resolveContentSrc, getYouTubeEmbedUrl } from "@/constants/contentTypes";

export interface MediaItem {
  id: string;
  name: string;
  type: string;
  file_url: string | null;
  blob_url?: string;
  duration: number | null;
  metadata?: any;
}

interface MediaRendererProps {
  media: MediaItem;
  mediaUrl: string;
  objectFit?: "fill" | "cover" | "contain";
  transitionClass?: string;
  onEnded?: () => void;
  onImageError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  hideUntilReady?: boolean;
  onElementRef?: (el: HTMLVideoElement | HTMLImageElement | null) => void;
  isPortrait?: boolean;
}

export const MediaRenderer = ({
  media,
  mediaUrl,
  objectFit = "fill",
  transitionClass = "",
  onEnded,
  onImageError,
  autoPlay = true,
  muted = true,
  loop = false,
  hideUntilReady = false,
  onElementRef,
  isPortrait = false,
}: MediaRendererProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isReady, setIsReady] = useState(!hideUntilReady);
  const { deviceCode: routeDeviceCode, deviceId } = useParams();
  const [searchParams] = useSearchParams();
  const queryDeviceId = searchParams.get("device_id");
  const resolvedDeviceCode = routeDeviceCode || deviceId || queryDeviceId || "";
  const selectedWeatherLocationId = media.type === "weather"
    ? ((media.metadata as any)?.weather_location_id as string | undefined)
    : undefined;
  const { weatherSettings, isLoading: isWeatherLoading } = useDeviceWeather(
    media.type === "weather" ? resolvedDeviceCode : ""
  );
  const selectedWeatherLocation = useMemo(() => {
    if (media.type !== "weather") return null;
    if (!weatherSettings || weatherSettings.length === 0) return null;
    if (selectedWeatherLocationId) {
      const match = weatherSettings.find((l) => l.id === selectedWeatherLocationId);
      if (match) return match;
    }
    const def = weatherSettings.find((l) => l.is_default);
    return def || weatherSettings[0] || null;
  }, [media.type, selectedWeatherLocationId, weatherSettings]);

  const objectFitClass = {
    fill: "object-fill",
    cover: "object-cover",
    contain: "object-contain",
  }[objectFit];

  useEffect(() => {
    setIsReady(!hideUntilReady);
  }, [media.id, hideUntilReady]);

  useEffect(() => {
    if (media.type === "video" && videoRef.current && autoPlay) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(console.error);
    }
  }, [media, autoPlay]);

  // ─── Video ───
  if (media.type === "video") {
    const handleVideoRef = (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      if (onElementRef) onElementRef(el);
    };

    return (
      <video
        ref={handleVideoRef}
        key={media.id}
        src={mediaUrl}
        preload="auto"
        className={cn(
          "w-full h-full",
          objectFitClass,
          transitionClass,
          !isReady && "opacity-0"
        )}
        autoPlay={autoPlay}
        muted={muted}
        playsInline
        loop={loop}
        onEnded={onEnded}
        onCanPlay={() => setIsReady(true)}
        onPlaying={() => setIsReady(true)}
      />
    );
  }

  // ─── News ───
  if (media.type === "news") {
    return <NewsPlayerSlide key={media.id} onEnded={onEnded} media={media} isPortrait={isPortrait} />;
  }

  // ─── Weather ───
  if (media.type === "weather") {
    if (!resolvedDeviceCode) {
      return (
        <div className="w-full h-full bg-black flex items-center justify-center text-white/50">
          <p>Clima indisponível</p>
        </div>
      );
    }

    if (isWeatherLoading) {
      return (
        <div className="w-full h-full bg-black flex items-center justify-center text-white/50">
          <p>Carregando clima...</p>
        </div>
      );
    }

    if (!selectedWeatherLocation) {
      return (
        <div className="w-full h-full bg-black flex items-center justify-center text-white/50">
          <p>Clima não configurado</p>
        </div>
      );
    }

    return (
      <div className={cn("w-full h-full bg-black", transitionClass, !isReady && "opacity-0")}>
        <WeatherContainer location={selectedWeatherLocation as any} orientation={isPortrait ? "vertical" : "horizontal"} className="w-full h-full" />
      </div>
    );
  }

  // ─── Motivational / Curiosity / Birthday / Nutrition (text-based dynamic content) ───
  if (['motivational', 'curiosity', 'birthday', 'nutrition'].includes(media.type)) {
    const meta = media.metadata as any;
    return (
      <div
        key={media.id}
        className={cn("w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center p-8", transitionClass)}
      >
        <div className="text-center max-w-2xl">
          <h2 className="text-3xl font-bold text-foreground mb-4">{media.name}</h2>
          {meta?.content && (
            <p className="text-xl text-muted-foreground">{meta.content}</p>
          )}
          {meta?.author && (
            <p className="text-lg text-primary mt-4 italic">— {meta.author}</p>
          )}
        </div>
      </div>
    );
  }

  // ─── Campaign (QR Code) ───
  if (media.type === 'campaign') {
    const meta = media.metadata as any;
    const src = meta?.campaign_url || meta?.qr_url || media.file_url;
    if (src) {
      return (
        <img
          key={media.id}
          src={src}
          alt={media.name}
          className={cn("w-full h-full object-contain", transitionClass)}
        />
      );
    }
    return (
      <div className="w-full h-full bg-black flex items-center justify-center text-white/50">
        <p>Campanha não disponível</p>
      </div>
    );
  }

  // ─── Instagram (iframe) ───
  if (media.type === 'instagram') {
    const src = resolveContentSrc('instagram', media.file_url, media.metadata);
    if (!src) {
      return (
        <div className="w-full h-full bg-black flex items-center justify-center text-white/50">
          <p>Instagram não disponível</p>
        </div>
      );
    }
    return (
      <iframe
        key={media.id}
        src={src}
        className={cn("w-full h-full border-0", transitionClass)}
        allow="autoplay; encrypted-media"
        allowFullScreen
        title={media.name}
      />
    );
  }

  // ─── Image (default fallback) ───
  const handleImageRef = (el: HTMLImageElement | null) => {
    if (onElementRef) onElementRef(el);
  };

  return (
    <img
      key={media.id}
      ref={handleImageRef}
      src={mediaUrl}
      loading="eager"
      alt={media.name}
      className={cn("w-full h-full", objectFitClass, transitionClass)}
      onError={onImageError}
    />
  );
};
