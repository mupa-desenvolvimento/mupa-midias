import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { NewsPlayerSlide } from "./NewsPlayerSlide";

export interface MediaItem {
  id: string;
  name: string;
  type: string;
  file_url: string | null;
  blob_url?: string;
  duration: number | null;
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
    return <NewsPlayerSlide onEnded={onEnded} />;
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
