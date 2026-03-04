import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NewsArticle, NewsSettings } from "./useNews";

interface DeviceNewsData {
  articles: NewsArticle[];
  settings: NewsSettings | null;
}

export const useDeviceNews = (deviceCode: string | undefined) => {
  return useQuery({
    queryKey: ["device-news", deviceCode],
    queryFn: async (): Promise<DeviceNewsData | null> => {
      if (!deviceCode) return null;
      
      const { data, error } = await supabase.functions.invoke("get-device-news", {
        body: { deviceCode }
      });

      if (error) throw error;
      return data;
    },
    enabled: !!deviceCode,
    staleTime: 1000 * 60 * 10, // 10 minutes
    refetchInterval: 1000 * 60 * 15 // 15 minutes
  });
};
