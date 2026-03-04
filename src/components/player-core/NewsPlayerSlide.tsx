import { useParams, useSearchParams } from "react-router-dom";
import { useDeviceNews } from "@/hooks/useDeviceNews";
import { NewsContainer } from "@/components/news/NewsContainer";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

interface NewsPlayerSlideProps {
  onEnded?: () => void;
}

export const NewsPlayerSlide = ({ onEnded }: NewsPlayerSlideProps) => {
  const { deviceCode, deviceId } = useParams();
  const [searchParams] = useSearchParams();
  const queryDeviceId = searchParams.get("device_id");
  
  const code = deviceCode || deviceId || queryDeviceId;
  
  const { data, isLoading } = useDeviceNews(code);

  useEffect(() => {
    if (!data || !onEnded) return;
    
    // Default to 15 seconds if not configured
    const duration = (data.settings?.display_time || 15) * 1000;
    
    const timer = setTimeout(() => {
      onEnded();
    }, duration);

    return () => clearTimeout(timer);
  }, [data, onEnded]);

  useEffect(() => {
    if (!isLoading && (!data || !data.articles || data.articles.length === 0)) {
       if (onEnded) {
         const timer = setTimeout(onEnded, 3000);
         return () => clearTimeout(timer);
       }
    }
  }, [isLoading, data, onEnded]);

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
    <div className="w-full h-full bg-background overflow-hidden">
      <NewsContainer 
        articles={data.articles}
        settings={data.settings || undefined}
        viewMode={data.settings?.type_view || "list"}
        orientation="horizontal"
        className="w-full h-full"
      />
    </div>
  );
};
