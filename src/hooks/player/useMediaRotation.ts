import { useState, useEffect, useRef, useCallback, useMemo } from "react";

interface MediaRotationOptions {
  itemsLength: number;
  getDuration: (index: number) => number; // in seconds; return 0 for videos to rely on onEnded
  getIsVideo: (index: number) => boolean;
  enabled: boolean;
  onFadeStart?: () => void;
  fadeBeforeMs?: number;
}

const DEFAULT_IMAGE_DURATION = 10; // segundos padrão para imagens

export const useMediaRotation = ({
  itemsLength,
  getDuration,
  getIsVideo,
  enabled,
  onFadeStart,
  fadeBeforeMs = 0,
}: MediaRotationOptions) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const mediaTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fadeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentDuration = useMemo(() => getDuration(currentIndex), [currentIndex, getDuration]);
  const isVideo = useMemo(() => getIsVideo(currentIndex), [currentIndex, getIsVideo]);

  const goToNext = useCallback(() => {
    if (itemsLength === 0) return;
    setCurrentIndex((prev) => (prev + 1) % itemsLength);
  }, [itemsLength]);

  const goToPrev = useCallback(() => {
    if (itemsLength === 0) return;
    setCurrentIndex((prev) => (prev - 1 + itemsLength) % itemsLength);
  }, [itemsLength]);

  const resetIndex = useCallback(() => {
    setCurrentIndex(0);
  }, []);

  useEffect(() => {
    if (!enabled || itemsLength === 0) return;

    // Vídeos sem duration_override: aguardam onEnded para respeitar a duração real.
    // Apenas configura timer de progresso sem avanço automático.
    if (isVideo && currentDuration <= 0) {
      setTimeRemaining(0);
      return;
    }

    // Para imagens: usa o duration do banco ou o padrão de 10s
    const effectiveDuration = isVideo
      ? currentDuration
      : currentDuration > 0
      ? currentDuration
      : DEFAULT_IMAGE_DURATION;

    const durationMs = effectiveDuration * 1000;
    setTimeRemaining(durationMs);

    const startTime = Date.now();
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setTimeRemaining(Math.max(0, durationMs - elapsed));
    }, 100);

    if (fadeBeforeMs > 0 && onFadeStart) {
      fadeTimerRef.current = setTimeout(() => {
        onFadeStart();
      }, Math.max(0, durationMs - fadeBeforeMs));
    }

    // Imagens avançam por timer; vídeos com duration_override também
    mediaTimerRef.current = setTimeout(goToNext, durationMs);

    return () => {
      if (mediaTimerRef.current) clearTimeout(mediaTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [currentIndex, currentDuration, isVideo, enabled, itemsLength, goToNext, fadeBeforeMs, onFadeStart]);

  const progressPercent =
    currentDuration > 0
      ? ((currentDuration * 1000 - timeRemaining) / (currentDuration * 1000)) * 100
      : 0;

  return {
    currentIndex,
    setCurrentIndex,
    timeRemaining,
    progressPercent,
    goToNext,
    goToPrev,
    resetIndex,
  };
};
