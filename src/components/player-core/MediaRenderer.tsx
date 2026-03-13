import { useRef, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { NewsPlayerSlide } from "./NewsPlayerSlide";
import { useDeviceWeather } from "@/hooks/useDeviceWeather";
import { WeatherContainer } from "@/components/weather-layouts/WeatherContainer";

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

  if (media.type === "news") {
    return <NewsPlayerSlide key={media.id} onEnded={onEnded} media={media} />;
  }

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
        <WeatherContainer location={selectedWeatherLocation as any} orientation="horizontal" className="w-full h-full" />
      </div>
    );
  }

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
