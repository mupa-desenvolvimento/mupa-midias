/**
 * useSeamlessMediaPlayer
 *
 * Sistema profissional de reprodução contínua (seamless playback) estilo
 * Netflix / YouTube TV para vídeos e imagens em playlists.
 *
 * Regras aplicadas (ver especificação do produto):
 *  - NUNCA usa display:none em vídeos (apenas opacity / z-index)
 *  - Crossfade real (400ms) entre slots A/B
 *  - Double buffer: ambos os <video> permanecem montados o tempo todo
 *  - Preload via `canplaythrough` (sem polling em readyState)
 *  - Warm-up silencioso do decoder (play→pause→reset com muted)
 *  - Troca antecipada: preload com ~2s restantes, crossfade com ~0.4s
 *  - Nunca limpa src durante a troca; só após transição (e se for descartado)
 *  - Fallback instantâneo: se próximo não estiver pronto, mantém atual
 *  - Imagens entram no mesmo modelo A/B com Image() preload
 *  - GPU hints (will-change / translateZ) ficam no CSS do consumidor
 *
 * O hook expõe apenas estado e handlers — a renderização dos elementos
 * <video>/<img> A e B fica a cargo do componente, que deve fornecer refs.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type SeamlessSlot = "A" | "B";

export interface SeamlessMediaItem {
  id: string;
  type: string; // "video" | "image" | outros (ignorados)
  url: string;
  /** Duração em segundos. Para vídeos pode vir 0 (usa duração nativa). */
  duration: number;
}

interface Options {
  items: SeamlessMediaItem[];
  videoARef: React.RefObject<HTMLVideoElement | null>;
  videoBRef: React.RefObject<HTMLVideoElement | null>;
  imgARef: React.RefObject<HTMLImageElement | null>;
  imgBRef: React.RefObject<HTMLImageElement | null>;
  /** Tempo de crossfade em ms. Default 400. */
  crossfadeMs?: number;
  /** Quando começar a fazer warm-up do próximo (segundos antes do fim). */
  preloadLeadSeconds?: number;
  /** Quando iniciar o crossfade (segundos antes do fim). */
  crossfadeLeadSeconds?: number;
  /** Pausa rotação (ex.: override media). */
  paused?: boolean;
  onIndexChange?: (index: number) => void;
}

interface SlotState {
  itemId: string | null;
  ready: boolean;
}

const DEFAULT_CROSSFADE_MS = 400;
const DEFAULT_PRELOAD_LEAD = 2;
const DEFAULT_CROSSFADE_LEAD = 0.4;
const FALLBACK_IMAGE_DURATION = 10;

