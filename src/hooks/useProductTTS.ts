import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

// Local memory cache for audio URLs to avoid even DB lookups
const audioUrlCache = new Map<string, string>();

export const useProductTTS = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTextRef = useRef<string | null>(null);

  const speak = useCallback(async (text: string) => {
    if (!text || text.trim().length === 0) return;

    const cleanText = text.trim();
    
    // Don't repeat the same text
    if (currentTextRef.current === cleanText) return;
    currentTextRef.current = cleanText;

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    try {
      // Check local memory cache first
      const cachedUrl = audioUrlCache.get(cleanText);
      if (cachedUrl) {
        console.log("[TTS] Memory cache hit");
        const audio = new Audio(cachedUrl);
        audioRef.current = audio;
        audio.onended = () => { currentTextRef.current = null; };
        await audio.play().catch(() => {});
        return;
      }

      // Call edge function (handles DB cache internally)
      const { data, error } = await supabase.functions.invoke("elevenlabs-tts", {
        body: { text: cleanText },
      });

      if (error || !data) {
        console.error("[TTS] Error:", error);
        currentTextRef.current = null;
        return;
      }

      let audioUrl: string;

      if (data.audio_url) {
        audioUrl = data.audio_url;
        audioUrlCache.set(cleanText, audioUrl);
      } else if (data.audio_base64) {
        audioUrl = `data:audio/mpeg;base64,${data.audio_base64}`;
      } else {
        console.error("[TTS] No audio data returned");
        currentTextRef.current = null;
        return;
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => { currentTextRef.current = null; };
      await audio.play().catch(() => {});
    } catch (err) {
      console.error("[TTS] Playback error:", err);
      currentTextRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    currentTextRef.current = null;
  }, []);

  return { speak, stop };
};
