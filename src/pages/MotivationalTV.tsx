import React, { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface MotivationalQuote {
  id: string;
  quote: string;
  author: string;
  image_url: string | null;
}

const SLIDE_DURATION = 25000; // 25 seconds

export default function MotivationalTV() {
  const [quotes, setQuotes] = useState<MotivationalQuote[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fade, setFade] = useState(true);
  const [loading, setLoading] = useState(true);
  const shownIdsRef = useRef<Set<string>>(new Set());
  const remainingRef = useRef<MotivationalQuote[]>([]);

  // Fetch active, unused quotes
  const fetchQuotes = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("motivational_quotes")
      .select("id, quote, author, image_url")
      .eq("is_active", true)
      .eq("used", false)
      .limit(200);

    if (error) {
      console.error("Error fetching quotes:", error);
      // Fallback: fetch all active
      const { data: fallback } = await (supabase as any)
        .from("motivational_quotes")
        .select("id, quote, author, image_url")
        .eq("is_active", true)
        .limit(200);
      return fallback || [];
    }

    // If no unused left, reset all and fetch again
    if (!data || data.length === 0) {
      await (supabase as any)
        .from("motivational_quotes")
        .update({ used: false, used_at: null })
        .eq("is_active", true);

      const { data: reset } = await (supabase as any)
        .from("motivational_quotes")
        .select("id, quote, author, image_url")
        .eq("is_active", true)
        .limit(200);
      return reset || [];
    }

    return data;
  }, []);

  // Shuffle array (Fisher-Yates)
  const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // Initialize
  useEffect(() => {
    (async () => {
      const data = await fetchQuotes();
      const shuffled = shuffle(data as MotivationalQuote[]);
      setQuotes(shuffled);
      remainingRef.current = shuffled.slice(1);
      shownIdsRef.current = new Set(shuffled.length > 0 ? [shuffled[0].id] : []);
      setLoading(false);
    })();
  }, [fetchQuotes]);

  // Mark quote as used
  const markUsed = useCallback(async (id: string) => {
    await (supabase as any)
      .from("motivational_quotes")
      .update({ used: true, used_at: new Date().toISOString() })
      .eq("id", id);
  }, []);

  // Advance to next slide
  useEffect(() => {
    if (quotes.length === 0) return;

    const timer = setInterval(async () => {
      // Fade out
      setFade(false);

      setTimeout(async () => {
        if (remainingRef.current.length === 0) {
          // Refetch when pool exhausted
          const data = await fetchQuotes();
          const shuffled = shuffle(data as MotivationalQuote[]);
          remainingRef.current = shuffled;
          shownIdsRef.current.clear();
        }

        const next = remainingRef.current.shift();
        if (next) {
          shownIdsRef.current.add(next.id);
          setQuotes((prev) => {
            const updated = [...prev];
            const newIdx = (currentIndex + 1) % Math.max(updated.length, 1);
            updated[newIdx] = next;
            return updated;
          });
          setCurrentIndex((prev) => (prev + 1) % Math.max(quotes.length, 1));
          markUsed(next.id);
        }

        // Fade in
        setFade(true);
      }, 800);
    }, SLIDE_DURATION);

    return () => clearInterval(timer);
  }, [quotes, currentIndex, fetchQuotes, markUsed]);

  // Hide cursor
  useEffect(() => {
    document.body.style.cursor = "none";
    return () => {
      document.body.style.cursor = "";
    };
  }, []);

  // Mark first quote as used
  useEffect(() => {
    if (quotes.length > 0 && quotes[0]) {
      markUsed(quotes[0].id);
    }
  }, [quotes.length > 0]); // eslint-disable-line

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white/40 text-lg animate-pulse">Carregando frases...</div>
      </div>
    );
  }

  if (quotes.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/60 text-xl mb-2">Nenhuma frase disponível</p>
          <p className="text-white/30 text-sm">
            Acesse o painel admin para gerar frases motivacionais
          </p>
        </div>
      </div>
    );
  }

  const current = quotes[currentIndex] || quotes[0];

  return (
    <div className="fixed inset-0 bg-black overflow-hidden select-none">
      {/* Background image */}
      {current?.image_url && (
        <img
          key={current.id + "-bg"}
          src={current.image_url}
          alt=""
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[800ms] ease-in-out ${
            fade ? "opacity-100" : "opacity-0"
          }`}
        />
      )}

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/30" />

      {/* Quote content */}
      <div
        className={`absolute inset-0 flex items-center justify-center p-8 md:p-16 lg:p-24 transition-opacity duration-[800ms] ease-in-out ${
          fade ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="text-center max-w-4xl">
          <p
            className="text-white font-bold leading-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]"
            style={{
              fontFamily: "'Playfair Display', 'Georgia', serif",
              fontSize: "clamp(1.5rem, 4vw, 3.5rem)",
              lineHeight: 1.3,
            }}
          >
            "{current?.quote}"
          </p>
          <p
            className="text-white/70 mt-6 drop-shadow-lg"
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: "clamp(0.875rem, 1.5vw, 1.25rem)",
              fontWeight: 500,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            — {current?.author}
          </p>
        </div>
      </div>

      {/* Attribution footer */}
      <div className="absolute bottom-3 left-0 right-0 text-center">
        <p
          className="text-white/20 text-[10px]"
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
          Frases por ZenQuotes.io | Imagens por Pexels
        </p>
      </div>
    </div>
  );
}
