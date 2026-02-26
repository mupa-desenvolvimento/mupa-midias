import { useState, useEffect, useRef, useCallback, useMemo } from "react";

interface MediaRotationOptions {
  itemsLength: number;
  getDuration: (index: number) => number; // in seconds; return 0 for videos to rely on onEnded
  getIsVideo: (index: number) => boolean;
  enabled: boolean;
  onFadeStart?: () => void;
  fadeBeforeMs?: number;
}

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

  // Timer-based rotation for images (videos use onEnded)
  useEffect(() => {
    if (!enabled || itemsLength === 0 || currentDuration <= 0) return;

    // For videos without explicit duration control, skip timer
    if (isVideo && !currentDuration) return;

    const durationMs = currentDuration * 1000;
    setTimeRemaining(durationMs);

    const startTime = Date.now();
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setTimeRemaining(Math.max(0, durationMs - elapsed));
    }, 100);

    if (fadeBeforeMs > 0 && onFadeStart) {
      fadeTimerRef.current = setTimeout(() => {
        onFadeStart();
      }, durationMs - fadeBeforeMs);
    }

    // For images, auto-advance. For videos, let onEnded handle it unless duration_override is set
    if (!isVideo || currentDuration) {
      mediaTimerRef.current = setTimeout(goToNext, durationMs);
    }

    return () => {
      if (mediaTimerRef.current) clearTimeout(mediaTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [currentIndex, currentDuration, isVideo, enabled, itemsLength, goToNext, fadeBeforeMs, onFadeStart]);

  const progressPercent = currentDuration > 0
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
