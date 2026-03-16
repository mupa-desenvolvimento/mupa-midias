import { useParams, useSearchParams } from "react-router-dom";
import { useDeviceNews } from "@/hooks/useDeviceNews";
import { NewsLayoutRenderer, type NewsLayoutId } from "@/components/news/NewsLayoutPreview";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface NewsPlayerSlideProps {
  onEnded?: () => void;
  media?: { metadata?: any } | null;
  isPortrait?: boolean;
}

export const NewsPlayerSlide = ({ media, isPortrait = false }: NewsPlayerSlideProps) => {
  const { deviceCode, deviceId } = useParams();
  const [searchParams] = useSearchParams();
  const queryDeviceId = searchParams.get("device_id");
  
  const code = deviceCode || deviceId || queryDeviceId;
  
  const { data, isLoading } = useDeviceNews(code);
  const [featuredRotationNonce] = useState(() => Date.now());

  const meta = (media?.metadata || {}) as any;
  const rawCategory = (meta.news_category as string | null | undefined) ?? null;
  const category = rawCategory && rawCategory !== "all" ? rawCategory : null;
  const layoutId = ((meta.layout as NewsLayoutId | undefined) ?? "hero-sidebar") as NewsLayoutId;

  const filteredArticles = useMemo(() => {
    const articles = data?.articles || [];
    const perCategory = 5;

    if (category) {
      return articles.filter((a) => a.category === category).slice(0, perCategory);
    }

    const countsByCategory = new Map<string, number>();
    const picked: typeof articles = [];

    for (const article of articles) {
      const cat = article.category || "geral";
      const count = countsByCategory.get(cat) ?? 0;
      if (count >= perCategory) continue;
      picked.push(article);
      countsByCategory.set(cat, count + 1);
    }

    return picked;
  }, [data?.articles, category]);

  const [featuredIndex, setFeaturedIndex] = useState(0);

  useEffect(() => {
    if (!code) return;
    if (!filteredArticles || filteredArticles.length === 0) return;

    const key = `news_featured_index_${code}_${category || "all"}`;
    const stored = localStorage.getItem(key);
    const prev = stored ? Number.parseInt(stored, 10) : -1;
    const next = Number.isFinite(prev) ? (prev + 1) % filteredArticles.length : 0;
    localStorage.setItem(key, String(next));
    setFeaturedIndex(next);
  }, [code, category, filteredArticles.length, featuredRotationNonce]);

  const rotatedArticles = useMemo(() => {
    if (!filteredArticles || filteredArticles.length === 0) return [];
    const idx = Math.min(Math.max(featuredIndex, 0), filteredArticles.length - 1);
    const featured = filteredArticles[idx];
    const rest = filteredArticles.filter((_, i) => i !== idx);
    return [featured, ...rest];
  }, [featuredIndex, filteredArticles]);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black text-white">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!data || !data.articles || data.articles.length === 0) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center text-white/50">
        <p>Sem notícias disponíveis</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-black overflow-hidden">
      <NewsLayoutRenderer layoutId={layoutId} articles={rotatedArticles} category={category || "all"} />
    </div>
  );
};