export function useSeamlessMediaPlayer({
  items,
  videoARef,
  videoBRef,
  imgARef,
  imgBRef,
  crossfadeMs = DEFAULT_CROSSFADE_MS,
  preloadLeadSeconds = DEFAULT_PRELOAD_LEAD,
  crossfadeLeadSeconds = DEFAULT_CROSSFADE_LEAD,
  paused = false,
  onIndexChange,
}: Options) {
  const [activeSlot, setActiveSlot] = useState<SeamlessSlot>("A");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const [timeRemainingMs, setTimeRemainingMs] = useState(0);

  // Estado dos slots (qual item está em cada um e se está pronto)
  const slotStateRef = useRef<Record<SeamlessSlot, SlotState>>({
    A: { itemId: null, ready: false },
    B: { itemId: null, ready: false },
  });

  // Versão para invalidar timers quando o item muda
  const tickRef = useRef(0);
  const swapInFlightRef = useRef(false);

  // Helpers de acesso aos elementos
  const getVideo = useCallback(
    (slot: SeamlessSlot) => (slot === "A" ? videoARef.current : videoBRef.current),
    [videoARef, videoBRef],
  );
  const getImg = useCallback(
    (slot: SeamlessSlot) => (slot === "A" ? imgARef.current : imgBRef.current),
    [imgARef, imgBRef],
  );

  /**
   * Carrega um item em um slot específico, fazendo warm-up silencioso.
   * NUNCA usa display:none. NUNCA chama removeAttribute("src") aqui.
   */
  const loadIntoSlot = useCallback(
    async (slot: SeamlessSlot, item: SeamlessMediaItem | null): Promise<boolean> => {
      if (!item || !item.url) return false;

      // Já carregado neste slot?
      if (slotStateRef.current[slot].itemId === item.id && slotStateRef.current[slot].ready) {
        return true;
      }
      slotStateRef.current[slot] = { itemId: item.id, ready: false };

      if (item.type === "video") {
        const video = getVideo(slot);
        if (!video) return false;

        return await new Promise<boolean>((resolve) => {
          let settled = false;
          const cleanup = () => {
            video.removeEventListener("canplaythrough", onReady);
            video.removeEventListener("loadeddata", onReady);
            video.removeEventListener("error", onError);
          };
          const onReady = async () => {
            if (settled) return;
            // Warm-up: play silencioso e volta para o início.
            try {
              video.muted = true;
              await video.play();
              video.pause();
              video.currentTime = 0;
            } catch {
              /* alguns engines bloqueiam — segue mesmo assim */
            }
            settled = true;
            cleanup();
            slotStateRef.current[slot].ready = true;
            resolve(true);
          };
          const onError = () => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve(false);
          };

          video.addEventListener("canplaythrough", onReady, { once: true });
          // loadeddata é fallback para Android WebView que nem sempre dispara canplaythrough
          video.addEventListener("loadeddata", onReady, { once: true });
          video.addEventListener("error", onError, { once: true });

          // Atribui src apenas se mudou — evita reload de decoder
          if (video.src !== item.url) {
            video.preload = "auto";
            video.muted = true;
            video.playsInline = true;
            video.src = item.url;
            video.load();
          } else {
            // já tem o src certo, força ready
            queueMicrotask(onReady);
          }
        });
      }

      if (item.type === "image") {
        const img = getImg(slot);
        if (!img) return false;
        return await new Promise<boolean>((resolve) => {
          const loader = new Image();
          loader.decoding = "async";
          loader.onload = () => {
            img.src = item.url;
            slotStateRef.current[slot].ready = true;
            resolve(true);
          };
          loader.onerror = () => resolve(false);
          loader.src = item.url;
        });
      }

      // Tipo não suportado por este hook (news/weather/etc.) — deixa para o caller.
      slotStateRef.current[slot].ready = true;
      return true;
    },
    [getImg, getVideo],
  );

  /**
   * Inicia a reprodução no slot ativo (chamado após o crossfade).
   */
  const playSlot = useCallback(
    (slot: SeamlessSlot, item: SeamlessMediaItem | null) => {
      if (!item) return;
      if (item.type === "video") {
        const video = getVideo(slot);
        if (!video) return;
        try {
          video.currentTime = 0;
        } catch {
          /* ignore */
        }
        video.muted = false;
        video.play().catch(() => {
          // Fallback: tenta mutado (políticas de autoplay)
          video.muted = true;
          video.play().catch(() => {});
        });
      }
    },
    [getVideo],
  );

  /**
   * Pausa o slot anterior depois que o crossfade terminou (sem limpar src).
   */
  const quietSlot = useCallback(
    (slot: SeamlessSlot) => {
      const video = getVideo(slot);
      if (video) {
        try {
          video.pause();
        } catch {
          /* ignore */
        }
      }
    },
    [getVideo],
  );

  /**
   * Executa a troca A↔B com crossfade real. Idempotente por tick.
   */
  const swapToNext = useCallback(
    async (nextIndex: number) => {
      if (swapInFlightRef.current) return;
      if (items.length === 0) return;
      swapInFlightRef.current = true;

      const nextSlot: SeamlessSlot = activeSlot === "A" ? "B" : "A";
      const prevSlot = activeSlot;
      const nextItem = items[nextIndex];

      // Garante que o próximo está pronto. Se não estiver: fallback (mantém atual).
      const ready =
        slotStateRef.current[nextSlot].itemId === nextItem?.id &&
        slotStateRef.current[nextSlot].ready;
      const ok = ready ? true : await loadIntoSlot(nextSlot, nextItem || null);

      if (!ok) {
        // Fallback instantâneo: não troca, segue rodando o atual.
        swapInFlightRef.current = false;
        return;
      }

      // Inicia reprodução do próximo ANTES de virar opacidades — sem flicker.
      playSlot(nextSlot, nextItem || null);
      setActiveSlot(nextSlot);
      setCurrentIndex(nextIndex);
      onIndexChange?.(nextIndex);

      // Após o crossfade, pausa o slot anterior (sem limpar src!)
      window.setTimeout(() => {
        quietSlot(prevSlot);
        swapInFlightRef.current = false;
      }, crossfadeMs + 50);
    },
    [activeSlot, crossfadeMs, items, loadIntoSlot, onIndexChange, playSlot, quietSlot],
  );

  // Carrega o primeiro item ao iniciar / quando a lista muda significativamente
  useEffect(() => {
    if (items.length === 0) return;
    const item = items[currentIndex] || items[0];
    if (!item) return;
    let cancelled = false;
    (async () => {
      const ok = await loadIntoSlot(activeSlot, item);
      if (!ok || cancelled) return;
      playSlot(activeSlot, item);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => i.id).join("|")]);

  // Loop principal: progresso, preload antecipado e troca
  useEffect(() => {
    if (paused) return;
    if (items.length === 0) return;
    const item = items[currentIndex];
    if (!item) return;

    tickRef.current += 1;
    const myTick = tickRef.current;

    const isVideo = item.type === "video";
    const nextIndex = (currentIndex + 1) % items.length;
    const nextItem = items[nextIndex] || null;
    const nextSlot: SeamlessSlot = activeSlot === "A" ? "B" : "A";

    // Pré-carrega já — fica pronto enquanto o atual roda
    void loadIntoSlot(nextSlot, nextItem);

    if (isVideo) {
      const video = getVideo(activeSlot);
      if (!video) return;

      const onTime = () => {
        if (myTick !== tickRef.current) return;
        if (!video.duration || isNaN(video.duration)) return;
        const remaining = Math.max(video.duration - video.currentTime, 0);
        setTimeRemainingMs(remaining * 1000);
        const pct = (video.currentTime / video.duration) * 100;
        setProgressPercent(isFinite(pct) ? pct : 0);

        if (remaining <= preloadLeadSeconds) {
          void loadIntoSlot(nextSlot, nextItem);
        }
        if (remaining <= crossfadeLeadSeconds) {
          void swapToNext(nextIndex);
        }
      };
      const onEnded = () => {
        if (myTick !== tickRef.current) return;
        void swapToNext(nextIndex);
      };

      video.addEventListener("timeupdate", onTime);
      video.addEventListener("ended", onEnded);
      return () => {
        video.removeEventListener("timeupdate", onTime);
        video.removeEventListener("ended", onEnded);
      };
    }

    // Imagens: timer
    const dur = (item.duration > 0 ? item.duration : FALLBACK_IMAGE_DURATION) * 1000;
    const start = Date.now();
    setTimeRemainingMs(dur);
    setProgressPercent(0);

    const interval = window.setInterval(() => {
      if (myTick !== tickRef.current) return;
      const elapsed = Date.now() - start;
      const remaining = Math.max(dur - elapsed, 0);
      setTimeRemainingMs(remaining);
      setProgressPercent(Math.min((elapsed / dur) * 100, 100));

      if (remaining <= preloadLeadSeconds * 1000) {
        void loadIntoSlot(nextSlot, nextItem);
      }
      if (remaining <= crossfadeLeadSeconds * 1000) {
        void swapToNext(nextIndex);
      }
    }, 100);

    return () => {
      window.clearInterval(interval);
    };
  }, [
    activeSlot,
    crossfadeLeadSeconds,
    currentIndex,
    getVideo,
    items,
    loadIntoSlot,
    paused,
    preloadLeadSeconds,
    swapToNext,
  ]);

  const goToNext = useCallback(() => {
    if (items.length === 0) return;
    void swapToNext((currentIndex + 1) % items.length);
  }, [currentIndex, items.length, swapToNext]);

  const goToPrev = useCallback(() => {
    if (items.length === 0) return;
    void swapToNext((currentIndex - 1 + items.length) % items.length);
  }, [currentIndex, items.length, swapToNext]);

  return {
    activeSlot,
    currentIndex,
    progressPercent,
    timeRemainingMs,
    goToNext,
    goToPrev,
  };
}
